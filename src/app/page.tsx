import Experience from "@/components/Experience";
import { profile, quests } from "@/config/portfolio";

export default function Page() {
  return (
    <>
      {/* Plain-text summary for crawlers and anyone without JavaScript. */}
      <noscript>
        <div style={{ padding: 24, maxWidth: 640, fontFamily: "system-ui", color: "#e9e4d6" }}>
          <h1>{profile.name}</h1>
          <p>{profile.title}. {profile.bio.join(" ")}</p>
          <ul>
            {quests.map((q) => (
              <li key={q.slug}>
                <strong>{q.title}</strong>: {q.tagline}
              </li>
            ))}
          </ul>
          <p>
            <a href={`mailto:${profile.contact.email}`}>{profile.contact.email}</a> · <a href={profile.contact.github}>GitHub</a>
          </p>
        </div>
      </noscript>
      <Experience />
    </>
  );
}
