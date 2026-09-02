"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import AuthUnavailable from "@/components/auth/AuthUnavailable";
import { useProduct } from "@/lib/hooks/useProducts";
import CreateProductWizard from "@/components/store/CreateProduct/CreateProductWizard";
import CreateCommissionWizard from "@/components/commissions/CreateCommission/CreateCommissionWizard";
import Loading from "@/components/ui/Loading";

interface EditListingPageProps {
  listingId: string;
}

export default function EditListingPage({ listingId }: EditListingPageProps) {
  const router = useRouter();
  const { user, loading: authLoading, status: authStatus, isAnonymous } = useAuth();
  const { product, loading: listingLoading, error } = useProduct(listingId);

  useEffect(() => {
    if (isAnonymous) {
      router.replace("/login");
    }
  }, [isAnonymous, router]);

  if (authStatus === "unknown") {
    return <AuthUnavailable />;
  }

  if (authLoading || listingLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loading text="Opening your listing" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-display text-ink">Listing Not Found</h1>
          <p className="mt-2 text-sm font-body text-muted">
            {error || "This listing may have been deleted or is no longer available."}
          </p>
          <Link
            href="/seller/listings"
            className="mt-6 inline-flex items-center rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid px-5 py-2.5 text-sm font-ui font-semibold text-white"
          >
            Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  if (product.seller_id !== user.id) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-display text-ink">Not Authorized</h1>
          <p className="mt-2 text-sm font-body text-muted">
            You can only edit your own listings.
          </p>
          <Link
            href="/seller/listings"
            className="mt-6 inline-flex items-center rounded-full border border-border-strong px-5 py-2.5 text-sm font-ui font-semibold text-ink hover:bg-subtle"
          >
            Go to My Listings
          </Link>
        </div>
      </div>
    );
  }

  if (product.listing_type === "service") {
    return <CreateCommissionWizard mode="edit" productId={product.id} initialProduct={product} />;
  }

  return <CreateProductWizard mode="edit" productId={product.id} initialProduct={product} />;
}
