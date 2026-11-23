"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { CYCLE_MINUTES_PER_SECOND, WEATHER, blendWeather, clockHours, moonDir, moonPhase, skyLook, sunDir } from "@/lib/sky";
import { env, saveEnv, useGame } from "@/store/game";
import { envUniforms, fogColor, precipUniforms, skyUniforms } from "./City";

/**
 * Runs the clock and the weather, and writes the sky, fog, light and
 * precipitation uniforms once a frame. Owns the scene's real lights, so the
 * sun (or the moon) is the key light. No React state changes per frame.
 */
export function SkyDriver() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const plaza = useRef<THREE.PointLight>(null);
  const scene = useThree((s) => s.scene);
  const t = useRef({ save: 0, clock: 0, nextBolt: 6, bolt: -1, date: new Date(), dateAt: -1 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = useGame.getState();
    const st = t.current;

    // The clock.
    if (g.timeMode === "cycle") env.hours = (env.hours + (dt * CYCLE_MINUTES_PER_SECOND) / 60) % 24;
    else if (g.timeMode === "clock" && (st.clock += dt) > 1) {
      st.clock = 0;
      env.hours = clockHours(new Date());
    }
    if ((st.save += dt) > 5) {
      st.save = 0;
      saveEnv();
    }
    // The date only matters for the season and the moon's phase: refresh it once a minute.
    if ((st.dateAt -= dt) < 0) {
      st.date = new Date();
      st.dateAt = 60;
    }

    // The weather eases toward the chosen one.
    const w = blendWeather(env.w, WEATHER[g.weather], dt);

    // Lightning: a soft double flash every 8 to 20 seconds in a storm. Off with reduced motion.
    if (w.lightning > 0.5 && !g.reducedMotion) {
      st.nextBolt -= dt;
      if (st.nextBolt <= 0) {
        st.bolt = 0;
        st.nextBolt = 8 + Math.random() * 12;
      }
    }
    if (st.bolt >= 0) {
      st.bolt += dt;
      env.flash = st.bolt < 0.08 ? 0.8 : st.bolt < 0.16 ? 0.15 : st.bolt < 0.24 ? 0.55 : Math.max(0, 0.55 - (st.bolt - 0.24) * 2.2);
      if (st.bolt > 0.6) {
        st.bolt = -1;
        env.flash = 0;
      }
    } else env.flash = 0;

    const sun = sunDir(env.hours, st.date);
    const phase = moonPhase(st.date);
    const moon = moonDir(env.hours, phase);
    const look = skyLook(sun, moon, phase, w);

    // Shared material uniforms.
    const u = envUniforms;
    u.uDay.value = look.day;
    u.uDusk.value = look.dusk;
    u.uSunDir.value.set(sun[0], sun[1], sun[2]);
    u.uSunCol.value.setRGB(look.sunCol[0], look.sunCol[1], look.sunCol[2]);
    const amb = 0.32 + 0.28 * look.day;
    u.uAmbient.value.setRGB(look.hemiSky[0] * look.hemi * amb, look.hemiSky[1] * look.hemi * amb, look.hemiSky[2] * look.hemi * amb);
    u.uWet.value = w.wet;
    u.uSnow.value = w.snow;
    u.uFlash.value = env.flash;
    skyUniforms.uTop.value.setRGB(look.top[0], look.top[1], look.top[2]);
    skyUniforms.uHorizon.value.setRGB(look.horizon[0], look.horizon[1], look.horizon[2]);
    skyUniforms.uMoonDir.value.set(moon[0], moon[1], moon[2]);
    skyUniforms.uPhase.value = phase;
    skyUniforms.uCloud.value = w.cloud;
    if (!g.reducedMotion) skyUniforms.uTime.value += dt;
    precipUniforms.uAmount.value = w.precip;
    precipUniforms.uSpeed.value = w.speed;
    precipUniforms.uSnowMode.value = w.snowMode;

    // Fog colour for the shaders and for the standard materials.
    fogColor.value.setRGB(look.fog[0], look.fog[1], look.fog[2]);
    if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(fogColor.value);

    // Real lights.
    if (hemi.current) {
      hemi.current.color.setRGB(look.hemiSky[0], look.hemiSky[1], look.hemiSky[2]);
      hemi.current.groundColor.setRGB(look.hemiGround[0], look.hemiGround[1], look.hemiGround[2]);
      hemi.current.intensity = look.hemi + env.flash * 1.5;
    }
    if (key.current) {
      key.current.color.setRGB(look.key[0], look.key[1], look.key[2]);
      key.current.intensity = look.keyI;
      key.current.position.set(look.keyDir[0] * 60, look.keyDir[1] * 60, look.keyDir[2] * 60);
    }
    // The plaza's magenta glow is a night light.
    if (plaza.current) plaza.current.intensity = 30 * (1 - 0.75 * look.day);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#6c5cff", "#1a0c1e", 0.55]} />
      <directionalLight ref={key} position={[-12, 20, 8]} intensity={0.6} color="#9fb6ff" />
      <pointLight ref={plaza} position={[0, 6, 0]} intensity={30} distance={26} color="#ff4f8a" decay={1.6} />
    </>
  );
}
