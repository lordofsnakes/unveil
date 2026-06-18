import { Handler } from "accounts/server";
import { privateKeyToAccount } from "viem/accounts";
import { APP_NAME, APP_URL } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Self-hosted fee-payer relay (step 9.2). OPTIONAL — by default the wagmi
 * connector points `feePayer` at Tempo's hosted testnet sponsor, so this
 * route is only used if you set `RELAY_PRIVATE_KEY` and point the connector
 * at `/api/relay`. The relay signs the fee-payer signature so the platform
 * covers gas and the fan only spends stablecoins.
 */
const relayHandler = (() => {
  const pk = process.env.RELAY_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return null;
  return Handler.relay({
    feePayer: {
      account: privateKeyToAccount(pk),
      name: APP_NAME,
      url: APP_URL,
      // Hackathon: sponsor everything. Restrict to unlock txns before prod.
      validate: () => true,
    },
  });
})();

export async function POST(req: Request) {
  if (!relayHandler) {
    return Response.json(
      { error: "Relay not configured — using hosted sponsor" },
      { status: 501 },
    );
  }
  return relayHandler.fetch(req);
}

export const GET = POST;
