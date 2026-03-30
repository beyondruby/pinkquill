"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { FullPageLoading } from "@/components/ui/Loading";

interface RequireAuthProps {
  children: React.ReactNode;
  loadingText?: string;
}

export default function RequireAuth({
  children,
  loadingText = "Loading",
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const redirectPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [loading, redirectPath, router, user]);

  if (loading || !user) {
    return <FullPageLoading text={loadingText} />;
  }

  return <>{children}</>;
}
