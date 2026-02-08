import type { Metadata } from "next";
import CommissionDetailView from "@/components/commissions/CommissionDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;

  return {
    title: "Commission Service | Quill",
    description: "Hire creators for commission-based services on Quill",
  };
}

export default async function CommissionPage({ params }: Props) {
  const { id } = await params;
  return <CommissionDetailView commissionId={id} />;
}
