import "server-only";

import { APP_URL } from "@/lib/constants";
import type { TopUpProvider } from "./types";

export const mockProvider: TopUpProvider = {
  name: "mock",
  async createCheckoutSession(input) {
    const url = new URL("/payment-cards", APP_URL);
    url.searchParams.set("mockDeposit", input.depositId);
    url.searchParams.set("amount", input.amount);

    return {
      provider: "mock",
      providerSessionId: input.providerSessionId,
      url: url.toString(),
    };
  },
};
