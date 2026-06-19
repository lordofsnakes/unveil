import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Unveil collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-6 pb-16">
      <Link
        href="/"
        className="text-faint hover:text-text mb-6 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft size={18} /> Back
      </Link>
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="text-faint mt-1 text-sm">Last updated: June 19, 2026</p>

      <div className="text-muted mt-6 flex flex-col gap-5 text-[15px] leading-relaxed">
        <p>
          This policy explains what we collect, why, and the choices you have.
          We collect only what we need to run Unveil.
        </p>
        <section>
          <h2 className="text-text mb-1 text-base font-semibold">
            What we collect
          </h2>
          <p>
            Account details (email, authentication identifiers), content you
            upload, and payment/transaction records needed to process unlocks.
          </p>
        </section>
        <section>
          <h2 className="text-text mb-1 text-base font-semibold">
            How we use it
          </h2>
          <p>
            To authenticate you, deliver and gate content, process payments, and
            keep the platform safe. We do not sell your personal data.
          </p>
        </section>
        <section>
          <h2 className="text-text mb-1 text-base font-semibold">Your rights</h2>
          <p>
            You may request access to or deletion of your account data, subject
            to legal retention requirements.
          </p>
        </section>
        <p className="text-faint text-[13px]">
          This is a placeholder summary and is not legal advice. Replace it with
          your reviewed Privacy Policy before launch.
        </p>
      </div>
    </main>
  );
}
