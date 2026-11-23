import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Saira_Extra_Condensed, Zen_Kaku_Gothic_New } from "next/font/google";
import { profile } from "@/config/portfolio";
import { siteUrl } from "@/lib/site";
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

const title = `REALITY.EXE — ${profile.name}`;

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  applicationName: "REALITY.EXE",
  authors: [{ name: profile.name, url: profile.contact.github }],
  alternates: { canonical: "/" },
  openGraph: { title, description, type: "website", url: "/", siteName: "REALITY.EXE" },
  twitter: { card: "summary_large_image", title, description },
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
