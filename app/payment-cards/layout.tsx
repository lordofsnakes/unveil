import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment cards" };

export default function PaymentCardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
