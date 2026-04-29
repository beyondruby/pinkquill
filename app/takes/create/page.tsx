"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import CreateTake from "@/components/takes/CreateTake";

function CreateTakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const soundId = searchParams.get("sound") || undefined;

  return (
    <CreateTake
      initialSoundId={soundId}
      onSuccess={() => router.push("/takes")}
      onCancel={() => router.back()}
    />
  );
}

export default function CreateTakePage() {
  return (
    <Suspense fallback={null}>
      <CreateTakeContent />
    </Suspense>
  );
}
