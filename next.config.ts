import type { NextConfig } from "next";

/**
 * Response headers applied to every route.
 *
 * There is deliberately no Content-Security-Policy here. A useful one for this
 * app has to allow Leaflet's tile images from `*.tile.openstreetmap.org` and
 * account for the inline styles Leaflet writes onto the map panes, and a CSP
 * written without checking each of those breaks the map silently in
 * production. Adding one is worth doing on its own, with the map exercised
 * against it.
 *
 * Fonts need no allowance: `next/font/google` downloads Inter and Poppins at
 * build time and serves them from this origin.
 */
const securityHeaders = [
  // Stop the browser guessing a response's type, which is what turns an
  // uploaded file served as text/plain into executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // The app is never framed by anything, so refuse framing outright and take
  // clickjacking off the table.
  { key: "X-Frame-Options", value: "DENY" },

  // Send the full URL only to ourselves; cross-origin requests (the
  // OpenStreetMap tile servers) get the origin alone, so station ids and
  // query strings do not leak into their logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // The app asks for none of these. Denying them means an injected script
  // cannot prompt the user for them either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/**
 * HSTS only in production. The header is meaningless over plain HTTP, and
 * pinning `localhost` to HTTPS would break `npm run dev` for anything else
 * served from it. Vercel and Render both terminate TLS, so this applies as
 * soon as the app is deployed. `preload` is left off on purpose: submitting a
 * domain to the preload list is close to irreversible and is the owner's call,
 * not a default.
 */
const productionHeaders =
  process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : [];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, ...productionHeaders],
      },
    ];
  },
};

export default nextConfig;
