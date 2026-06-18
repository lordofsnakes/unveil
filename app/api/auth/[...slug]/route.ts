import { Handler, Kv } from "accounts/server";
import { APP_URL } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * SIWE session handler for the Tempo wallet. Issues a challenge, verifies the
 * signature, and exposes `handler.getSession(req)` for protecting routes.
 *
 * NOTE: Kv.memory() loses sessions on every cold start — fine for the demo,
 * swap for a durable Kv (e.g. Kv.durableObject) in production.
 */
const handler = Handler.auth({
  origin: APP_URL,
  store: Kv.memory(),
});

export const GET = handler.fetch;
export const POST = handler.fetch;
