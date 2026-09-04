import { Metadata } from "next";
import CreateProductWizard from "@/components/store/CreateProduct";

export const metadata: Metadata = {
  title: "Sell Your Work | PinkQuill",
  description: "Create and sell your creative products on Quill",
};

export default function SellPage() {
  return <CreateProductWizard />;
}
