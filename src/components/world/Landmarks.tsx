"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BACKROOM_AT, HUE_HEX, SECTIONS, type Section, type SectionId } from "@/lib/sections";
import { useGame } from "@/store/game";
import { JOKES } from "@/lib/jokes";
import { music } from "@/lib/music/engine";
import { JUKEBOX_AT } from "@/lib/world-map";
import { glowTexture, screenTexture, signTexture, slipTexture } from "./textures";

/* Shared, cheap materials. Neon parts are unlit basic materials: they carry their own light. */
const darkMetal = new THREE.MeshStandardMaterial({ color: "#1a1c2b", roughness: 0.55, metalness: 0.6 });
const darkWood = new THREE.MeshStandardMaterial({ color: "#2b1d1f", roughness: 0.8 });
const neon = (hex: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color: hex, toneMapped: false, transparent: opacity < 1, opacity });

function hoverOn(e: ThreeEvent<PointerEvent>) {
  e.stopPropagation();
  document.body.dataset.hover = "1";
}
function hoverOff() {
  delete document.body.dataset.hover;
}

/** Click handler that ignores the end of a camera drag. */
function useClick(fn: () => void) {
  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    fn();
  };
}

function Glow({ color, size, y = 0, opacity = 0.5 }: { color: string; size: number; y?: number; opacity?: number }) {
  const map = useMemo(() => glowTexture(), []);
  return (
    <sprite position={[0, y, 0]} scale={[size, size, 1]}>
      <spriteMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}

/* ─────────────── Quest marker above each landmark ─────────────── */

function Beacon({ section, height }: { section: Section; height: number }) {
  const ref = useRef<THREE.Group>(null);
  const near = useGame((s) => s.near === section.id);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const color = HUE_HEX[section.hue];
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.elapsedTime;
    ref.current.position.y = height + Math.sin(t * 1.6 + section.at[0]) * 0.18;
    ref.current.rotation.y = t * 0.9;
  });
  return (
    <group>
      <group ref={ref} position={[0, height, 0]}>
        <mesh material={useMemo(() => neon(color), [color])} scale={[0.32, 0.5, 0.32]}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
        <Glow color={color} size={near ? 3.2 : 2.2} opacity={near ? 0.75 : 0.45} />
      </group>
    </group>
  );
}

/* ─────────────── The six landmarks ─────────────── */

