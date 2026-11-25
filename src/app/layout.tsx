import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Saira_Extra_Condensed, Zen_Kaku_Gothic_New } from "next/font/google";
import { profile } from "@/config/portfolio";
import { SITE_NAME, homeDescription, homeTitle } from "@/lib/seo";
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

const title = homeTitle;
const description = homeDescription;

// Icons come from the file conventions in this folder (icon.svg,
// icon1-3.png, apple-icon.png, favicon.ico), so none are listed here. The
// canonical is set by each page, so the 404 page doesn't point at the home page.
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  applicationName: SITE_NAME,
  authors: [{ name: profile.name, url: profile.contact.github }],
  creator: profile.name,
  openGraph: { title, description, type: "profile", url: "/", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image", title, description },
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
