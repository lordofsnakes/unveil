import Stripe from "stripe";
import { creditCardDeposit } from "@/lib/custodial";
import {
  getStripe,
  stripeWebhookSecret,
  type StripeOnrampSession,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function creditOnrampSession(session: StripeOnrampSession) {
  if (session.status !== "fulfillment_complete") return;
  const userId = session.metadata?.userId;
  if (!userId) throw new Error("Onramp session is missing userId metadata");

  const amount = session.transaction_details?.source_amount ?? session.metadata?.amount;
  if (!amount) throw new Error("Onramp session is missing source amount");

  await creditCardDeposit({
    userId,
    amount: normalizeDecimalAmount(amount),
    currency: session.transaction_details?.source_currency ?? "usd",
    providerSessionId: session.id,
    providerPaymentIntentId:
      session.transaction_details?.transaction_id ?? undefined,
  });
}

function normalizeDecimalAmount(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid onramp source amount");
  }
  return value.toFixed(8);
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      stripeWebhookSecret(),
    );
  } catch (err) {
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : "Invalid signature"}`,
      { status: 400 },
    );
  }

  if ((event.type as string) === "crypto.onramp_session_updated") {
    await creditOnrampSession(event.data.object as unknown as StripeOnrampSession);
  }

  return Response.json({ received: true });
}
