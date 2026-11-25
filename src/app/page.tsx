import Experience from "@/components/Experience";
import { achievements, profile, quests, roles, skillTree } from "@/config/portfolio";
import type { Metadata } from "next";
import { homeJsonLd, jsonLdScript } from "@/lib/seo";

// Self-referencing canonical on the production domain (metadataBase in the
// layout makes it absolute). `?go=` deep links collapse onto it.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * The 3D world draws itself in the browser, so on its own the server would send
 * an empty page. This text version is rendered on the server into the initial
 * HTML: search engines and link previews read it, and screen readers get the
 * whole portfolio as plain text. It says the same things the in-world panels do.
 */
const NO_JS_CSS = `
#text-version { position: relative; z-index: 100; width: auto; height: auto; margin: 0 auto; padding: 24px; max-width: 720px;
  overflow: visible; clip: auto; clip-path: none; white-space: normal; font-family: system-ui, sans-serif; line-height: 1.6; }
#text-version h1 { font-size: 1.75rem; font-weight: 700; } #text-version h2 { margin-top: 1.5em; font-size: 1.3rem; font-weight: 700; }
#text-version h3 { margin-top: 1em; font-weight: 700; } #text-version ul { list-style: disc; padding-left: 1.25em; } #text-version a { color: #3ee8e0; text-decoration: underline; }
body { overflow: auto; }`;

/** Visually hidden but in the DOM; its links stay out of the Tab order so keyboard focus goes to the world first. */
function TextVersion() {
  return (
    <article id="text-version" className="sr-only" aria-labelledby="text-version-title">
      <header>
        <h1 id="text-version-title">
          {profile.name}, {profile.title}
        </h1>
        <p>{profile.location}</p>
        {profile.bio.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </header>

      <section aria-labelledby="tv-projects">
        <h2 id="tv-projects">Projects</h2>
        {quests.map((q) => (
          <section key={q.slug} aria-labelledby={`tv-${q.slug}`}>
            <h3 id={`tv-${q.slug}`}>{q.title}</h3>
            <p>
              {q.kind}
              {q.period ? `, ${q.period}` : ""}
              {q.context ? `. ${q.context}` : ""}
            </p>
            <p>{q.tagline}</p>
            {q.description ? <p>{q.description}</p> : null}
            {q.features?.length ? (
              <ul>
                {q.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
            {q.stack?.length ? <p>Built with {q.stack.join(", ")}.</p> : null}
            {q.links?.github ? (
              <a tabIndex={-1} href={q.links.github}>
                {q.title} on GitHub
              </a>
            ) : null}
          </section>
        ))}
      </section>

      <section aria-labelledby="tv-experience">
        <h2 id="tv-experience">Experience</h2>
        {roles.map((r) => (
          <section key={r.id} aria-labelledby={`tv-${r.id}`}>
            <h3 id={`tv-${r.id}`}>
              {r.role}, {r.organisation}
            </h3>
            <p>
              {r.period}
              {r.location ? `, ${r.location}` : ""}
            </p>
            <ul>
              {r.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </section>

      <section aria-labelledby="tv-education">
        <h2 id="tv-education">Education</h2>
        <p>
          {profile.education.degree}, {profile.education.school}, {profile.education.period}.
        </p>
      </section>

      <section aria-labelledby="tv-skills">
        <h2 id="tv-skills">Skills</h2>
        <dl>
          {skillTree.map((c) => (
            <div key={c.id}>
              <dt>{c.name}</dt>
              <dd>{c.skills.map((s) => s.name).join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tv-achievements">
        <h2 id="tv-achievements">Achievements</h2>
        <ul>
          {achievements.map((a) => (
            <li key={a.title}>
              {a.title}
              {a.detail ? `: ${a.detail}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <footer aria-labelledby="tv-contact">
        <h2 id="tv-contact">Contact</h2>
        <ul>
          <li>
            <a tabIndex={-1} href={`mailto:${profile.contact.email}`}>
              {profile.contact.email}
            </a>
          </li>
          <li>
            <a tabIndex={-1} href={profile.contact.github}>
              GitHub
            </a>
          </li>
          {profile.contact.linkedin ? (
            <li>
              <a tabIndex={-1} href={profile.contact.linkedin}>
                LinkedIn
              </a>
            </li>
          ) : null}
          {profile.contact.leetcode ? (
            <li>
              <a tabIndex={-1} href={profile.contact.leetcode}>
                LeetCode
              </a>
            </li>
          ) : null}
        </ul>
      </footer>
    </article>
  );
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(homeJsonLd()) }} />
      <Experience />
      <TextVersion />
      {/* Without JavaScript the world can't start, so show the text version instead. */}
      <noscript>
        <style>{NO_JS_CSS}</style>
      </noscript>
    </>
  );
}
