"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { CatLook } from "@/lib/cats";

/** Parts a parent animates: filled by ref callbacks, read in its frame loop. */
export type CatParts = {
  body: THREE.Group | null;
  head: THREE.Group | null;
  tail: THREE.Group | null;
  legs: (THREE.Group | null)[];
  eyes: (THREE.Mesh | null)[];
};

export const newCatParts = (): CatParts => ({ body: null, head: null, tail: null, legs: [null, null, null, null], eyes: [null, null] });

const materials = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material) {
  let m = materials.get(key);
  if (!m) {
    m = make();
    materials.set(key, m);
  }
  return m;
}

/**
 * An original stylised cat, facing +z, built from primitives: round body and
 * head, pointed ears, glowing eyes, a tail and four legs. Coat patterns:
 * solid, tabby stripes, patches, or a pale face mask.
 */
export function CatModel({ look, parts, scale = 1 }: { look: CatLook; parts: CatParts; scale?: number }) {
  const m = useMemo(
    () => ({
      fur: mat(`fur:${look.fur}`, () => new THREE.MeshStandardMaterial({ color: look.fur, roughness: 0.9 })),
      accent: mat(`fur:${look.accent}`, () => new THREE.MeshStandardMaterial({ color: look.accent, roughness: 0.9 })),
      eye: mat(`eye:${look.eye}`, () => new THREE.MeshBasicMaterial({ color: look.eye, toneMapped: false })),
      nose: mat("nose", () => new THREE.MeshStandardMaterial({ color: "#d98c95", roughness: 0.7 })),
    }),
    [look],
  );
  return (
    <group scale={scale}>
      {/* Legs pivot at the hip so they can swing. */}
      {(
        [
          [-0.12, 0.2],
          [0.12, 0.2],
          [-0.12, -0.24],
          [0.12, -0.24],
        ] as const
      ).map(([x, z], i) => (
        <group key={i} position={[x, 0.26, z]} ref={(g) => void (parts.legs[i] = g)}>
          <mesh material={m.fur} position={[0, -0.13, 0]}>
            <cylinderGeometry args={[0.045, 0.04, 0.26, 6]} />
          </mesh>
        </group>
      ))}
      <group ref={(g) => void (parts.body = g)} position={[0, 0.34, 0]}>
        <mesh material={m.fur} scale={[0.25, 0.22, 0.46]}>
          <sphereGeometry args={[1, 14, 10]} />
        </mesh>
        {look.pattern === "tabby"
          ? [-0.16, 0, 0.16].map((z) => (
              <mesh key={z} material={m.accent} position={[0, 0.16, z]} rotation-z={Math.PI / 2} scale={[1, 1, 0.5]}>
                <torusGeometry args={[0.13, 0.025, 4, 10, Math.PI]} />
              </mesh>
            ))
          : null}
        {look.pattern === "patches" ? (
          <>
            <mesh material={m.accent} position={[0.08, 0.1, -0.12]} scale={[0.17, 0.14, 0.2]}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
            <mesh material={m.accent} position={[-0.1, 0.08, 0.16]} scale={[0.14, 0.13, 0.14]}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          </>
        ) : null}
        <group ref={(g) => void (parts.tail = g)} position={[0, 0.06, -0.42]}>
          <mesh material={look.pattern === "mask" ? m.accent : m.fur} position={[0, 0.24, -0.06]} rotation-x={-0.35}>
            <cylinderGeometry args={[0.03, 0.045, 0.52, 6]} />
          </mesh>
        </group>
      </group>
      <group ref={(g) => void (parts.head = g)} position={[0, 0.6, 0.38]}>
        <mesh material={m.fur} scale={0.19}>
          <sphereGeometry args={[1, 14, 10]} />
        </mesh>
        {look.pattern === "mask" ? (
          <mesh material={m.accent} position={[0, -0.02, 0.07]} scale={[0.15, 0.13, 0.14]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ) : null}
        {[-0.095, 0.095].map((x) => (
          <mesh key={x} material={look.pattern === "mask" ? m.accent : m.fur} position={[x, 0.18, 0]} rotation-z={-x * 2.2}>
            <coneGeometry args={[0.06, 0.14, 4]} />
          </mesh>
        ))}
        {[-0.065, 0.065].map((x, i) => (
          <mesh key={x} material={m.eye} position={[x, 0.03, 0.165]} ref={(e) => void (parts.eyes[i] = e)}>
            <sphereGeometry args={[0.024, 6, 6]} />
          </mesh>
        ))}
        <mesh material={m.nose} position={[0, -0.03, 0.188]}>
          <sphereGeometry args={[0.014, 5, 5]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Pose the parts for a mood. `phase` drives the walk cycle and the tail;
 * `purr` adds a little head bob. Returns nothing: it writes the refs.
 */
export function poseCat(p: CatParts, mood: string, phase: number, purr: number, still: boolean) {
  const walk = mood === "walk";
  const sit = mood === "sit" || mood === "watch" || mood === "petted" || mood === "groom";
  const sleep = mood === "sleep";
  const swing = walk && !still ? Math.sin(phase * 9) * 0.6 : 0;
  p.legs.forEach((l, i) => {
    if (!l) return;
    l.rotation.x = (i === 0 || i === 3 ? swing : -swing) + (sit && i >= 2 ? -1.2 : 0);
    l.visible = !sleep;
    l.position.y = sit && i >= 2 ? 0.17 : 0.26;
  });
  if (p.body) {
    p.body.position.y = sleep ? 0.18 : sit ? 0.36 : 0.34;
    p.body.rotation.x = sit ? -0.42 : 0;
    p.body.scale.set(sleep ? 1.1 : 1, sleep ? 0.8 : 1, sleep ? 0.85 : 1);
  }
  if (p.head) {
    p.head.position.set(0, sleep ? 0.2 : sit ? 0.74 : 0.6, sleep ? 0.34 : sit ? 0.26 : 0.38);
    const bob = still ? 0 : purr > 0 ? Math.sin(phase * 14) * 0.05 : mood === "groom" ? Math.sin(phase * 5) * 0.25 : 0;
    p.head.rotation.x = (mood === "groom" ? 0.55 : 0) + bob;
    p.head.rotation.z = mood === "petted" && !still ? Math.sin(phase * 3) * 0.15 : 0;
  }
  if (p.tail) p.tail.rotation.z = still ? 0 : Math.sin(phase * (sleep ? 0.8 : 2.2)) * (sleep ? 0.1 : 0.35);
  if (p.tail) p.tail.rotation.x = sleep ? 1.3 : sit ? 1.0 : 0;
  // Sleepy cats close their eyes.
  for (const e of p.eyes) if (e) e.scale.y = sleep ? 0.15 : purr > 0 ? 0.45 : 1;
}
