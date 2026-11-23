/**
 * The site's public address, used for share cards, the sitemap and robots.
 * Set NEXT_PUBLIC_SITE_URL to the real domain; on Vercel the production URL
 * is picked up automatically when it isn't set.
 */
export function siteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3100";
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3100");
  }
}
