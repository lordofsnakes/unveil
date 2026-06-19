"use client";

import { useAuth } from "@clerk/nextjs";
import { Onboarding } from "./Onboarding";

/** Optional auth gate for views that intentionally want an inline sign-in wall. */
export function ConnectGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded || isSignedIn) return null;
  return <Onboarding />;
}