function MirrorBooth({ color }: { color: string }) {
  const sign = useMemo(() => signTexture("人物", color, true), [color]);
  return (
    <group>
      <mesh material={darkMetal} position={[-0.85, 1.5, 0]}>
        <boxGeometry args={[0.16, 3, 0.16]} />
      </mesh>
      <mesh material={darkMetal} position={[0.85, 1.5, 0]}>
        <boxGeometry args={[0.16, 3, 0.16]} />
      </mesh>
      <mesh material={darkMetal} position={[0, 3.05, 0]}>
        <boxGeometry args={[2, 0.14, 0.4]} />
      </mesh>
      <mesh material={darkMetal} position={[0, 1.5, -0.12]}>
        <boxGeometry args={[1.56, 2.9, 0.06]} />
      </mesh>
      <mesh position={[0, 1.5, -0.05]} material={useMemo(() => neon(color, 0.16), [color])}>
        <planeGeometry args={[1.5, 2.8]} />
      </mesh>
      {/* Lit edge of the mirror */}
      <mesh position={[0, 0.08, 0]} material={useMemo(() => neon(color), [color])}>
        <boxGeometry args={[1.6, 0.04, 0.3]} />
      </mesh>
      <mesh position={[1.05, 2.2, 0.05]}>
        <planeGeometry args={[0.36, 1.1]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
    </group>
  );
}

function NoticeBoard({ color }: { color: string }) {
  const slips = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    let s = 3;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 16; i++) {
      out.push({ p: [-1.75 + (i % 6) * 0.7 + rnd() * 0.12, 1.2 + Math.floor(i / 6) * 0.72 + rnd() * 0.1, 0.12], r: (rnd() - 0.5) * 0.25 });
    }
    return out;
  }, []);
  const slip = useMemo(() => slipTexture(), []);
  const lantern = useMemo(() => neon(color), [color]);
  const header = useMemo(() => signTexture("依頼", color, false), [color]);
  return (
    <group>
      <mesh material={darkWood} position={[0, 1.95, 0]}>
        <boxGeometry args={[4.4, 2.5, 0.18]} />
      </mesh>
      <mesh material={darkWood} position={[-2, 0.6, 0]}>
        <boxGeometry args={[0.18, 1.3, 0.18]} />
      </mesh>
      <mesh material={darkWood} position={[2, 0.6, 0]}>
        <boxGeometry args={[0.18, 1.3, 0.18]} />
      </mesh>
      <mesh material={darkWood} position={[0, 3.35, 0.05]}>
        <boxGeometry args={[4.9, 0.18, 0.5]} />
      </mesh>
      {slips.map((s, i) => (
        <mesh key={i} position={s.p} rotation-z={s.r}>
          <planeGeometry args={[0.52, 0.64]} />
          <meshBasicMaterial map={slip} toneMapped={false} color={i % 5 === 0 ? "#ffd2d6" : "#ffffff"} />
        </mesh>
      ))}
      <mesh position={[0, 3.85, 0.1]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={header} toneMapped={false} />
      </mesh>
      {[-2.3, 2.3].map((x) => (
        <group key={x} position={[x, 2.95, 0.3]}>
          <mesh material={lantern} scale={[0.26, 0.36, 0.26]}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
          <Glow color={color} size={1.6} opacity={0.6} />
        </group>
      ))}
    </group>
  );
}

function LightShrine({ color }: { color: string }) {
  const mat = useMemo(() => neon(color), [color]);
  const dim = useMemo(() => neon(color, 0.35), [color]);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const nodes = useRef<THREE.Group>(null);
  const { points, lines } = useMemo(() => {
    const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0));
    }
    const seg: number[] = [];
    for (let i = 1; i < pts.length; i++) seg.push(0, 0, 0, pts[i].x, pts[i].y, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return { points: pts, lines: g };
  }, []);
  useFrame((_, dt) => {
    if (nodes.current && !reducedMotion) nodes.current.rotation.z += dt * 0.25;
  });
  return (
    <group>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} material={mat} position={[x, 2, 0]}>
          <cylinderGeometry args={[0.13, 0.16, 4, 8]} />
        </mesh>
      ))}
      <mesh material={mat} position={[0, 4.12, 0]}>
        <boxGeometry args={[4.8, 0.22, 0.32]} />
      </mesh>
      <mesh material={mat} position={[0, 3.45, 0]}>
        <boxGeometry args={[3.7, 0.14, 0.2]} />
      </mesh>
      <group ref={nodes} position={[0, 2.1, 0]}>
        <lineSegments geometry={lines}>
          <lineBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
        </lineSegments>
        {points.map((p, i) => (
          <mesh key={i} position={p} material={i === 0 ? mat : dim} scale={i === 0 ? 0.16 : 0.1}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </group>
      <Glow color={color} size={5} y={2.2} opacity={0.32} />
    </group>
  );
}

function RecordTower({ color }: { color: string }) {
  const rings = useRef<THREE.Group>(null);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const mat = useMemo(() => neon(color), [color]);
  useFrame((_, dt) => {
    if (!rings.current || reducedMotion) return;
    rings.current.children.forEach((c, i) => (c.rotation.z += dt * (i % 2 ? 0.3 : -0.22)));
  });
  return (
    <group>
      <mesh material={darkMetal} position={[0, 3, 0]}>
        <cylinderGeometry args={[0.45, 0.6, 6, 6]} />
      </mesh>
      <group ref={rings}>
        {[1.2, 2.3, 3.4, 4.5, 5.6].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={mat}>
            <torusGeometry args={[0.95 - i * 0.07, 0.035, 6, 40, Math.PI * (1.2 + (i % 3) * 0.25)]} />
          </mesh>
        ))}
      </group>
      <Glow color={color} size={4} y={3} opacity={0.3} />
    </group>
  );
}

