import AdminDisputeDetail from "@/components/admin/AdminDisputeDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminDisputeDetail disputeId={id} />;
}
