import { NextResponse } from "next/server";
import { getOrCreateCustodialAccount } from "@/lib/custodial";
import {
  requireCurrentAppUser,
  setAccountCookie,
  unauthorizedJson,
  UnauthorizedError,
} from "@/lib/app-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonWithAccountCookie(
  body: Record<string, unknown>,
  userId: string,
  init?: ResponseInit,
) {
  return setAccountCookie(NextResponse.json(body, init), userId);
}

export async function GET() {
  try {
    const user = await requireCurrentAppUser();
    const account = await getOrCreateCustodialAccount(user.id);
    return jsonWithAccountCookie({ account }, user.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedJson();
    throw err;
  }
}

export async function POST() {
  try {
    const user = await requireCurrentAppUser();
    return jsonWithAccountCookie(
      { error: "Use checkout to add funds" },
      user.id,
      { status: 410 },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedJson();
    throw err;
  }
}