function StreetTerminal({ color }: { color: string }) {
  const screen = useMemo(() => screenTexture(), []);
  const reducedMotion = useGame((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (!reducedMotion) screen.offset.y = (screen.offset.y + dt * 0.04) % 1;
  });
  return (
    <group>
      <mesh material={darkMetal} position={[0, 0.6, 0]}>
        <boxGeometry args={[1.1, 1.2, 0.7]} />
      </mesh>
      <mesh material={darkMetal} position={[0, 1.6, -0.1]} rotation-x={-0.25}>
        <boxGeometry args={[1.2, 1.2, 0.12]} />
      </mesh>
      <mesh position={[0, 1.6, -0.02]} rotation-x={-0.25}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <Glow color={color} size={2.4} y={1.6} opacity={0.35} />
    </group>
  );
}

function SignalMast({ color }: { color: string }) {
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  const reducedMotion = useGame((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.opacity = reducedMotion ? 1 : 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 3) > 0 ? 1 : 0);
  });
  return (
    <group>
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[0.12, 0.7, 7, 4, 7, true]} />
        <meshBasicMaterial color={color} wireframe toneMapped={false} transparent opacity={0.65} />
      </mesh>
      <mesh material={darkMetal} position={[0.35, 5.2, 0.2]} rotation={[0.5, 0.4, 0]}>
        <sphereGeometry args={[0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3.2]} />
      </mesh>
      <mesh position={[0, 7.1, 0]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshBasicMaterial ref={lamp} color={color} toneMapped={false} transparent />
      </mesh>
      <Glow color={color} size={1.8} y={7.1} opacity={0.6} />
    </group>
  );
}

const MODELS: Record<SectionId, { C: (p: { color: string }) => React.ReactNode; beacon: number }> = {
  profile: { C: MirrorBooth, beacon: 4.1 },
  quests: { C: NoticeBoard, beacon: 4.9 },
  skills: { C: LightShrine, beacon: 5.0 },
  log: { C: RecordTower, beacon: 6.9 },
  terminal: { C: StreetTerminal, beacon: 3.2 },
  contact: { C: SignalMast, beacon: 8.1 },
};

function Landmark({ section }: { section: Section }) {
  const open = useGame((s) => s.open);
  const onClick = useClick(() => open(section.id));
  const { C, beacon } = MODELS[section.id];
  const rot = Math.atan2(-section.at[0], -section.at[1]);
  return (
    <group position={[section.at[0], 0, section.at[1]]}>
      <group rotation-y={rot} onClick={onClick} onPointerOver={hoverOn} onPointerOut={hoverOff}>
        <C color={HUE_HEX[section.hue]} />
        {/* Generous invisible hit area so small props are easy to click. */}
        <mesh position={[0, 2, 0]} visible={false}>
          <boxGeometry args={[3.6, 4.4, 2]} />
        </mesh>
      </group>
      <Beacon section={section} height={beacon} />
    </group>
  );
}

/* ─────────────── Vending machine: a joke per can ─────────────── */

function VendingMachine() {
  const unlock = useGame((s) => s.unlock);
  const toast = useGame((s) => s.toast);
  const n = useRef(0);
  const onClick = useClick(() => {
    const j = JOKES[n.current++ % JOKES.length];
    toast({ tone: "info", title: "Vending machine dispensed a can", body: j });
    unlock("vending");
  });
  const panel = useMemo(() => neon("#d6f5ff", 0.85), []);
  const cans = ["#ff3b4f", "#3ee8e0", "#ffb547", "#8b6cff"];
  return (
    <group position={[-11.4, 0, 3.4]} rotation-y={Math.atan2(11.4, -3.4)} onClick={onClick} onPointerOver={hoverOn} onPointerOut={hoverOff}>
      <mesh material={darkMetal} position={[0, 1.05, 0]}>
        <boxGeometry args={[1.1, 2.1, 0.8]} />
      </mesh>
      <mesh position={[-0.12, 1.3, 0.41]} material={panel}>
        <planeGeometry args={[0.7, 1.3]} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.36 + (i % 4) * 0.16, 0.85 + Math.floor(i / 4) * 0.4, 0.43]}>
          <boxGeometry args={[0.09, 0.2, 0.02]} />
          <meshBasicMaterial color={cans[i % 4]} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0.4, 1.2, 0.41]}>
        <planeGeometry args={[0.14, 0.3]} />
        <meshBasicMaterial color="#ffb547" toneMapped={false} />
      </mesh>
      <Glow color="#bfefff" size={2.6} y={1.3} opacity={0.3} />
    </group>
  );
}

