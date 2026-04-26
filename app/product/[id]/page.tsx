import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import ProductDetailView from "@/components/store/ProductDetail/ProductDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

interface ProductMetaRow {
  id: string;
  title: string;
  description: string | null;
  listing_type: "product" | "service";
  status: string;
  min_price: number | null;
  max_price: number | null;
  category: string | null;
  delivery_type: "physical" | "digital" | "both";
  seller: { username: string; display_name: string | null } | null;
  primary_media: { media_url: string }[];
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "";

async function fetchProductMeta(id: string): Promise<ProductMetaRow | null> {
  // Service-role read so generateMetadata works without the visitor's
  // cookie session — we only return public, marketing-safe fields.
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      `
      id, title, description, listing_type, status, min_price, max_price,
      category, delivery_type,
      seller:profiles!products_seller_id_fkey ( username, display_name ),
      primary_media:product_media ( media_url )
    `
    )
    .eq("id", id)
    .eq("primary_media.is_primary", true)
    .maybeSingle<ProductMetaRow>();

  if (error || !data) return null;
  if (data.status !== "active") return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductMeta(id);

  if (!product) {
    return {
      title: "Product | PinkQuill",
      description: "View product details on PinkQuill",
    };
  }

  const sellerName = product.seller?.display_name || product.seller?.username || "PinkQuill creator";
  const titleSuffix = sellerName ? ` by ${sellerName}` : "";
  const title = `${product.title}${titleSuffix} | PinkQuill`;
  const description =
    product.description?.slice(0, 200) ||
    `Discover ${product.title} on PinkQuill, a marketplace for original creator works.`;
  const imageUrl = product.primary_media?.[0]?.media_url;
  const canonicalUrl = SITE_URL ? `${SITE_URL}/product/${product.id}` : undefined;

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

function buildProductJsonLd(product: ProductMetaRow): Record<string, unknown> {
  const sellerName = product.seller?.display_name || product.seller?.username || "PinkQuill creator";
  const imageUrl = product.primary_media?.[0]?.media_url;
  const url = SITE_URL ? `${SITE_URL}/product/${product.id}` : undefined;
  const offers =
    product.min_price !== null
      ? {
          "@type": "Offer",
          priceCurrency: "USD",
          price: product.min_price,
          availability: "https://schema.org/InStock",
          url,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: imageUrl ? [imageUrl] : undefined,
    category: product.category ?? undefined,
    brand: { "@type": "Brand", name: sellerName },
    url,
    offers,
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProductMeta(id);

  // Service listings live at /commissions/[id]; redirect server-side so
  // visitors don't see the product skeleton flash before client redirect.
  if (product?.listing_type === "service") {
    redirect(`/commissions/${product.id}`);
  }

  return (
    <>
      {product && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildProductJsonLd(product)) }}
        />
      )}
      <ProductDetailView productId={id} />
    </>
  );
}
