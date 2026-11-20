"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { avatar, view } from "@/store/game";
import { anchors, labelEls } from "./labels";

const v = new THREE.Vector3();

/** Inside the canvas: moves every label to its anchor's screen position. */
export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const a of anchors) {
      const el = labelEls.get(a.id);
      if (!el) continue;
      v.set(a.x, a.y, a.z).project(camera);
      const behind = v.z > 1;
      const dist = Math.hypot(a.x - avatar.x, a.z - avatar.z);
      // Pulled back, every label in view stays readable.
      const reach = view.mode === "follow" ? a.reach : Math.max(a.reach, view.dist[view.mode] * 1.6);
      const fade = THREE.MathUtils.clamp(1 - (dist - reach) / 10, 0, 1);
      if (behind || fade <= 0) {
        el.style.opacity = "0";
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.opacity = String(fade);
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });
  return null;
}

