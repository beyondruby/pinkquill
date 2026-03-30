"use client";

import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ProfileErrorFallback } from "@/components/ui/ErrorFallbacks";
import StudioProfile from "./StudioProfile";

interface Props {
  username: string;
}

export default function StudioProfileWrapper({ username }: Props) {
  return (
    <ErrorBoundary
      section={`Profile:${username}`}
      resetKey={username}
      fallback={({ reset }) => <ProfileErrorFallback onRetry={reset} />}
    >
      <StudioProfile username={username} />
    </ErrorBoundary>
  );
}
