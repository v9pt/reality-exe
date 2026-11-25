// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others; not
// Google) that the site's pages changed. Reads the URLs from the live sitemap,
// so run it after a production deploy:
//   SITE_URL=https://huzaifa.codes node scripts/indexnow.mjs
// The key is public by design: search engines check it by fetching
// <site>/<key>.txt, which lives in /public.
import { readdirSync } from "node:fs";

const site = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://huzaifa.codes").replace(/\/$/, "");
const keyFile = readdirSync(new URL("../public/", import.meta.url)).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("No IndexNow key file (32 hex characters + .txt) in /public.");
const key = keyFile.replace(/\.txt$/, "");

const keyRes = await fetch(`${site}/${keyFile}`);
if (!keyRes.ok || (await keyRes.text()).trim() !== key) {
  throw new Error(`${site}/${keyFile} doesn't serve the key yet. Deploy first, then run this again.`);
}

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error(`No URLs found in ${site}/sitemap.xml.`);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${keyFile}`, urlList }),
});
// 200 = accepted, 202 = accepted and the key is still being checked.
if (res.status !== 200 && res.status !== 202) {
  throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
}
console.log(`IndexNow: submitted ${urlList.length} URL(s), status ${res.status}.`);
for (const u of urlList) console.log(`  ${u}`);
