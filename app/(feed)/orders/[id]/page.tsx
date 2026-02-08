import type { Metadata } from "next";
import OrderView from "@/components/orders/OrderView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;

  return {
    title: "Order Details | Quill",
    description: "View your order details, communicate with the creator, and track progress.",
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <OrderView orderId={id} />;
}
