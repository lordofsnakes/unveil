import "server-only";

import { currentUser, auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CUSTODIAL_ACCOUNT_COOKIE } from "./custodial";
import {
  attachAnonymousCustodialAccountToClerk,
  type ClerkUserInput,
} from "./db/queries";
import type { users } from "./db/schema";

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
  const session = await auth();
  if (!session.userId) return null;

  const [cookieStore, user] = await Promise.all([cookies(), currentUser()]);
  const cookieUserId = cookieStore.get(CUSTODIAL_ACCOUNT_COOKIE)?.value;
  return attachAnonymousCustodialAccountToClerk({
    cookieUserId,
    clerkUser: clerkInput(session.userId, user),
  });
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
