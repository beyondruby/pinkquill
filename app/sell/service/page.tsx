import { Metadata } from "next";
import CreateCommissionWizard from "@/components/commissions/CreateCommission";

export const metadata: Metadata = {
  title: "Create Service | Quill",
  description: "Create commission services with packages, timelines, and portfolio previews.",
};

export default function SellServicePage() {
  return <CreateCommissionWizard />;
}
