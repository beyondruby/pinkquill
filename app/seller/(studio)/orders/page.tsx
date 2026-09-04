import SellerOrdersTable from "@/components/seller/SellerOrdersTable";

export const metadata = {
  title: "Seller Orders | PinkQuill",
  description: "Manage incoming orders from buyers.",
};

export default function SellerOrdersPage() {
  return <SellerOrdersTable />;
}
