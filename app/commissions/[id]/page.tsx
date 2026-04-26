import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import CommissionDetailView from "@/components/commissions/CommissionDetail";
import { getCommissionSubcategoryLabel } from "@/lib/commissions/categories";

interface Props {
  params: Promise<{ id: string }>;
}

interface CommissionMetaRow {
  id: string;
  title: string;
  description: string | null;
  listing_type: "product" | "service";
  status: string;
  min_price: number | null;
  category: string | null;
  subcategory: string | null;
  service_metadata: Record<string, unknown> | null;
  seller: { username: string; display_name: string | null } | null;
  primary_media: { media_url: string }[];
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "";

async function fetchCommissionMeta(id: string): Promise<CommissionMetaRow | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      `
      id, title, description, listing_type, status, min_price,
      category, subcategory, service_metadata,
      seller:profiles!products_seller_id_fkey ( username, display_name ),
      primary_media:product_media ( media_url )
    `
    )
    .eq("id", id)
    .eq("primary_media.is_primary", true)
    .maybeSingle<CommissionMetaRow>();

  if (error || !data) return null;
  if (data.status !== "active") return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const commission = await fetchCommissionMeta(id);

  if (!commission) {
    return {
      title: "Commission | PinkQuill",
      description: "Hire creators for commission-based services on PinkQuill",
    };
  }

  const sellerName =
    commission.seller?.display_name ||
    commission.seller?.username ||
    "PinkQuill creator";
  const titleSuffix = sellerName ? ` by ${sellerName}` : "";
  const title = `${commission.title}${titleSuffix} | PinkQuill`;
  const headline =
    typeof commission.service_metadata?.headline === "string"
      ? (commission.service_metadata.headline as string)
      : null;
  const description =
    headline ||
    commission.description?.slice(0, 200) ||
    `Hire ${sellerName} on PinkQuill for ${commission.title}.`;
  const imageUrl = commission.primary_media?.[0]?.media_url;
  const canonicalUrl = SITE_URL ? `${SITE_URL}/commissions/${commission.id}` : undefined;

  return {
    title,
    description,
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

function buildServiceJsonLd(commission: CommissionMetaRow): Record<string, unknown> {
  const sellerName =
    commission.seller?.display_name ||
    commission.seller?.username ||
    "PinkQuill creator";
  const imageUrl = commission.primary_media?.[0]?.media_url;
  const url = SITE_URL ? `${SITE_URL}/commissions/${commission.id}` : undefined;
  const categoryLabel =
    commission.category && commission.subcategory
      ? getCommissionSubcategoryLabel(commission.category, commission.subcategory)
      : commission.category || undefined;

  const offers =
    commission.min_price !== null
      ? {
          "@type": "Offer",
          priceCurrency: "USD",
          price: commission.min_price,
          availability: "https://schema.org/InStock",
          url,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: commission.title,
    description: commission.description ?? undefined,
    image: imageUrl ? [imageUrl] : undefined,
    serviceType: categoryLabel,
    provider: { "@type": "Person", name: sellerName },
    url,
    offers,
  };
}

export default async function CommissionPage({ params }: Props) {
  const { id } = await params;
  const commission = await fetchCommissionMeta(id);

  // Product listings live at /product/[id]; redirect server-side so we
  // don't render the commission skeleton before bouncing on the client.
  if (commission?.listing_type === "product") {
    redirect(`/product/${commission.id}`);
  }

  return (
    <>
      {commission && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildServiceJsonLd(commission)) }}
        />
      )}
      <CommissionDetailView commissionId={id} />
    </>
  );
}
