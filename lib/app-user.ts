import "server-only";

import { currentUser, auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CUSTODIAL_ACCOUNT_COOKIE } from "./custodial";
import { DEV_AUTH_COOKIE, DEV_USER_PROFILE, isValidDevAuthCookie } from "./dev-session";
import {
  attachAnonymousCustodialAccountToClerk,
  type ClerkUserInput,
} from "./db/queries";
import type { users } from "./db/schema";
import { ensureUserTempoWallet } from "./custodial-wallets";

export type AppUser = typeof users.$inferSelect;

export class UnauthorizedError extends Error {
  constructor(message = "Sign in required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function primaryEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  const primaryId = user?.primaryEmailAddressId;
  return (
    user?.emailAddresses.find((email) => email.id === primaryId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null
  );
}

function displayName(user: Awaited<ReturnType<typeof currentUser>>) {
  return (
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    null
  );
}

function clerkInput(
  clerkId: string,
  user: Awaited<ReturnType<typeof currentUser>>,
): ClerkUserInput {
  return {
    clerkId,
    email: primaryEmail(user),
    displayName: displayName(user),
    imageUrl: user?.imageUrl ?? null,
  };
}

export async function getCurrentAppUser() {
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get(CUSTODIAL_ACCOUNT_COOKIE)?.value;

  if (isValidDevAuthCookie(cookieStore.get(DEV_AUTH_COOKIE)?.value)) {
    const user = await attachAnonymousCustodialAccountToClerk({
      cookieUserId,
      clerkUser: DEV_USER_PROFILE,
    });
    await ensureUserTempoWallet(user.id);
    return user;
  }

  const session = await auth();
  if (!session.userId) return null;

  const user = await currentUser();
  const appUser = await attachAnonymousCustodialAccountToClerk({
    cookieUserId,
    clerkUser: clerkInput(session.userId, user),
  });
  await ensureUserTempoWallet(appUser.id);
  return appUser;
}

export async function isCurrentAppUserAuthenticated() {
  const cookieStore = await cookies();
  if (isValidDevAuthCookie(cookieStore.get(DEV_AUTH_COOKIE)?.value)) return true;

  const session = await auth();
  return !!session.userId;
}

export async function requireCurrentAppUser() {
  const user = await getCurrentAppUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function accountCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export function setAccountCookie<T extends NextResponse>(
  res: T,
  userId: string,
) {
  res.cookies.set(CUSTODIAL_ACCOUNT_COOKIE, userId, accountCookieOptions());
  return res;
}

export function unauthorizedJson(message = "Sign in required") {
  return Response.json({ error: message }, { status: 401 });
}
