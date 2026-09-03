import type { Metadata } from "next";
import PayoutStatement from "@/components/seller/PayoutStatement";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Payout statement | Quill",
  description: "The order, the fee line and the dates behind one payout.",
};

// Outside the seller studio layout on purpose: this is a printable document.
export default async function PayoutStatementPage({ params }: Props) {
  const { id } = await params;
  return <PayoutStatement payoutId={id} />;
}
