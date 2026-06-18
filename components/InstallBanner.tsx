"use client";

import { useState, useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Not available on iOS, already installed, or user dismissed.
  if (!prompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-white p-4 text-black shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Install Veil</p>
        <button
          onClick={() => setDismissed(true)}
          className="text-sm text-gray-500"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <button
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
        className="mt-2 w-full rounded-xl bg-black py-2 font-semibold text-white"
      >
        Add to Home Screen
      </button>
    </div>
  );
}
