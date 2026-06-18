import { NextRequest, NextResponse } from "next/server";
import {
  CUSTODIAL_ACCOUNT_COOKIE,
  getOrCreateCustodialAccount,
} from "@/lib/custodial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withAccountCookie<T extends Record<string, unknown>>(
  body: T,
  userId: string,
  init?: ResponseInit,
) {
  const res = NextResponse.json(body, init);
  res.cookies.set(CUSTODIAL_ACCOUNT_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const account = await getOrCreateCustodialAccount(
    req.cookies.get(CUSTODIAL_ACCOUNT_COOKIE)?.value,
  );

  return withAccountCookie({ account }, account.userId);
}

export async function POST(req: NextRequest) {
  const account = await getOrCreateCustodialAccount(
    req.cookies.get(CUSTODIAL_ACCOUNT_COOKIE)?.value,
  );

  return withAccountCookie(
    { error: "Use checkout to add funds" },
    account.userId,
    { status: 410 },
  );
}
