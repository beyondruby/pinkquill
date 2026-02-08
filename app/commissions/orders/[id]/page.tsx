import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

// Redirect old commission order URLs to the new unified orders page
export default async function CommissionOrderPage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}`);
}
