"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppAuth, useAppUser } from "./useAppAuth";

// localStorage key that snoozes the enrollment prompt. Stores a future epoch-ms
// timestamp; while `Date.now()` is below it, the prompt stays hidden.
const REMIND_AFTER_KEY = "veil:passkey-remind-after";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Fired after a passkey is created so every mounted instance (prompt, settings,
// notifications) re-reads dismissal state and re-renders.
export const PASSKEY_CREATED_EVENT = "veil:passkey-created";
// Fired when the "Later" snooze changes so sibling instances stay in sync
// within the same tab (the native `storage` event only crosses tabs).
const REMIND_CHANGED_EVENT = "veil:passkey-remind-changed";

// Minimal view of the Clerk `UserResource` surface we touch. The dev-auth user
// object has none of these methods, which is how we tell the two apart.
type EnrollableUser = {
  passkeys?: { id: string }[];
  createPasskey: () => Promise<unknown>;
  reload: () => Promise<unknown>;
};

function isEnrollableUser(user: unknown): user is EnrollableUser {
  return (
    typeof user === "object" &&
    user !== null &&
    typeof (user as { createPasskey?: unknown }).createPasskey === "function"
  );
}

function readRemindAfter(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(REMIND_AFTER_KEY);
    const ts = raw ? Number(raw) : 0;
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

function writeRemindAfter(value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(REMIND_AFTER_KEY);
    else window.localStorage.setItem(REMIND_AFTER_KEY, String(value));
  } catch {
    // Private mode / storage disabled — dismissal just won't persist.
  }
  window.dispatchEvent(new Event(REMIND_CHANGED_EVENT));
}

// Maps a thrown enrollment error to either a silent success (passkey already
// existed) or a user-facing message. Reads Clerk's machine-stable `.code` and
// falls back to the native WebAuthn `DOMException` name.
function classifyEnrollError(err: unknown): { alreadyExists: boolean; message: string } {
  const code = (err as { code?: string } | null)?.code;
  const name = (err as { name?: string } | null)?.name;

  if (code === "passkey_already_exists") {
    return { alreadyExists: true, message: "" };
  }
  if (
    code === "passkey_registration_cancelled" ||
    code === "passkey_retrieval_cancelled" ||
    code === "passkey_operation_aborted" ||
    name === "NotAllowedError" ||
    name === "AbortError"
  ) {
    return { alreadyExists: false, message: "Passkey setup was canceled." };
  }
  if (
    code === "passkey_not_supported" ||
    code === "passkey_pa_not_supported" ||
    code === "passkey_invalid_rpID_or_domain" ||
    name === "NotSupportedError" ||
    name === "SecurityError"
  ) {
    return {
      alreadyExists: false,
      message: "Passkeys are not supported on this browser or device.",
    };
  }
  return { alreadyExists: false, message: "Could not add passkey. Please try again." };
}

export type PasskeyEnrollment = {
  isLoaded: boolean;
  isSignedIn: boolean;
  hasPasskey: boolean;
  canEnroll: boolean;
  isPending: boolean;
  error: string | null;
  success: boolean;
  enrollPasskey: () => Promise<void>;
  dismissPrompt: () => void;
  isDismissed: boolean;
};

export function usePasskeyEnrollment(): PasskeyEnrollment {
  const { isLoaded: authLoaded, isSignedIn, isDevSignedIn } = useAppAuth();
  const { isLoaded: userLoaded, user } = useAppUser();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [remindAfter, setRemindAfter] = useState(0);

  // Read dismissal on mount and stay in sync with sibling instances + other tabs.
  useEffect(() => {
    const sync = () => setRemindAfter(readRemindAfter());
    sync();
    window.addEventListener(REMIND_CHANGED_EVENT, sync);
    window.addEventListener(PASSKEY_CREATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMIND_CHANGED_EVENT, sync);
      window.removeEventListener(PASSKEY_CREATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Dev-auth users are local/test accounts with no Clerk identity, so Clerk
  // passkey enrollment never applies to them.
  const enrollableUser =
    !isDevSignedIn && isEnrollableUser(user) ? user : null;
  const hasPasskey = Boolean(enrollableUser?.passkeys?.length);
  const isLoaded = Boolean(authLoaded) && Boolean(userLoaded);
  const canEnroll =
    isLoaded && isSignedIn === true && Boolean(enrollableUser) && !hasPasskey;
  const isDismissed = remindAfter > Date.now();

  const dismissPrompt = useCallback(() => {
    setRemindAfter(Date.now() + SEVEN_DAYS_MS);
    writeRemindAfter(Date.now() + SEVEN_DAYS_MS);
  }, []);

  const enrollPasskey = useCallback(async () => {
    // No-op when there is no real Clerk user to enroll (signed out or dev-auth).
    if (!enrollableUser) return;
    setIsPending(true);
    setError(null);
    try {
      await enrollableUser.createPasskey();
      await enrollableUser.reload();
      setSuccess(true);
      writeRemindAfter(null);
      window.dispatchEvent(new Event(PASSKEY_CREATED_EVENT));
    } catch (err) {
      const { alreadyExists, message } = classifyEnrollError(err);
      if (alreadyExists) {
        // A passkey already exists for this account — converge to the enrolled
        // state instead of surfacing an error.
        await enrollableUser.reload().catch(() => {});
        setSuccess(true);
        writeRemindAfter(null);
        window.dispatchEvent(new Event(PASSKEY_CREATED_EVENT));
      } else {
        setError(message);
      }
    } finally {
      setIsPending(false);
    }
  }, [enrollableUser]);

  return {
    isLoaded,
    isSignedIn: isSignedIn === true,
    hasPasskey,
    canEnroll,
    isPending,
    error,
    success,
    enrollPasskey,
    dismissPrompt,
    isDismissed,
  };
}
