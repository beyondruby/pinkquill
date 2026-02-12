import type { Metadata } from "next";
import StudioCartPage from "@/components/queue/StudioQueuePage";

export const metadata: Metadata = {
  title: "Studio Cart | Quill",
  description: "Collect creations and launch orders with briefs, delivery details, and payment.",
};

export default function CartPage() {
  return <StudioCartPage />;
}
