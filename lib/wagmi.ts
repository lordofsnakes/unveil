import { createConfig, http } from "wagmi";
import { tempoModerato } from "wagmi/chains";
import { tempoWallet } from "wagmi/connectors";
import { parseUnits } from "viem";
import { ALPHA_USD, STABLECOIN_DECIMALS, TEMPO_TESTNET } from "./constants";

function daysFromNow(days: number) {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

/**
 * Wagmi config for Veil on Tempo Moderato testnet.
 *
 * - `tempoWallet` connector: passkey / Face ID sign-in, no seed phrase.
 * - `feePayer`: Tempo's hosted testnet sponsor → transactions are gasless.
 * - `authorizeAccessKey`: at connect, the user approves a scoped $25 AlphaUSD
 *   spending key once, so subsequent unlock taps need NO biometric prompt.
 */
export const wagmiConfig = createConfig({
  chains: [tempoModerato],
  connectors: [
    tempoWallet({
      testnet: true,
      feePayer:
        process.env.NEXT_PUBLIC_FEE_PAYER_URL ?? TEMPO_TESTNET.feeSponsor,
      authorizeAccessKey: {
        expiry: daysFromNow(7),
        limits: [
          { token: ALPHA_USD, limit: parseUnits("25", STABLECOIN_DECIMALS) },
        ],
        scopes: [{ address: ALPHA_USD }],
      },
    }),
  ],
  // Prevent injected wallets (MetaMask, etc.) from hijacking the connector.
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempoModerato.id]: http(
      process.env.TEMPO_RPC_URL ?? TEMPO_TESTNET.rpcHttp,
    ),
  },
  storage: null,
  // App Router: enables cookie-based hydration of wallet state.
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
