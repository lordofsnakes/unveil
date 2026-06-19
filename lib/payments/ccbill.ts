import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { APP_NAME } from "@/lib/constants";
import { normalizeMoney } from "@/lib/custodial";
import type {
  CreateTopUpCheckoutInput,
  NormalizedPaymentEvent,
  TopUpProvider,
} from "./types";

const DEFAULT_BASE_URL = "https://api.ccbill.com/wap-frontflex/flexforms";
const DEFAULT_CURRENCY_CODE = "840";
const DEFAULT_INITIAL_PERIOD = "30";
const DEFAULT_LANGUAGE = "English";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

function fixedTwo(amount: string) {
  return Number(normalizeMoney(amount)).toFixed(2);
}

function appendIfPresent(params: URLSearchParams, key: string, value?: string | null) {
  if (value) params.set(key, value);
}

function getConfig() {
  return {
    baseUrl: optionalEnv("CCBILL_FLEXFORMS_BASE_URL") ?? DEFAULT_BASE_URL,
    flexFormId: env("CCBILL_FLEX_FORM_ID"),
    clientSubacc: env("CCBILL_CLIENT_SUBACC"),
    formSalt: env("CCBILL_FORM_SALT"),
    currencyCode: optionalEnv("CCBILL_CURRENCY_CODE") ?? DEFAULT_CURRENCY_CODE,
    initialPeriod: optionalEnv("CCBILL_INITIAL_PERIOD") ?? DEFAULT_INITIAL_PERIOD,
    language: optionalEnv("CCBILL_LANGUAGE") ?? DEFAULT_LANGUAGE,
  };
}

export const ccbillProvider: TopUpProvider = {
  name: "ccbill",
  async createCheckoutSession(input: CreateTopUpCheckoutInput) {
    const config = getConfig();
    const amount = fixedTwo(input.amount);
    const formDigest = md5(
      `${amount}${config.initialPeriod}${config.currencyCode}${config.formSalt}`,
    );

    const url = new URL(
      `${config.baseUrl.replace(/\/$/, "")}/${config.flexFormId}`,
    );
    url.searchParams.set("clientSubacc", config.clientSubacc);
    url.searchParams.set("initialPrice", amount);
    url.searchParams.set("initialPeriod", config.initialPeriod);
    url.searchParams.set("currencyCode", config.currencyCode);
    url.searchParams.set("formDigest", formDigest);
    url.searchParams.set("language", config.language);
    url.searchParams.set("X-depositId", input.depositId);
    url.searchParams.set("X-userId", input.user.id);
    url.searchParams.set("X-sessionId", input.providerSessionId);
    url.searchParams.set("X-product", `${APP_NAME} balance`);
    appendIfPresent(url.searchParams, "email", input.email);

    return {
      provider: "ccbill",
      providerSessionId: input.providerSessionId,
      url: url.toString(),
    };
  },
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function eventField(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = asString(payload[key]);
    if (value) return value;
  }
  return undefined;
}

function eventAmount(payload: Record<string, unknown>) {
  const value = eventField(
    payload,
    "billedInitialPrice",
    "initialPrice",
    "accountingAmount",
    "amount",
  );
  return value ? normalizeMoney(value) : undefined;
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyCcbillWebhookSecret(req: Request) {
  const secret = optionalEnv("CCBILL_WEBHOOK_SECRET");
  if (!secret) return;

  const url = new URL(req.url);
  const received =
    req.headers.get("x-ccbill-webhook-secret") ??
    url.searchParams.get("secret") ??
    "";
  if (!safeEquals(received, secret)) {
    throw new Error("Invalid CCBill webhook secret");
  }
}

export async function parseCcbillWebhook(
  req: Request,
): Promise<NormalizedPaymentEvent> {
  verifyCcbillWebhookSecret(req);

  const url = new URL(req.url);
  const contentType = req.headers.get("content-type") ?? "";
  const rawPayload = contentType.includes("application/json")
    ? ((await req.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries(new URLSearchParams(await req.text()));

  const payload = {
    ...rawPayload,
    eventType: eventField(rawPayload, "eventType") ?? url.searchParams.get("eventType"),
    eventGroupType:
      eventField(rawPayload, "eventGroupType") ??
      url.searchParams.get("eventGroupType"),
    clientAccnum:
      eventField(rawPayload, "clientAccnum") ?? url.searchParams.get("clientAccnum"),
    clientSubacc:
      eventField(rawPayload, "clientSubacc") ?? url.searchParams.get("clientSubacc"),
  } as Record<string, unknown>;

  const configuredClientAccnum = optionalEnv("CCBILL_CLIENT_ACCNUM");
  const configuredSubacc = optionalEnv("CCBILL_CLIENT_SUBACC");
  const clientAccnum = eventField(payload, "clientAccnum");
  const clientSubacc = eventField(payload, "clientSubacc");
  if (configuredClientAccnum && clientAccnum !== configuredClientAccnum) {
    throw new Error("CCBill client account mismatch");
  }
  if (configuredSubacc && clientSubacc !== configuredSubacc) {
    throw new Error("CCBill subaccount mismatch");
  }

  const eventType = eventField(payload, "eventType") ?? "";
  const depositId = eventField(payload, "X-depositId", "depositId");
  const providerTransactionId = eventField(payload, "transactionId");
  const providerCustomerId = eventField(payload, "subscriptionId");
  const providerPaymentMethodId = eventField(payload, "paymentAccount");
  const amount = eventAmount(payload);
  const currency = eventField(payload, "currency", "accountingCurrency");

  if (eventType === "NewSaleSuccess" || eventType === "ManualAdd") {
    if (!depositId) throw new Error("CCBill success webhook missing deposit id");
    if (!providerTransactionId) {
      throw new Error("CCBill success webhook missing transaction id");
    }
    return {
      type: "payment_succeeded",
      provider: "ccbill",
      depositId,
      providerTransactionId,
      amount,
      currency,
      providerCustomerId,
      providerPaymentMethodId,
      raw: payload,
    };
  }

  if (eventType === "NewSaleFailure") {
    return {
      type: "payment_failed",
      provider: "ccbill",
      depositId,
      providerTransactionId,
      reason: eventField(payload, "failureReason", "reason"),
      raw: payload,
    };
  }

  if (eventType === "Refund" || eventType === "Void" || eventType === "Return") {
    if (!providerTransactionId) {
      throw new Error("CCBill refund webhook missing transaction id");
    }
    return {
      type: "payment_refunded",
      provider: "ccbill",
      depositId,
      providerTransactionId,
      amount,
      currency,
      reason: eventField(payload, "reason"),
      raw: payload,
    };
  }

  if (eventType === "Chargeback") {
    if (!providerTransactionId) {
      throw new Error("CCBill chargeback webhook missing transaction id");
    }
    return {
      type: "chargeback_opened",
      provider: "ccbill",
      depositId,
      providerTransactionId,
      amount,
      currency,
      reason: eventField(payload, "reason"),
      raw: payload,
    };
  }

  return {
    type: "payment_failed",
    provider: "ccbill",
    depositId,
    providerTransactionId,
    reason: eventType ? `Unhandled CCBill event: ${eventType}` : "Unknown CCBill event",
    raw: payload,
  };
}
