import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function stripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

export type StripeOnrampSession = {
  id: string;
  object: "crypto.onramp_session";
  client_secret?: string;
  redirect_url?: string | null;
  status:
    | "initialized"
    | "rejected"
    | "requires_payment"
    | "fulfillment_processing"
    | "fulfillment_complete";
  metadata?: Record<string, string>;
  transaction_details?: {
    source_amount?: string | null;
    source_total_amount?: string | null;
    source_currency?: string | null;
    destination_amount?: string | null;
    destination_currency?: string | null;
    destination_network?: string | null;
    transaction_id?: string | null;
    wallet_address?: string | null;
    wallet_addresses?: Record<string, string | null | Record<string, string> | null>;
  };
};

export async function createStripeOnrampSession(params: Record<string, unknown>) {
  return (await getStripe().rawRequest(
    "POST",
    "/v1/crypto/onramp_sessions",
    params,
  )) as StripeOnrampSession;
}
