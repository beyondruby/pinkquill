"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FullPageLoading } from "@/components/ui/Loading";

/**
 * Phase 3e: payout setup lives on the settings page. This route stays only
 * because Stripe's onboarding return URL points here (`?success=true`);
 * the stripe provider's return URL is part of the frozen money code.
 */
export default function SellerOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const returned = searchParams.get("success") === "true" || searchParams.get("refresh") === "true";
    router.replace(returned ? "/seller/settings?stripe=returned#payouts" : "/seller/settings#payouts");
  }, [router, searchParams]);
  return <FullPageLoading text="Opening settings" />;
}
