import { profile, quests, skillTree } from "@/config/portfolio";
import { siteUrl } from "@/lib/site";

/**
 * Search metadata for the one public page. Kept apart from layout.tsx so the
 * length limits (title under 60, description 150 to 160) are checked by tests.
 */
export const SITE_NAME = "REALITY.EXE";

export const homeTitle = `${profile.name}, ${profile.title} | ${SITE_NAME} Portfolio`;

export const homeDescription =
  `${profile.name}, ${profile.title.toLowerCase()} in ${profile.location.split(",")[0]} building full-stack products, ` +
  "backend APIs and applied ML. Explore projects and experience in a walkable 3D city.";

/** Absolute URL on the production domain for a path. */
export function absolute(path = "/"): string {
  return new URL(path, siteUrl()).toString();
}

/**
 * JSON-LD for the home page: the site, the page (a profile page) and the
 * person it is about, with the projects as creative works. Built only from
 * portfolio.ts so it never says more than the page does.
 */
export function homeJsonLd() {
  const url = absolute("/");
  const personId = `${url}#person`;
  const sameAs = [profile.contact.github, profile.contact.linkedin, profile.contact.leetcode].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name: SITE_NAME,
        alternateName: `${profile.name} portfolio`,
        description: homeDescription,
        inLanguage: "en",
        publisher: { "@id": personId },
      },
      {
        "@type": "ProfilePage",
        "@id": `${url}#webpage`,
        url,
        name: homeTitle,
        description: homeDescription,
        inLanguage: "en",
        isPartOf: { "@id": `${url}#website` },
        mainEntity: { "@id": personId },
        primaryImageOfPage: absolute("/opengraph-image"),
      },
      {
        "@type": "Person",
        "@id": personId,
        name: profile.name,
        alternateName: profile.handle,
        jobTitle: profile.title,
        description: profile.bio[0],
        url,
        image: absolute("/opengraph-image"),
        sameAs,
        address: { "@type": "PostalAddress", addressLocality: profile.location.split(",")[0], addressCountry: "IN" },
        alumniOf: { "@type": "CollegeOrUniversity", name: profile.education.school },
        knowsAbout: skillTree.flatMap((c) => c.skills.map((s) => s.name)),
      },
      {
        "@type": "ItemList",
        "@id": `${url}#projects`,
        name: "Projects",
        itemListElement: quests.map((q, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "CreativeWork",
            name: q.title,
            description: q.tagline,
            creator: { "@id": personId },
            // Only a plain year is a valid date; ranges like "2023 to 2024" are left out.
            ...(q.period && /^\d{4}$/.test(q.period) ? { dateCreated: q.period } : {}),
            ...(q.stack?.length ? { keywords: q.stack.join(", ") } : {}),
            // A link to the profile isn't the project's own page, so only real project links count.
            ...(q.links?.github && q.links.github !== profile.contact.github ? { url: q.links.github } : {}),
          },
        })),
      },
    ],
  };
}

/** Serialize JSON-LD for a <script> tag; `<` is escaped so text can't close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
