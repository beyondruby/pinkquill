"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TakesFeed from "@/components/takes/TakesFeed";

function TakesContent() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("community") || undefined;
  const soundId = searchParams.get("sound") || undefined;

  return (
    <TakesFeed
      communityId={communityId}
      soundId={soundId}
    />
  );
}

function TakesLoading() {
  return (
    <div className="takes-feed-status">
      <div className="takes-feed-spinner" />
      <p>Loading Takes...</p>
    </div>
  );
}

export default function TakesPage() {
  return (
    <Suspense fallback={<TakesLoading />}>
      <TakesContent />
    </Suspense>
  );
}
