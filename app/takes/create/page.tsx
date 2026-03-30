"use client";

import { useRouter } from "next/navigation";
import CreateTake from "@/components/takes/CreateTake";

export default function CreateTakePage() {
  const router = useRouter();

  return (
    <CreateTake
      onSuccess={() => router.push("/takes")}
      onCancel={() => router.back()}
    />
  );
}
