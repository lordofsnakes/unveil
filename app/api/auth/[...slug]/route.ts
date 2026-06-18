import { APP_URL } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * SIWE session handler for the Tempo wallet. Issues a challenge, verifies the
 * signature, and exposes `handler.getSession(req)` for protecting routes.
 *
 * NOTE: Kv.memory() loses sessions on every cold start — fine for the demo,
 * swap for a durable Kv (e.g. Kv.durableObject) in production.
 */
let handlerPromise: Promise<{ fetch: (req: Request) => Response | Promise<Response> }> | null =
  null;

async function getHandler() {
  handlerPromise ??= import("accounts/server").then(({ Handler, Kv }) =>
    Handler.auth({
      origin: APP_URL,
      store: Kv.memory(),
    }),
  );
  return handlerPromise;
}

export async function GET(req: Request) {
  const handler = await getHandler();
  return handler.fetch(req);
}

export const POST = GET;
