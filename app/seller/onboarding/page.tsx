import type { Metadata } from "next";
import SellerOnboarding from "@/components/seller/SellerOnboarding";

export const metadata: Metadata = {
  title: "Become a Seller | Quill",
  description: "Set up your seller account and start earning from your creative work.",
};

export default function SellerOnboardingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] py-12 px-4">
      <SellerOnboarding />
    </div>
  );
}
