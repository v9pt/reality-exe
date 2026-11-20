"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BACKROOM_AT, sectionById } from "@/lib/sections";
import { CITY_RANGE, generateBuildings, obstacleGrid } from "@/lib/world-map";
import { orbitBy, panBy, zoomBy } from "@/lib/camera";
import { avatar, input, useGame, view } from "@/store/game";
import { FOG_DENSITY, fogDensity } from "./shaders";

const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _pivot = new THREE.Vector3();

const clamp = THREE.MathUtils.clamp;

/**
 * Third-person camera with three modes:
 *  - follow: close behind the avatar (the default);
 *  - free: orbit, pan and zoom anywhere from straight down to street level;
 *  - overview: the whole district from high up, turning slowly when idle.
 * A spring arm keeps it out of buildings and above the ground, and fog
 * thins as it pulls back so distant blocks stay readable.
 */
export function CameraRig({ cinematic }: { cinematic: boolean }) {
  const { camera, gl, size, scene, invalidate } = useThree();
  const quality = useGame((s) => s.quality);
  const grid = useMemo(() => obstacleGrid(generateBuildings(CITY_RANGE[quality])), [quality]);
  const arm = useMemo(() => ({ current: 1 }), []);

  // Mouse and touch on the canvas: one pointer orbits (or pans with the right
  // button / in two-finger mode), two pointers pinch-zoom and pan.
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map<number, { x: number; y: number; button: number }>();
    let pinch = 0;
    let mid: [number, number] | null = null;

    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      }
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) zoomBy(pinch / d);
        pinch = d;
        const m: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
        if (mid) panBy(m[0] - mid[0], m[1] - mid[1]);
        mid = m;
        return;
      }
      const panning = p.button === 2 || p.button === 1 || (p.button === 0 && e.shiftKey);
      if (panning && view.mode === "free") panBy(dx, dy);
      else orbitBy(dx, dy);
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) {
        pinch = 0;
        mid = null;
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(e.deltaY * 0.0012));
    };
    const dbl = () => {
      view.panX = 0;
      view.panZ = 0;
    };
    const menu = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", dbl);
    el.addEventListener("contextmenu", menu);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", dbl);
      el.removeEventListener("contextmenu", menu);
    };
  }, [gl]);

  // Start the intro shot high above the plaza.
  useEffect(() => {
    if (useGame.getState().reducedMotion) view.intro = 0;
    camera.position.set(0, 40, 40);
    _look.set(0, 2, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = 900;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, invalidate]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = useGame.getState();
    const rm = g.reducedMotion;
    const mode = g.camMode;
    view.mode = mode;
    const panelOpen = g.panel !== null;

    // Held camera keys.
    if (input.rot) {
      view.yaw += input.rot * dt * 1.8;
      view.idle = 0;
    }
    if (input.zoom) zoomBy(Math.exp(input.zoom * dt * 1.6));
    if (mode === "follow") {
      view.panX = THREE.MathUtils.damp(view.panX, 0, 6, dt);
      view.panZ = THREE.MathUtils.damp(view.panZ, 0, 6, dt);
    }

    // Follow: like a third-person action game, the camera swings back behind the
    // character while it runs, unless the visitor is looking around by hand or
    // running toward the camera.
    if (mode === "follow" && !panelOpen && view.intro === 0 && avatar.speed > 0.6) {
      const handsOff = (performance.now() - view.lookT) / 1000 > 1.1;
      const behind = avatar.heading + Math.PI;
      const diff = Math.atan2(Math.sin(behind - view.yaw), Math.cos(behind - view.yaw));
      if (handsOff && Math.abs(diff) < 1.9) {
        view.yaw += diff * (1 - Math.exp(-dt * 2.4 * Math.min(1, avatar.speed / 5)));
      }
    }

    // Phones idle into a slow orbit so the city reads as a cinematic; the overview always drifts.
    if (!rm && !panelOpen && ((cinematic && view.idle > 8 && mode === "follow") || (mode === "overview" && view.idle > 2))) {
      view.yaw += dt * (mode === "overview" ? 0.05 : 0.08);
    }

    const focusId = panelOpen ? g.focus : null;
    const wide = size.width >= 900;
    let k = 1 - Math.exp(-dt * (rm ? 60 : 4.5));
    const ay = avatar.ground + avatar.y * 0.35;

    if (focusId) {
      const at = focusId === "backroom" ? BACKROOM_AT : sectionById(focusId)?.at;
      if (at) {
        // Frame the landmark from the plaza side, offset so the open sheet doesn't cover it.
        const [ax, az] = at;
        const len = Math.hypot(ax, az) || 1;
        const ox = -ax / len;
        const oz = -az / len;
        const side = wide ? 2.6 : 0;
        _target.set(ax + ox * 11 + oz * side, 4.4, az + oz * 11 - ox * side);
        _desiredLook.set(ax + oz * side, 2.2, az - ox * side);
      }
    } else {
      const pitch = view.pitch[mode];
      const dist = view.dist[mode];
      if (mode === "overview") {
        // Centre between the plaza and the avatar, so both stay in frame.
        _pivot.set(avatar.x * 0.5, 0, avatar.z * 0.5);
      } else if (mode === "follow") {
        // Over the right shoulder, at head height.
        const shoulder = 0.55 * (1 - view.intro);
        _pivot.set(avatar.x + Math.cos(view.yaw) * shoulder, ay + 1.75, avatar.z - Math.sin(view.yaw) * shoulder);
      } else {
        _pivot.set(avatar.x + view.panX, ay + 1.6, avatar.z + view.panZ);
      }
      const intro = mode === "follow" ? view.intro : 0;
      const reach = dist * (1 + intro * 1.6);
      _target.set(
        _pivot.x + Math.sin(view.yaw) * reach * Math.cos(pitch),
        _pivot.y + Math.sin(pitch) * dist + intro * 26,
        _pivot.z + Math.cos(view.yaw) * reach * Math.cos(pitch),
      );
      _desiredLook.set(_pivot.x, _pivot.y + intro * 2, _pivot.z);
      if (intro > 0) {
        view.intro = Math.max(0, view.intro - dt * 0.45);
        k = 1 - Math.exp(-dt * 3);
      } else if (mode === "follow") {
        // Tight follow: the camera stays with the player instead of drifting after them.
        k = 1 - Math.exp(-dt * (rm ? 60 : 12));
      }
      // Spring arm: shorten instantly when blocked, lengthen smoothly.
      if (mode !== "overview" && intro === 0) {
        const want = grid.arm(_pivot.x, _pivot.y, _pivot.z, _target.x, _target.y, _target.z);
        arm.current = want < arm.current ? want : THREE.MathUtils.damp(arm.current, want, 3, dt);
        _target.lerpVectors(_pivot, _target, arm.current);
      } else {
        arm.current = 1;
      }
      // Never below street level.
      _target.y = Math.max(_target.y, 0.6);
    }

    if (view.snap) {
      camera.position.copy(_target);
      _look.copy(_desiredLook);
      view.snap = false;
    } else {
      camera.position.lerp(_target, k);
      _look.lerp(_desiredLook, k);
    }
    camera.lookAt(_look);

    // Thin the fog as the camera pulls back so the far city stays visible.
    const d = camera.position.distanceTo(_look);
    const density = FOG_DENSITY * clamp(16 / Math.max(d, 1), 0.16, 1);
    fogDensity.value = density;
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = density;
  });

  return null;
}
