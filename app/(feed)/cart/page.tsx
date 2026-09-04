import type { Metadata } from "next";
import StudioCartPage from "@/components/queue/StudioQueuePage";

export const metadata: Metadata = {
  title: "Bag | PinkQuill",
  description: "Collect commissions and products, then launch each order with your brief and delivery details.",
};

export default function CartPage() {
  return <StudioCartPage />;
}
