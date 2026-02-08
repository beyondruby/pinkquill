import type { Metadata } from "next";
import BuyerOrdersList from "@/components/orders/BuyerOrdersList";

export const metadata: Metadata = {
  title: "My Orders | Quill",
  description: "Track your purchases and commission orders.",
};

export default function OrdersPage() {
  return <BuyerOrdersList />;
}