/* ─────────────── Jukebox: plays the site's music ─────────────── */

function Jukebox() {
  const interact = useGame((s) => s.interact);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const onClick = useClick(() => interact("jukebox"));
  const tubes = useMemo(() => ["#ff3b4f", "#ffb547", "#3ee8e0", "#8b6cff"].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true })), []);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const disc = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => glowTexture(), []);
  useFrame(({ clock }, dt) => {
    const l = music.level();
    const playing = music.getState().playing;
    tubes.forEach((m, i) => {
      // Tubes pulse with the music; idle, they breathe slowly.
      const idle = 0.45 + 0.15 * Math.sin(clock.elapsedTime * 1.3 + i);
      m.opacity = playing ? Math.min(1, 0.5 + l * (1.2 + i * 0.2)) : reducedMotion ? 0.6 : idle;
    });
    if (halo.current) halo.current.opacity = playing ? 0.3 + l * 0.6 : 0.22;
    if (disc.current && playing && !reducedMotion) disc.current.rotation.y += dt * 3.5;
  });
  const [x, z] = JUKEBOX_AT;
  return (
    <group position={[x, 0, z]} rotation-y={Math.atan2(-x, -z)} onClick={onClick} onPointerOver={hoverOn} onPointerOut={hoverOff}>
      {/* Cabinet with an arched top. */}
      <mesh material={darkWood} position={[0, 0.8, 0]}>
        <boxGeometry args={[1.2, 1.6, 0.7]} />
      </mesh>
      <mesh material={darkWood} position={[0, 1.6, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.6, 0.6, 0.7, 24, 1, false, 0, Math.PI]} />
      </mesh>
      {/* Glass front with a spinning record. */}
      <mesh position={[0, 1.55, 0.36]}>
        <circleGeometry args={[0.42, 32, 0, Math.PI]} />
        <meshBasicMaterial color="#120f24" transparent opacity={0.9} />
      </mesh>
      <mesh ref={disc} material={darkMetal} position={[0, 1.68, 0.3]} rotation-x={Math.PI / 2 - 0.4}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 24]} />
      </mesh>
      {/* Neon tubes: two arches and two side columns. */}
      <mesh material={tubes[0]} position={[0, 1.6, 0.37]}>
        <torusGeometry args={[0.55, 0.035, 6, 32, Math.PI]} />
      </mesh>
      <mesh material={tubes[1]} position={[0, 1.6, 0.37]}>
        <torusGeometry args={[0.47, 0.025, 6, 32, Math.PI]} />
      </mesh>
      {[-0.55, 0.55].map((dx, i) => (
        <mesh key={dx} material={tubes[2 + i]} position={[dx, 0.85, 0.37]}>
          <boxGeometry args={[0.06, 1.5, 0.06]} />
        </mesh>
      ))}
      {/* Speaker grille. */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} material={darkMetal} position={[0, 0.35 + i * 0.12, 0.36]}>
          <boxGeometry args={[0.8, 0.03, 0.02]} />
        </mesh>
      ))}
      <sprite position={[0, 1.2, 0.6]} scale={[3.4, 3.4, 1]}>
        <spriteMaterial ref={halo} map={glow} color="#ffb547" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <mesh position={[0, 1.2, 0.2]} visible={false}>
        <boxGeometry args={[1.6, 2.6, 1.4]} />
      </mesh>
    </group>
  );
}

