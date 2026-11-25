import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo";

/** Every crawler may read everything; the sitemap lists the public pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absolute("/sitemap.xml"),
  };
}
