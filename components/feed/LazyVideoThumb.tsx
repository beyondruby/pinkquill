"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

// A <video> used only as a still thumbnail (feed grids, Stream/Gallery tiles,
// take tiles without a poster). Findings F-25 / V-28 / P-23: every such tile
// used to carry its src from mount, so a long feed fetched the metadata and
// first frame of every clip on the page. The src is now attached only when the
// tile comes within 200px of the viewport, through one shared observer.

const nearCallbacks = new Map<Element, () => void>();
let nearObserver: IntersectionObserver | null = null;

function observeNear(element: Element, onNear: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    onNear();
    return () => {};
  }
  if (!nearObserver) {
    nearObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) nearCallbacks.get(entry.target)?.();
        }
      },
      { rootMargin: "200px 0px" },
    );
  }
  nearCallbacks.set(element, onNear);
  nearObserver.observe(element);
  return () => {
    nearCallbacks.delete(element);
    nearObserver?.unobserve(element);
  };
}

type Props = { src: string } & Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "preload" | "muted" | "playsInline" | "autoPlay" | "controls"
>;

export function LazyVideoThumb({ src, ...rest }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    return observeNear(el, () => setNear(true));
  }, [near]);

  return <video ref={ref} src={near ? src : undefined} preload="metadata" muted playsInline {...rest} />;
}
