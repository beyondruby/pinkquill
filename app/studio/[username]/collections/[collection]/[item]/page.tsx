"use client";

import { useParams } from "next/navigation";
import CollectionView from "@/components/collections/CollectionView";

/** Keep the original subcollection addresses working after restoring the hierarchy. */
export default function SubcollectionPage() {
  const params = useParams<{ username: string; collection: string; item: string }>();
  return <div className="max-w-4xl mx-auto px-4 py-8"><CollectionView key={params.item} username={params.username} slug={params.item} /></div>;
}
