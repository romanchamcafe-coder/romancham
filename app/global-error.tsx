"use client";
import { useEffect } from "react";

/**
 * Global error boundary — replaces the root layout when an error is thrown
 * above the app segment, so it must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#0f172a",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Romancham" width={160} height={42} style={{ height: 40, width: "auto" }} />
        <h1 style={{ marginTop: 24, fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: "#64748b" }}>
          A temporary error occurred. Please try again — if it keeps happening, refresh the page.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 12,
            height: 44,
            padding: "0 20px",
            borderRadius: 8,
            border: "none",
            background: "#EA580C",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
