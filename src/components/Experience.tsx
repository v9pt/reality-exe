"use client";

import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CINEMATIC_QUERY, detectDevice, type Device } from "@/lib/device";
import { districtById, sectionById, type DistrictId, type PanelId } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Boot } from "./boot/Boot";
import { FlatMap } from "./ui/FlatMap";
import { Hud } from "./ui/Hud";
import { Cursor, Slash, Toasts } from "./ui/Overlays";
import { PerfOverlay } from "./ui/PerfOverlay";
import { Vex } from "./ui/Vex";
import { PanelHost } from "./panels/PanelHost";
import { useControls } from "./ui/useControls";
import { WorldLabels } from "./world/WorldLabels";

const loadWorld = () => import("./world/World");
const World = dynamic(loadWorld, { ssr: false, loading: () => null });

/** If the GPU or a shader fails at runtime, drop to the flat map instead of a blank screen. */
class WorldBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[reality.exe] 3D world failed, showing the flat map instead.", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Experience() {
  const [device, setDevice] = useState<Device | null>(null);
  const [slash, setSlash] = useState(false);
  const phase = useGame((s) => s.phase);
  const enterWorld = useGame((s) => s.enterWorld);

  useEffect(() => {
    const d = detectDevice();
    // Device capabilities only exist in the browser; reading them after hydration is the point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(d);
    useGame.setState({ quality: d.startQuality, reducedMotion: d.reducedMotion });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => useGame.getState().setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    // Re-evaluate layout when the window crosses the phone breakpoint.
    const narrow = window.matchMedia(CINEMATIC_QUERY);
    const onNarrow = () => setDevice((prev) => (prev ? { ...prev, cinematic: narrow.matches } : prev));
    narrow.addEventListener("change", onNarrow);
    return () => {
      mq.removeEventListener("change", onChange);
      narrow.removeEventListener("change", onNarrow);
    };
  }, []);

  // Start downloading the world while the boot text runs.
  const worldReady = useMemo<Promise<unknown>>(
    () => (device?.webgl ? loadWorld() : Promise.resolve()),
    [device?.webgl],
  );

  const enter = useCallback(() => {
    if (useGame.getState().phase === "world") return;
    enterWorld();
    if (!useGame.getState().reducedMotion) setSlash(true);
    // Deep links: /?go=quests opens a section straight away.
    const go = new URLSearchParams(window.location.search).get("go");
    if (go && (sectionById(go) || go === "secret" || go === "arcade")) useGame.getState().open(go as PanelId);
    else if (go && districtById(go)) useGame.getState().travel(go as DistrictId);
  }, [enterWorld]);

  // Enter key on the boot screen.
  useEffect(() => {
    if (phase !== "boot") return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") enter();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, enter]);

  useControls(phase === "world");

  if (!device) return <div className="fixed inset-0 bg-night" />;

  const flat = !device.webgl;
  const perf = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");

  return (
    <main className="fixed inset-0 overflow-hidden bg-night">
      <a href="#sections" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:bg-paper focus:px-3 focus:py-2 focus:text-ink">
        Skip to sections
      </a>
      {phase === "world" ? (
        <>
          {flat ? (
            <FlatMap />
          ) : (
            <WorldBoundary fallback={<FlatMap />}>
              <World cinematic={device.cinematic} maxQuality={device.maxQuality} perf={perf} />
              <WorldLabels />
            </WorldBoundary>
          )}
          <div id="sections">
            <Hud compact={device.cinematic} touch={device.touch} flat={flat} />
          </div>
          <PanelHost />
          {perf && !flat ? <PerfOverlay /> : null}
          <Vex flat={flat} touch={device.touch} />
          <Toasts />
        </>
      ) : (
        <Boot worldReady={worldReady} webgl={device.webgl} reducedMotion={device.reducedMotion} onEnter={enter} />
      )}
      <AnimatePresence>{slash ? <Slash onDone={() => setSlash(false)} /> : null}</AnimatePresence>
      <div className="screen-fx" aria-hidden />
      <Cursor />
    </main>
  );
}
