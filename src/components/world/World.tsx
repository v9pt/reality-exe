"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { useGame, type Quality } from "@/store/game";
import { AdaptiveQuality, DPR } from "./AdaptiveQuality";
import { Player } from "./Avatar";
import { CameraRig } from "./CameraRig";
import { Cafe } from "./Cafe";
import { Circuit } from "./Circuit";
import { SkyDriver } from "./SkyDriver";
import { Districts } from "./Districts";
import { PerfProbe } from "./PerfProbe";
import { Buildings, Ground, Rain, Signs, Sky } from "./City";
import { Landmarks } from "./Landmarks";
import { LabelProjector } from "./LabelProjector";
import { FOG_COLOR } from "./shaders";
import { disposeTextures } from "./textures";


/**
 * The 3D layer. Loaded with a dynamic import so the boot screen paints
 * before three.js is parsed.
 */
export default function World({ cinematic, maxQuality, perf }: { cinematic: boolean; maxQuality: Quality; perf: boolean }) {
  const quality = useGame((s) => s.quality);
  const dpr = useGame((s) => s.dpr);
  const panel = useGame((s) => s.panel);

  useEffect(() => () => disposeTextures(), []);

  // On narrow screens an open sheet covers the city, so stop drawing it.
  // A running arcade game gets the whole frame budget on every screen.
  const covered = (panel !== null && cinematic) || panel === "arcade";

  return (
    <Canvas
      className="!fixed inset-0"
      style={{ touchAction: "none" }}
      dpr={dpr ?? DPR[quality]}
      frameloop={covered ? "never" : "always"}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 55, near: 0.1, far: 900, position: [0, 40, 40] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        scene.fog = new THREE.FogExp2(FOG_COLOR, 0.021);
        scene.background = new THREE.Color("#070814");
      }}
    >
      <AdaptiveQuality max={maxQuality} />
      <SkyDriver />
      <Suspense fallback={null}>
        <Sky />
        <Ground />
        <Buildings />
        <Signs />
        <Landmarks />
        <Districts />
        <Circuit />
        <Cafe />
        <Player />
        <CameraRig cinematic={cinematic} />
        <Rain />
        <LabelProjector />
      </Suspense>
      {perf ? <PerfProbe /> : null}
    </Canvas>
  );
}
