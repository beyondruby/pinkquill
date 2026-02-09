import type { Metadata } from "next";
import StudioQueuePage from "@/components/queue/StudioQueuePage";

export const metadata: Metadata = {
  title: "Studio Queue | Quill",
  description: "Collect creations and launch orders with briefs, delivery details, and placeholder payment confirmation.",
};

export default function QueuePage() {
  return <StudioQueuePage />;
}
