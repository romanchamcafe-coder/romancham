// Resilient fetch for Supabase calls made from the Vercel serverless runtime.
//
// Why: warm serverless functions reuse pooled TCP sockets to Supabase. When
// Supabase's load balancer closes an idle socket, the next request on it throws
// a bare "fetch failed" (UND_ERR_SOCKET / ECONNRESET / connect timeout). A plain
// retry that reuses the same broken agent fails again — which is exactly the
// intermittent "We couldn't reach the server" on sign-in.
//
// This wrapper:
//   * aborts each attempt after a timeout (so a hung socket fails fast), and
//   * retries ONLY when no HTTP response was received (a thrown network error),
//     opening a fresh connection each time. It never retries a real HTTP
//     response (4xx/5xx), so it can't double-submit an auth request.

// Kept comfortably under the serverless function budget: a dead keep-alive
// socket throws almost immediately (so the retry is fast), and this timeout is
// only the safety net for a true hang. 6s x up-to-3 still fits typical limits.
const TIMEOUT_MS = 6_000;
const MAX_ATTEMPTS = 3;

export const resilientFetch: typeof fetch = async (input, init) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // A fresh fetch() call after a socket error gets a healthy connection.
      const res = await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      return res; // any HTTP response (incl. 4xx/5xx) is returned as-is
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Transport error (no response received) — safe to retry with backoff.
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1) + Math.random() * 200));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
};
