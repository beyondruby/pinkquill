import type { ReactNode } from "react";

interface PageFrameProps {
  children: ReactNode;
  /** `wide` 1216px for discovery/studio/management, `reading` 860px, `narrow` 690px for a single column. */
  width?: "wide" | "reading" | "narrow";
  /** Remove vertical padding when the page draws its own header band. */
  flush?: boolean;
  className?: string;
}

/** Content width and gutters for a page inside the AppShell. */
export function PageFrame({ children, width = "wide", flush = false, className = "" }: PageFrameProps) {
  return (
    <div
      className={[
        "pq-page",
        width === "reading" ? "pq-page--reading" : width === "narrow" ? "pq-page--narrow" : "",
        flush ? "pq-page--flush" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Sentence-case title, optional one-line lede, optional actions. */
export function PageHeader({ title, lede, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`pq-page-head ${className}`.trim()}>
      <div>
        <h1 className="pq-page-head__title">{title}</h1>
        {lede && <p className="pq-page-head__lede">{lede}</p>}
      </div>
      {actions && <div className="pq-page-head__actions">{actions}</div>}
    </header>
  );
}
