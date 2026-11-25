import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo";

/**
 * Generated at build time from this list. Add an entry here when a new public
 * page is added; `npm run indexnow` reads this sitemap to know what to submit.
 * `lastModified` is the build time, i.e. the last deploy.
 */
const PUBLIC_PATHS = ["/"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: absolute(path),
    lastModified,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
