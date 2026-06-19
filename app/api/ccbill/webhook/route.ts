import {
  markTopUpDepositFailed,
  reverseTopUpDeposit,
} from "@/lib/custodial";
import { finalizeTopUpDepositWithTempoFunding } from "@/lib/custodial-wallets";
import { parseCcbillWebhook } from "@/lib/payments/ccbill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleSucceeded(event: Awaited<ReturnType<typeof parseCcbillWebhook>>) {
  if (event.type !== "payment_succeeded") return null;

  return finalizeTopUpDepositWithTempoFunding({
    depositId: event.depositId,
    provider: event.provider,
    providerTransactionId: event.providerTransactionId,
    providerCustomerId: event.providerCustomerId,
    providerPaymentMethodId: event.providerPaymentMethodId,
    amount: event.amount,
    currency: event.currency,
    rawProviderEvent: event.raw,
  });
}

export async function POST(req: Request) {
  try {
    const event = await parseCcbillWebhook(req);

    if (event.type === "payment_succeeded") {
      const result = await handleSucceeded(event);
      return Response.json({ received: true, result });
    }

    if (event.type === "payment_failed") {
      const result = await markTopUpDepositFailed({
        depositId: event.depositId,
        providerTransactionId: event.providerTransactionId,
        reason: event.reason,
        rawProviderEvent: event.raw,
      });
      return Response.json({ received: true, result });
    }

    if (event.type === "payment_refunded" || event.type === "chargeback_opened") {
      const result = await reverseTopUpDeposit({
        depositId: event.depositId,
        providerTransactionId: event.providerTransactionId,
        reason: event.reason,
        status: event.type === "chargeback_opened" ? "chargeback" : "refunded",
        rawProviderEvent: event.raw,
      });
      return Response.json({ received: true, result });
    }

    return Response.json({ received: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 400 },
    );
  }
}
