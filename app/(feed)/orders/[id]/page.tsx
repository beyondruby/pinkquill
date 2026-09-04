import type { Metadata } from "next";
import OrderPage from "@/components/orders/OrderPage";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;

  return {
    title: "Order | PinkQuill",
    description: "Track your order, review deliveries, and message the other side.",
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <OrderPage orderId={id} />;
}
