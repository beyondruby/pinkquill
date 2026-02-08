import type { Metadata } from "next";
import CommissionOrderView from "@/components/commissions/CommissionOrder";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;

  return {
    title: "Commission Order | Quill",
    description: "Track status, revisions, and delivery for your commission order.",
  };
}

export default async function CommissionOrderPage({ params }: Props) {
  const { id } = await params;
  return <CommissionOrderView orderId={id} />;
}
