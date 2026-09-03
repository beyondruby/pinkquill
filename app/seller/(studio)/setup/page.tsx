import type { Metadata } from "next";
import SellerSetupWizard from "@/components/seller/SellerSetupWizard";

export const metadata: Metadata = {
  title: "Seller Setup | Quill",
  description: "Set up your seller store on Quill.",
};

export default function SellerSetupPage() {
  return <SellerSetupWizard />;
}
