import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * Addresses: OWASP A05:2021 (Security Misconfiguration),
 * clickjacking, MIME-sniffing, and Referer leakage.
 */
const _SECURITY_HEADERS = [
  // Prevent clickjacking — block all framing
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing attacks
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control Referer leakage to cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS for 1 year including subdomains
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Restrict browser APIs this origin can access
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // CSP: allowlist for Mapbox GL, Supabase, WHO API, Google Fonts
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.mapbox.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://www.who.int https://events.mapbox.com",
      "worker-src 'self' blob:",
      "child-src blob:",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: _SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
