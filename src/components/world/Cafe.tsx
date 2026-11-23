"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { HUE_HEX } from "@/lib/sections";
import { CAFE_DOOR, CAFE_RECT, CAFE_ROOF_Y, CAFE_SOLIDS } from "@/lib/world-map";
import { avatar, cafe, useGame } from "@/store/game";
import { CatModel, newCatParts, poseCat, type CatParts } from "./CatModel";
import { glowTexture, heartTexture, signTexture } from "./textures";

const r = CAFE_RECT;
const W = r.x1 - r.x0;
const D = r.z1 - r.z0;
const CX = (r.x0 + r.x1) / 2;
const CZ = (r.z0 + r.z1) / 2;

/** Furniture rows of CAFE_SOLIDS (after the five walls and the roof). */
const [COUNTER, ...REST] = CAFE_SOLIDS.slice(6);
const TABLES = REST.filter((b) => b.h < 1);
const TREE = REST.find((b) => b.h > 2)!;

/** Cushions on the floor, where cats like to nap (visual only). */
const CUSHIONS: [number, number, string][] = [
  [43, -45.2, "#b24a5c"],
  [47.6, -55.4, "#3f7d7a"],
  [51.8, -46, "#c98b3c"],
  [57.2, -51, "#6c5cff"],
];

function useMaterials() {
  return useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({ color: "#2a2230", roughness: 0.85 }),
      inner: new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.9 }),
      floor: new THREE.MeshStandardMaterial({ color: "#6b4a33", roughness: 0.75 }),
      wood: new THREE.MeshStandardMaterial({ color: "#8a5f3c", roughness: 0.7 }),
      sisal: new THREE.MeshStandardMaterial({ color: "#c2a77a", roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: "#1a1620", roughness: 0.8 }),
      lamp: new THREE.MeshBasicMaterial({ color: "#ffcf8a", toneMapped: false }),
      window: new THREE.MeshBasicMaterial({ color: "#ffb86b", toneMapped: false, transparent: true, opacity: 0.85 }),
      awning: new THREE.MeshStandardMaterial({ color: HUE_HEX.amber, roughness: 0.6, emissive: "#3a2006" }),
    }),
    [],
  );
}

