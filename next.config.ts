import type { NextConfig } from "next";

/**
 * Content-Security-Policy
 * Compatible with: Next.js App Router (inline bootstrap + inline styles),
 * Supabase (REST + Realtime websocket), Google Fonts, Vercel, and image CDNs.
 * `frame-ancestors 'self'` + X-Frame-Options block external embedding (clickjacking).
 */
const csp = [
  "default-src 'self'",
  // Next.js injects a small inline bootstrap script; 'unsafe-inline' keeps hydration working.
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  // Tailwind/Next/Recharts emit inline styles; Google Fonts stylesheet.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Supabase REST + Realtime (wss); Vercel live preview.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Cross-Origin-Embedder-Policy is intentionally NOT set to `require-corp`:
  // it breaks Supabase/third-party image and asset loading. Left as browser default (unsafe-none).
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Project is TypeScript- and ESLint-clean; enforce both on every build.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  async headers() {
    return [
      // Security headers on every route (HTML + API).
      { source: "/:path*", headers: securityHeaders },
      // Long-term immutable caching for fingerprinted / static assets.
      {
        source: "/:path*.(js|css|woff|woff2|ttf|otf|eot)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*.(png|jpg|jpeg|gif|webp|avif|svg|ico)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
