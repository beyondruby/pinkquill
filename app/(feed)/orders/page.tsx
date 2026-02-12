import type { Metadata } from "next";
import BuyerDashboard from "@/components/orders/BuyerDashboard";

export const metadata: Metadata = {
  title: "My Orders | Quill",
  description: "Track your purchases and commission orders.",
};

export default function OrdersPage() {
  return <BuyerDashboard />;
}
