import { ImageResponse } from "next/og";
import { profile } from "@/config/portfolio";

export const alt = `REALITY.EXE: ${profile.name}, ${profile.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card: drawn at build time from the profile, no image files needed. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(160deg, #070814 0%, #0d0f24 60%, #1a0a1e 100%)",
        color: "#dcd5c3",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28, color: "#3ee8e0" }}>
        <div style={{ width: 14, height: 14, background: "#3ee8e0" }} />
        District V9
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4, color: "#ff3b4f", lineHeight: 1 }}>REALITY.EXE</div>
        <div style={{ marginTop: 28, fontSize: 56, fontWeight: 700 }}>{profile.name}</div>
        <div style={{ marginTop: 8, fontSize: 32, color: "#9a95a8" }}>
          {`${profile.title}, ${profile.education.short}`}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 26, color: "#9a95a8" }}>
        A portfolio you can walk through. Projects, skills, a terminal, an arcade and a kart circuit.
      </div>
    </div>,
    size,
  );
}
