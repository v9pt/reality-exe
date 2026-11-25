import type { Metadata } from "next";
import Link from "next/link";

// Next.js marks this page noindex on its own; that is right for a 404.
export const metadata: Metadata = { title: "Page not found | REALITY.EXE" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6 text-center text-hud">
      <div>
        <p className="kanji text-[14px] text-crimson">迷子</p>
        <h1 className="display mt-2 text-[3rem] leading-none">Off the map</h1>
        <p className="mt-3 text-[15px] text-hud-dim">There is nothing at this address in District V9.</p>
        <Link href="/" className="mt-6 inline-block border border-cyan/60 px-4 py-1.5 text-[14px] text-cyan hover:bg-cyan/10">
          Back to the plaza
        </Link>
      </div>
    </main>
  );
}
