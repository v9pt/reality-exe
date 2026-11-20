import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Saira_Extra_Condensed, Zen_Kaku_Gothic_New } from "next/font/google";
import { profile } from "@/config/portfolio";
import "./globals.css";

const saira = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-saira",
  display: "swap",
});
const zen = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen",
  display: "swap",
});
const jet = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jet",
  display: "swap",
});

const description = `${profile.name}, ${profile.title}. A portfolio you can walk through: projects, skills, experience, a working terminal, an arcade and a jukebox in a night city.`;

export const metadata: Metadata = {
  title: `REALITY.EXE — ${profile.name}`,
  description,
  openGraph: { title: `REALITY.EXE — ${profile.name}`, description, type: "website" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#070814",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${saira.variable} ${zen.variable} ${jet.variable}`}>
      <body>{children}</body>
    </html>
  );
}
