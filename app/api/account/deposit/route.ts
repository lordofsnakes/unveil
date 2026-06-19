import { NextRequest, NextResponse } from "next/server";
import {
  normalizeMoney,
  recordPendingCardDeposit,
} from "@/lib/custodial";
import {
  requireCurrentAppUser,
  setAccountCookie,
  unauthorizedJson,
  UnauthorizedError,
} from "@/lib/app-user";
import { createStripeOnrampSession } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DESTINATION_CURRENCY = "usdc";
const DEFAULT_DESTINATION_NETWORK = "base";

function jsonWithAccountCookie(
  body: Record<string, unknown>,
  userId: string,
  init?: ResponseInit,
) {
  return setAccountCookie(NextResponse.json(body, init), userId);
}

function platformWalletAddress() {
  const wallet =
    process.env.STRIPE_ONRAMP_WALLET_ADDRESS ??
    process.env.PLATFORM_WALLET_ADDRESS ??
    process.env.NEXT_PUBLIC_PLATFORM_WALLET;

  if (!wallet) throw new Error("STRIPE_ONRAMP_WALLET_ADDRESS is not set");
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error("Stripe onramp wallet address must be a valid EVM address");
  }

  return wallet;
}

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { amount?: string };
  let userId: string | null = null;

  try {
    const user = await requireCurrentAppUser();
    userId = user.id;
    const amount = normalizeMoney(body.amount ?? "25");
    const cents = Math.round(Number(amount) * 100);
    if (cents < 100 || cents > 50000) {
      throw new Error("Deposit amount must be between $1 and $500");
    }

    const destinationCurrency =
      process.env.STRIPE_ONRAMP_DESTINATION_CURRENCY ??
      DEFAULT_DESTINATION_CURRENCY;
    const destinationNetwork =
      process.env.STRIPE_ONRAMP_DESTINATION_NETWORK ??
      DEFAULT_DESTINATION_NETWORK;

    const session = await createStripeOnrampSession({
      wallet_addresses: {
        [destinationNetwork]: platformWalletAddress(),
      },
      lock_wallet_address: true,
      source_currency: "usd",
      source_amount: amount,
      destination_currency: destinationCurrency,
      destination_currencies: [destinationCurrency],
      destination_network: destinationNetwork,
      destination_networks: [destinationNetwork],
      customer_ip_address: clientIp(req),
      metadata: {
        userId: user.id,
        amount,
        currency: "usd",
      },
    });

    if (!session.redirect_url) {
      throw new Error("Stripe did not return an onramp redirect URL");
    }

    await recordPendingCardDeposit({
      userId: user.id,
      amount,
      currency: "usd",
      providerSessionId: session.id,
    });

    return jsonWithAccountCookie({ url: session.redirect_url }, user.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedJson();
    const body = { error: err instanceof Error ? err.message : "Deposit failed" };
    if (!userId) return NextResponse.json(body, { status: 400 });
    return jsonWithAccountCookie(body, userId, { status: 400 });
  }
}
