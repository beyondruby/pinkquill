"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fdfdfd",
            padding: "24px",
            fontFamily: "'Josefin Sans', sans-serif",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: "1.5rem",
                color: "#1e1e1e",
                marginBottom: "16px",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontFamily: "'Crimson Pro', serif",
                color: "#777",
                marginBottom: "24px",
              }}
            >
              A critical error occurred. Please refresh or try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: "12px 24px",
                borderRadius: "9999px",
                background: "linear-gradient(to right, #8e44ad, #ff007f)",
                color: "white",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
