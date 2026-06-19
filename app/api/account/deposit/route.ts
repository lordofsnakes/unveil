import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  CUSTODIAL_ACCOUNT_COOKIE,
  createPendingTopUpDeposit,
  getOrCreateCustodialAccount,
  normalizeMoney,
} from "@/lib/custodial";
import { ensureUserTempoWallet } from "@/lib/custodial-wallets";
import {
  type AppUser,
  getCurrentAppUser,
  requireCurrentAppUser,
  setAccountCookie,
  unauthorizedJson,
  UnauthorizedError,
} from "@/lib/app-user";
import { getTopUpProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonWithAccountCookie(
  body: Record<string, unknown>,
  userId: string,
  init?: ResponseInit,
) {
  return setAccountCookie(NextResponse.json(body, init), userId);
}

function providerSessionId(provider: string) {
  return `${provider}_${Date.now()}_${randomBytes(8).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { amount?: string };
  let userId: string | null = null;

  try {
    const provider = getTopUpProvider();
    const user =
      provider.name === "mock"
        ? await getMockTopUpUser()
        : await requireCurrentAppUser();
    userId = user.id;
    const amount = normalizeMoney(body.amount ?? "25");
    const cents = Math.round(Number(amount) * 100);
    if (cents < 100 || cents > 50000) {
      throw new Error("Deposit amount must be between $1 and $500");
    }

    const wallet =
      provider.name === "ccbill" ? await ensureUserTempoWallet(user.id) : null;
    const sessionId = providerSessionId(provider.name);
    const deposit = await createPendingTopUpDeposit({
      userId: user.id,
      amount,
      currency: "usd",
      provider: provider.name,
      providerSessionId: sessionId,
      destinationWalletAddress: wallet?.address,
      metadata: {
        intent: "balance_topup",
      },
    });

    const session = await provider.createCheckoutSession({
      user,
      depositId: deposit.id,
      providerSessionId: sessionId,
      amount,
      currency: "usd",
      email: user.email,
    });

    return jsonWithAccountCookie({ url: session.url }, user.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedJson();
    const body = { error: err instanceof Error ? err.message : "Deposit failed" };
    if (!userId) return NextResponse.json(body, { status: 400 });
    return jsonWithAccountCookie(body, userId, { status: 400 });
  }
}

async function getMockTopUpUser(): Promise<AppUser> {
  const current = await getCurrentAppUser();
  if (current) return current;

  const cookieStore = await cookies();
  const account = await getOrCreateCustodialAccount(
    cookieStore.get(CUSTODIAL_ACCOUNT_COOKIE)?.value,
  );

  return {
    id: account.userId,
    walletAddress: "0x0000000000000000000000000000000000000000",
    clerkId: null,
    email: null,
    displayName: "Guest",
    imageUrl: null,
    tempoVirtualAddress: null,
    username: null,
    avatar: null,
    isCreator: false,
    createdAt: new Date(),
  };
}
