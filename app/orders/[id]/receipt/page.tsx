import type { Metadata } from "next";
import OrderReceipt from "@/components/orders/OrderReceipt";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Receipt | Quill",
  description: "What was paid for this order, line by line.",
};

// Outside the feed layout on purpose: this is a printable document.
export default async function OrderReceiptPage({ params }: Props) {
  const { id } = await params;
  return <OrderReceipt orderId={id} />;
}
