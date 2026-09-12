import type { ReactNode } from "react";
import styles from "./CreationForm.module.css";

/** A quiet gradient edge that becomes more pronounced while editing. */
export default function CreationFieldFrame({
  children,
  emphasis = false,
  className = "",
}: {
  children: ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={`${styles.field} ${emphasis ? styles.emphasis : ""} ${className}`}>
      {children}
    </div>
  );
}
