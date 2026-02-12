import type { Metadata } from "next";
import BuyerDashboard from "@/components/orders/BuyerDashboard";

export const metadata: Metadata = {
  title: "Buyers Dashboard | Quill",
  description: "Track your purchases, commission orders, and order history.",
};

export default function OrdersPage() {
  return <BuyerDashboard />;
}
