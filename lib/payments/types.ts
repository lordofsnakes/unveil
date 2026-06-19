import type { AppUser } from "@/lib/app-user";

export type TopUpProviderName = "ccbill" | "mock";

export type CreateTopUpCheckoutInput = {
  user: AppUser;
  depositId: string;
  providerSessionId: string;
  amount: string;
  currency: "usd";
  email?: string | null;
};

export type TopUpCheckoutSession = {
  url: string;
  provider: TopUpProviderName;
  providerSessionId: string;
};

export type NormalizedPaymentEvent =
  | {
      type: "payment_succeeded";
      provider: TopUpProviderName;
      depositId: string;
      providerTransactionId: string;
      amount?: string;
      currency?: string;
      providerCustomerId?: string;
      providerPaymentMethodId?: string;
      raw: Record<string, unknown>;
    }
  | {
      type: "payment_failed";
      provider: TopUpProviderName;
      depositId?: string;
      providerTransactionId?: string;
      reason?: string;
      raw: Record<string, unknown>;
    }
  | {
      type: "payment_refunded" | "chargeback_opened";
      provider: TopUpProviderName;
      depositId?: string;
      providerTransactionId: string;
      amount?: string;
      currency?: string;
      reason?: string;
      raw: Record<string, unknown>;
    };

export type TopUpProvider = {
  name: TopUpProviderName;
  createCheckoutSession(
    input: CreateTopUpCheckoutInput,
  ): Promise<TopUpCheckoutSession>;
};
