import type { Metadata } from "next";
import EditListingPage from "@/components/seller/EditListingPage";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Edit Listing | Quill",
    description: "Update your product or commission listing details.",
  };
}

export default async function SellEditPage({ params }: Props) {
  const { id } = await params;
  return <EditListingPage listingId={id} />;
}
