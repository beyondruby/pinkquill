"use client";

import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";

interface ScrimProps {
  /** Called when the person presses and releases on the scrim itself. */
  onDismiss?: () => void;
  /** Darker scrim for immersive viewers (post/take detail). */
  strong?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Backdrop for dialogs and sheets. Dismisses only when a press starts AND ends
 * on the scrim, so selecting text inside a dialog and releasing outside never
 * closes it (a long-standing annoyance with the old `onClick` backdrops).
 */
export default function Scrim({ onDismiss, strong = false, className = "", children }: ScrimProps) {
  const pressStartedOnScrim = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pressStartedOnScrim.current = event.target === event.currentTarget;
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!pressStartedOnScrim.current) return;
    pressStartedOnScrim.current = false;
    onDismiss?.();
  };

  return (
    <div
      className={["pq-scrim", strong ? "pq-scrim--strong" : "", className].filter(Boolean).join(" ")}
      role="presentation"
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
