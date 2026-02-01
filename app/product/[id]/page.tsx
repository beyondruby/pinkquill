import { Metadata } from "next";
import ProductDetailView from "@/components/store/ProductDetail/ProductDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  return {
    title: "Product | Quill",
    description: "View product details on Quill",
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  return <ProductDetailView productId={id} />;
}