/** The café pavilion: walls, roof and awning, warm windows, a sign and the furniture. */
function Building() {
  const m = useMaterials();
  const sign = useMemo(() => signTexture("猫カフェ FUWA", HUE_HEX.amber, false), []);
  const glow = useMemo(() => glowTexture(), []);
  const walls = CAFE_SOLIDS.slice(0, 5);
  return (
    <group>
      {/* Wooden floor, just above the paving. */}
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0.02, CZ]} material={m.floor}>
        <planeGeometry args={[W - 0.8, D - 0.8]} />
      </mesh>
      {walls.map((b, i) => (
        <mesh key={i} material={m.wall} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
        </mesh>
      ))}
      {/* Warm windows along the back and sides, inside face. */}
      {[0.2, 0.5, 0.8].map((f) => (
        <mesh key={`b${f}`} material={m.window} position={[r.x0 + W * f, 2.1, r.z0 + 0.42]}>
          <planeGeometry args={[3.2, 1.3]} />
        </mesh>
      ))}
      {[0.3, 0.7].map((f) => (
        <group key={`s${f}`}>
          <mesh material={m.window} position={[r.x0 + 0.42, 2.1, r.z0 + D * f]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[3, 1.3]} />
          </mesh>
          <mesh material={m.window} position={[r.x1 - 0.42, 2.1, r.z0 + D * f]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[3, 1.3]} />
          </mesh>
        </group>
      ))}
      {/* Roof, with a striped awning over the open front. */}
      <mesh material={m.roof} position={[CX, CAFE_ROOF_Y + 0.15, CZ]}>
        <boxGeometry args={[W + 0.6, 0.3, D + 0.6]} />
      </mesh>
      <mesh material={m.awning} position={[CX, CAFE_ROOF_Y - 0.25, r.z1 + 0.9]} rotation-x={0.35}>
        <boxGeometry args={[W + 0.6, 0.08, 1.8]} />
      </mesh>
      {/* Sign above the doorway, and a glow under the awning. */}
      <mesh position={[(CAFE_DOOR.x0 + CAFE_DOOR.x1) / 2, CAFE_ROOF_Y + 1.05, r.z1 + 0.32]}>
        <planeGeometry args={[6.4, 1.6]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <sprite position={[(CAFE_DOOR.x0 + CAFE_DOOR.x1) / 2, 2.6, r.z1 + 0.6]} scale={[12, 5, 1]}>
        <spriteMaterial map={glow} color="#ffb547" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* Hanging lamps. */}
      {[
        [45, -47],
        [50, -50.5],
        [54.5, -48],
        [45, -53],
        [54.5, -54],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, CAFE_ROOF_Y - 0.9, z]}>
          <mesh material={m.roof} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.9, 4]} />
          </mesh>
          <mesh material={m.lamp}>
            <sphereGeometry args={[0.16, 10, 8]} />
          </mesh>
          <sprite scale={[2.2, 2.2, 1]}>
            <spriteMaterial map={glow} color="#ffcf8a" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}
      {/* Counter, tables, cushions and the cat tree. */}
      <mesh material={m.wood} position={[COUNTER.x, COUNTER.h / 2, COUNTER.z]}>
        <boxGeometry args={[COUNTER.w, COUNTER.h, COUNTER.d]} />
      </mesh>
      {TABLES.map((t) => (
        <group key={`${t.x}${t.z}`} position={[t.x, 0, t.z]}>
          <mesh material={m.wood} position={[0, t.h - 0.04, 0]}>
            <boxGeometry args={[t.w, 0.08, t.d]} />
          </mesh>
          <mesh material={m.roof} position={[0, (t.h - 0.08) / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.12, t.h - 0.08, 6]} />
          </mesh>
        </group>
      ))}
      {CUSHIONS.map(([x, z, c]) => (
        <mesh key={`${x}${z}`} position={[x, 0.07, z]}>
          <cylinderGeometry args={[0.45, 0.48, 0.1, 14]} />
          <meshStandardMaterial color={c} roughness={0.95} />
        </mesh>
      ))}
      <group position={[TREE.x, 0, TREE.z]}>
        <mesh material={m.sisal} position={[0, TREE.h / 2, 0]}>
          <cylinderGeometry args={[0.12, 0.14, TREE.h, 8]} />
        </mesh>
        {[0.9, 1.75, TREE.h].map((y) => (
          <mesh key={y} material={m.inner} position={[0, y, 0]}>
            <boxGeometry args={[TREE.w, 0.08, TREE.d]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function hoverOn(e: ThreeEvent<PointerEvent>) {
  e.stopPropagation();
  document.body.dataset.hover = "1";
}
function hoverOff() {
  delete document.body.dataset.hover;
}

/** The six cats: simulated in lib/cats, posed here, petted by click, tap or E. */
function Cats() {
  const reducedMotion = useGame((s) => s.reducedMotion);
  const [parts] = useState<CatParts[]>(() => cafe.cats.map(() => newCatParts()));
  const [roots] = useState<(THREE.Group | null)[]>(() => cafe.cats.map(() => null));
  const [hearts] = useState<(THREE.Sprite | null)[]>(() => cafe.cats.map(() => null));
  const heart = useMemo(() => heartTexture(), []);
  const phase = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const far = Math.hypot(avatar.x - (r.x0 + r.x1) / 2, avatar.z - (r.z0 + r.z1) / 2) > 90;
    // Cats keep living while you're away, at a slower tick.
    cafe.step(far ? dt * 0.5 : dt, avatar);
    if (far) return;
    phase.current += dt;
    cafe.cats.forEach((c, i) => {
      const g = roots[i];
      if (g) {
        g.position.set(c.x, 0.02, c.z);
        g.rotation.y = c.heading;
      }
      poseCat(parts[i], c.mood, phase.current + i * 1.7, c.purr, reducedMotion);
      const h = hearts[i];
      if (h) {
        h.visible = c.hearts > 0;
        const k = 1 - c.hearts / 1.8;
        h.position.set(c.x, 1.0 + k * 0.9, c.z);
        (h.material as THREE.SpriteMaterial).opacity = Math.min(1, c.hearts * 1.5);
        h.scale.setScalar(0.32 + k * 0.12);
      }
    });
  });

  return (
    <group>
      {cafe.cats.map((c, i) => (
        <group key={c.name}>
          <group
            ref={(g) => void (roots[i] = g)}
            onClick={(e) => {
              e.stopPropagation();
              if (e.delta > 6) return;
              petCat(i);
            }}
            onPointerOver={hoverOn}
            onPointerOut={hoverOff}
          >
            <CatModel look={c.look} parts={parts[i]} />
            {/* A generous invisible hit box, so the cat is easy to tap. */}
            <mesh position={[0, 0.4, 0]} visible={false}>
              <boxGeometry args={[0.9, 0.9, 1.2]} />
            </mesh>
          </group>
          <sprite ref={(s) => void (hearts[i] = s)} visible={false}>
            <spriteMaterial map={heart} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/** Pet café cat i (also reached with E through the store's interact). */
export function petCat(i: number) {
  useGame.getState().petCafeCat(i);
}

export function Cafe() {
  return (
    <group>
      <Building />
      <Cats />
    </group>
  );
}
