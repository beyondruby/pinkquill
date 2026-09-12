"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children at the end of <body>. Use it for a sheet or dialog that
 * opens from inside another dialog card: the card is transformed (scale
 * animation), which would otherwise make `position: fixed` children sit
 * inside the card and get clipped by its overflow. Only for content that
 * appears after an interaction (it renders nothing on the server).
 */
export default function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
