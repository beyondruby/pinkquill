"use client";

import { useParams } from "next/navigation";
import CheckoutPage from "@/components/checkout/CheckoutPage";

export default function CheckoutRoute() {
  const params = useParams();
  const orderId = params.orderId as string;

  if (!orderId) return null;

  return <CheckoutPage orderId={orderId} />;
}
