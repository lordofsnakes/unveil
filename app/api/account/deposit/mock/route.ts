import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { setAccountCookie } from "@/lib/app-user";
import { finalizeTopUpDepositWithTempoFunding } from "@/lib/custodial-wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      depositId?: string;
    };
    if (!body.depositId) {
      throw new Error("Missing deposit");
    }

    // Mock card success behaves exactly like the CCBill webhook: the platform
    // wallet actually sends the deposit amount (+ fee reserve) of AlphaUSD to the
    // user's custodial Tempo wallet, and the local balance is credited only after
    // that on-chain funding succeeds. This is what makes the demo show a real
    // transfer from the protocol wallet to the user wallet.
    const result = await finalizeTopUpDepositWithTempoFunding({
      depositId: body.depositId,
      provider: "mock",
      providerTransactionId: `mock_${randomBytes(12).toString("hex")}`,
      providerPaymentMethodId: "mock_card_4242",
      rawProviderEvent: {
        eventType: "MockSaleSuccess",
      },
    });

    const res = NextResponse.json(
      { result },
      { status: result.status === "funding_failed" ? 502 : 200 },
    );
    return result.userId ? setAccountCookie(res, result.userId) : res;
  } catch (err) {
    const body = { error: err instanceof Error ? err.message : "Mock deposit failed" };
    return Response.json(body, { status: 400 });
  }
}
