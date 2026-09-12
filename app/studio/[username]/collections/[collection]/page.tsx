"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import CollectionView from "@/components/collections/CollectionView";

/** The shareable address of a collection; the studio opens the same view in a modal. */
export default function CollectionPage() {
  const params = useParams();
  const username = params?.username as string;
  const slug = params?.collection as string;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href={`/studio/${username}`} className="hover:text-accent transition-colors">
          @{username}
        </Link>
        <span>/</span>
        <Link href={`/studio/${username}?tab=collections`} className="hover:text-accent transition-colors">
          Collections
        </Link>
      </nav>
      <CollectionView username={username} slug={slug} />
    </div>
  );
}
