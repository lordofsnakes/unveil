import "server-only";

import { ccbillProvider } from "./ccbill";
import { mockProvider } from "./mock";
import type { TopUpProvider, TopUpProviderName } from "./types";

const providers: Record<TopUpProviderName, TopUpProvider> = {
  ccbill: ccbillProvider,
  mock: mockProvider,
};

export function getTopUpProvider() {
  const configured = process.env.TOPUP_PROVIDER ?? "mock";
  if (configured !== "ccbill" && configured !== "mock") {
    throw new Error(`Unsupported TOPUP_PROVIDER: ${configured}`);
  }
  return providers[configured];
}

export type { NormalizedPaymentEvent } from "./types";
