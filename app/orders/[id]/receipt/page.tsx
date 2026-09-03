import type { Metadata } from "next";
import OrderReceipt from "@/components/orders/OrderReceipt";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Invoice | Quill",
  description: "The tax invoice for this order, with a PDF to download.",
};

// Outside the feed layout on purpose: this is a printable document.
export default async function OrderReceiptPage({ params }: Props) {
  const { id } = await params;
  return <OrderReceipt orderId={id} />;
}
