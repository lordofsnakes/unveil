"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Onboarding } from "./Onboarding";

/**
 * Shows the onboarding hero until the user connects (or chooses to browse).
 * Once connected the gate stays dismissed for the session.
 */
export function ConnectGate() {
  const account = useAccount();
  const [skipped, setSkipped] = useState(false);

  if (account.status === "connected" || skipped) return null;
  return <Onboarding onSkip={() => setSkipped(true)} />;
}
