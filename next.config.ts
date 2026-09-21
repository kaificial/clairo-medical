import type { NextConfig } from "next";

// Imported for its side effect: a bad environment variable fails the build
// right here, with a readable message, instead of at runtime.
import "./src/env";

const isDev = process.env.NODE_ENV === "development";

// On-device search and OCR download their models from these two places the
// first time they are used. Nothing about the reader's document goes to them.
const MODEL_HOSTS = [
  "https://huggingface.co",
  "https://*.huggingface.co",
  "https://*.hf.co",
  "https://cdn.jsdelivr.net",
];

/**
 * The browser's rulebook for this site: where scripts, styles and downloads
 * may come from. Anything not listed is blocked, which limits the damage if
 * something malicious ever got onto a page.
 *
 * - 'unsafe-inline' is needed by Next.js and the theme script without nonces,
 *   which would force every page to render on each request.
 * - 'wasm-unsafe-eval' lets the OCR engine and the embedding model run
 *   WebAssembly.
 * - blob: workers are how the OCR engine starts its background thread.
 * - 'unsafe-eval' only in development, where React needs it for error stacks.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "media-src 'self'",
  `connect-src 'self' blob: data: ${MODEL_HOSTS.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Always use HTTPS for the next two years, subdomains included.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Don't let the browser guess a file's type from its contents.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our domain, never the page someone was on.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Clairo never needs the camera, microphone, location or payments.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Keep other windows from reaching into this one.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The Docker image sets this to get a small self-contained server. Left off
  // otherwise, because `next start` and Vercel both work without it.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