/* ─────────────── The back alley ─────────────── */

function Cat() {
  const petCat = useGame((s) => s.petCat);
  const toast = useGame((s) => s.toast);
  const pets = useGame((s) => s.catPets);
  const tail = useRef<THREE.Group>(null);
  const reducedMotion = useGame((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (tail.current && !reducedMotion) tail.current.rotation.z = Math.sin(clock.elapsedTime * 2.2) * 0.35;
  });
  const onClick = useClick(() => {
    petCat();
    toast({ tone: "info", title: pets > 4 ? "The cat has had enough" : "Purr", body: pets > 4 ? "It walks off, then comes back. Cats." : `Pets given: ${pets + 1}` });
  });
  const fur = useMemo(() => new THREE.MeshStandardMaterial({ color: "#16161c", roughness: 0.9 }), []);
  const eye = useMemo(() => neon("#ffb547"), []);
  return (
    <group position={[BACKROOM_AT[0] + 1.6, 0, BACKROOM_AT[1] + 0.6]} rotation-y={0.8} onClick={onClick} onPointerOver={hoverOn} onPointerOut={hoverOff}>
      <mesh material={fur} position={[0, 0.32, 0]} scale={[0.26, 0.24, 0.48]}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh material={fur} position={[0, 0.6, 0.4]} scale={0.2}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} material={fur} position={[x, 0.8, 0.42]}>
          <coneGeometry args={[0.06, 0.14, 4]} />
        </mesh>
      ))}
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} material={eye} position={[x, 0.63, 0.58]}>
          <sphereGeometry args={[0.025, 6, 6]} />
        </mesh>
      ))}
      <group ref={tail} position={[0, 0.4, -0.42]}>
        <mesh material={fur} position={[0, 0.25, -0.05]} rotation-x={-0.4}>
          <cylinderGeometry args={[0.035, 0.05, 0.55, 6]} />
        </mesh>
      </group>
      <mesh position={[0, 0.5, 0]} visible={false}>
        <boxGeometry args={[1, 1.2, 1.4]} />
      </mesh>
    </group>
  );
}

function Backroom() {
  const open = useGame((s) => s.open);
  const onArcade = useClick(() => open("backroom"));
  const lantern = useMemo(() => neon("#ff3b4f"), []);
  const screen = useMemo(() => neon("#8b6cff", 0.9), []);
  return (
    <group>
      {/* A string of lanterns down the alley. */}
      {Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const x = -11.5 + (BACKROOM_AT[0] + 11.5) * t;
        const z = -12.2 + (BACKROOM_AT[1] + 12.2) * t;
        return (
          <group key={i} position={[x, 3.4 - Math.sin(t * Math.PI) * 0.3, z]}>
            <mesh material={lantern} scale={[0.17, 0.24, 0.17]}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
            <Glow color="#ff3b4f" size={1.3} opacity={0.5} />
          </group>
        );
      })}
      <group position={[BACKROOM_AT[0] - 1.4, 0, BACKROOM_AT[1] - 1.4]} rotation-y={Math.PI / 4} onClick={onArcade} onPointerOver={hoverOn} onPointerOut={hoverOff}>
        <mesh material={darkMetal} position={[0, 0.95, 0]}>
          <boxGeometry args={[0.9, 1.9, 0.8]} />
        </mesh>
        <mesh position={[0, 1.35, 0.41]} rotation-x={-0.2} material={screen}>
          <planeGeometry args={[0.7, 0.55]} />
        </mesh>
        <Glow color="#8b6cff" size={2.6} y={1.35} opacity={0.4} />
      </group>
      <Cat />
    </group>
  );
}

export function Landmarks() {
  return (
    <>
      {SECTIONS.map((s) => (
        <Landmark key={s.id} section={s} />
      ))}
      <VendingMachine />
      <Jukebox />
      <Backroom />
    </>
  );
}
