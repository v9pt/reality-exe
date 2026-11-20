"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CABINETS, gameById } from "@/lib/arcade";
import { DISTRICTS, HUE_HEX } from "@/lib/sections";
import {
  ARCADE_RECT,
  AVENUE_HALF,
  CABINET_X,
  CABINET_Z,
  HIGHWAY_HALF,
  HIGHWAY_PILLARS,
  HIGHWAY_R,
  HIGHWAY_Y,
  OVERLOOK_RECT,
  OVERLOOK_Y,
  POND,
  RAMP_RECT,
  RING_R0,
  RING_R1,
  TREES,
  GATE_POSTS,
  mulberry32,
} from "@/lib/world-map";
import { useGame, type Quality } from "@/store/game";
import { fogUniforms } from "./City";
import { carFragment, carVertex } from "./shaders";
import { cabinetTexture, glowTexture, signTexture } from "./textures";

const darkMetal = new THREE.MeshStandardMaterial({ color: "#1a1c2b", roughness: 0.55, metalness: 0.6 });
const deckMat = new THREE.MeshStandardMaterial({ color: "#151726", roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide });
const neon = (hex: string, opacity = 1) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false, transparent: opacity < 1, opacity });

function hoverOn(e: ThreeEvent<PointerEvent>) {
  e.stopPropagation();
  document.body.dataset.hover = "1";
}
function hoverOff() {
  delete document.body.dataset.hover;
}

function Glow({ color, size, position, opacity = 0.5 }: { color: string; size: number; position: [number, number, number]; opacity?: number }) {
  const map = useMemo(() => glowTexture(), []);
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}

/** Fill an instanced mesh from a list of matrices once. */
function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[]) {
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, matrices]);
}

const compose = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

/* ───────────────────────── Arcade strip ───────────────────────── */

function Cabinet({ index }: { index: number }) {
  const id = CABINETS[index];
  const meta = gameById(id)!;
  const color = HUE_HEX[meta.hue];
  const openGame = useGame((s) => s.openGame);
  const screen = useMemo(() => cabinetTexture(meta.title, meta.glyph, color), [meta, color]);
  const trim = useMemo(() => neon(color), [color]);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    openGame(id);
  };
  return (
    <group position={[CABINET_X, 0, CABINET_Z[index]]} rotation-y={-Math.PI / 2} onClick={onClick} onPointerOver={hoverOn} onPointerOut={hoverOff}>
      <mesh material={darkMetal} position={[0, 1.05, 0]}>
        <boxGeometry args={[1.3, 2.1, 1.0]} />
      </mesh>
      <mesh material={darkMetal} position={[0, 1.0, 0.55]} rotation-x={-0.5}>
        <boxGeometry args={[1.3, 0.12, 0.5]} />
      </mesh>
      <mesh position={[0, 1.55, 0.51]} rotation-x={-0.12}>
        <planeGeometry args={[1.05, 0.82]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <mesh material={trim} position={[0, 2.18, 0.42]}>
        <boxGeometry args={[1.32, 0.22, 0.18]} />
      </mesh>
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} material={trim} position={[x, 1.05, 0.5]}>
          <boxGeometry args={[0.04, 2.1, 0.04]} />
        </mesh>
      ))}
      <Glow color={color} size={3.2} position={[0, 1.55, 0.9]} opacity={0.42} />
      {/* Generous hit area. */}
      <mesh position={[0, 1.2, 0.3]} visible={false}>
        <boxGeometry args={[1.6, 2.6, 1.8]} />
      </mesh>
    </group>
  );
}

function ArcadeStrip() {
  const color = HUE_HEX.violet;
  const sign = useMemo(() => signTexture("遊技場", color, false), [color]);
  const word = useMemo(() => signTexture("ARCADE", HUE_HEX.crimson, false), []);
  const beam = useMemo(() => neon(color), [color]);
  const x0 = ARCADE_RECT.x0;
  return (
    <group>
      {/* Entrance arch over the avenue. */}
      {[-AVENUE_HALF - 0.6, AVENUE_HALF + 0.6].map((z) => (
        <mesh key={z} material={darkMetal} position={[x0, 3, z]}>
          <boxGeometry args={[0.5, 6, 0.5]} />
        </mesh>
      ))}
      <mesh material={beam} position={[x0, 6.1, 0]}>
        <boxGeometry args={[0.4, 0.3, AVENUE_HALF * 2 + 2]} />
      </mesh>
      <mesh position={[x0 - 0.3, 7.1, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[5, 1.6]} />
        <meshBasicMaterial map={sign} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <Glow color={color} size={9} position={[x0 - 0.6, 6.6, 0]} opacity={0.35} />
      {/* The big word over the cabinets. */}
      <mesh position={[ARCADE_RECT.x1 - 0.4, 6.5, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[12, 2.6]} />
        <meshBasicMaterial map={word} toneMapped={false} />
      </mesh>
      <Glow color={HUE_HEX.crimson} size={16} position={[ARCADE_RECT.x1 - 1, 6.5, 0]} opacity={0.25} />
      {/* Back wall behind the cabinets. */}
      <mesh material={darkMetal} position={[ARCADE_RECT.x1 + 0.4, 4, 0]}>
        <boxGeometry args={[0.6, 8, ARCADE_RECT.z1 - ARCADE_RECT.z0]} />
      </mesh>
      {CABINETS.map((_, i) => (
        <Cabinet key={i} index={i} />
      ))}
      {/* Neon floor strips leading in. */}
      {[-5, 5].map((z) => (
        <mesh key={z} material={beam} position={[(x0 + CABINET_X) / 2, 0.03, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[CABINET_X - x0 - 3, 0.08]} />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────── Garden ───────────────────────── */

function Garden() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const benches = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const water = useRef<THREE.MeshBasicMaterial>(null);
  const { trunkM, crownM, benchM } = useMemo(() => {
    const rand = mulberry32(5);
    const trunkM = TREES.map(([x, z]) => compose(x, 1.1, z, 1, 1, 1));
    const crownM = TREES.map(([x, z]) => {
      const s = 1.4 + rand() * 0.6;
      return compose(x, 2.9 + rand() * 0.4, z, s, s * 1.1, s, rand() * 3);
    });
    const benchM = [0.6, 2.2, 3.8, 5.2].map((a) => {
      const r = POND.r + 2.2;
      return compose(POND.x + Math.cos(a) * r, 0.45, POND.z + Math.sin(a) * r, 1.8, 0.12, 0.6, -a + Math.PI / 2);
    });
    return { trunkM, crownM, benchM };
  }, []);
  useInstances(trunks, trunkM);
  useInstances(crowns, crownM);
  useInstances(benches, benchM);
  const crownMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#123a3a", roughness: 0.9, emissive: "#062020" }), []);
  const bark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b1d1f", roughness: 0.9 }), []);
  useFrame(({ clock }) => {
    if (water.current && !reducedMotion) water.current.color.setHSL(0.6, 0.6, 0.07 + Math.sin(clock.elapsedTime * 0.8) * 0.012);
  });
  const lanterns = useMemo(() => neon(HUE_HEX.amber), []);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, bark, trunkM.length]}>
        <cylinderGeometry args={[0.16, 0.24, 2.2, 6]} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, crownMat, crownM.length]}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={benches} args={[undefined, darkMetal, benchM.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Pond with a lit rim. */}
      <mesh position={[POND.x, 0.04, POND.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[POND.r, 40]} />
        <meshBasicMaterial ref={water} color="#0a1630" />
      </mesh>
      <mesh position={[POND.x, 0.08, POND.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[POND.r, POND.r + 0.18, 48]} />
        <meshBasicMaterial color={HUE_HEX.cyan} toneMapped={false} transparent opacity={0.7} />
      </mesh>
      {/* Floating lanterns on the water. */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = i * 1.3;
        const r = 1 + (i % 3) * 0.9;
        return (
          <group key={i} position={[POND.x + Math.cos(a) * r, 0.25, POND.z + Math.sin(a) * r]}>
            <mesh material={lanterns} scale={[0.14, 0.18, 0.14]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
            <Glow color={HUE_HEX.amber} size={1.4} position={[0, 0, 0]} opacity={0.5} />
          </group>
        );
      })}
      {/* Torii-like gate at the entrance (original design, not a shrine replica). */}
      <group position={[GATE_POSTS[0][0], 0, 0]}>
        {GATE_POSTS.map(([, z]) => (
          <mesh key={z} material={neon(HUE_HEX.crimson)} position={[0, 2.3, z]}>
            <cylinderGeometry args={[0.16, 0.18, 4.6, 8]} />
          </mesh>
        ))}
        <mesh material={neon(HUE_HEX.crimson)} position={[0, 4.7, 0]}>
          <boxGeometry args={[0.35, 0.28, 7]} />
        </mesh>
        <Glow color={HUE_HEX.crimson} size={8} position={[0, 4, 0]} opacity={0.22} />
      </group>
    </group>
  );
}

/* ───────────────────────── Overlook ───────────────────────── */

function Overlook() {
  const o = OVERLOOK_RECT;
  const r = RAMP_RECT;
  const w = o.x1 - o.x0;
  const d = o.z1 - o.z0;
  const cx = (o.x0 + o.x1) / 2;
  const cz = (o.z0 + o.z1) / 2;
  const rampLen = Math.hypot(r.z1 - r.z0, OVERLOOK_Y);
  const rampAngle = Math.atan2(OVERLOOK_Y, r.z1 - r.z0);
  const rail = useMemo(() => neon(HUE_HEX.amber), []);
  const deckTop = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b1d2e", roughness: 0.6, metalness: 0.4 }), []);
  const sign = useMemo(() => signTexture("展望台", HUE_HEX.amber, false), []);
  // Railing on three sides plus the front either side of the ramp.
  const rails: [number, number, number, number][] = [
    [cx, o.z0, w, 0.06],
    [o.x0, cz, 0.06, d],
    [o.x1, cz, 0.06, d],
    [(o.x0 + r.x0) / 2, o.z1, r.x0 - o.x0, 0.06],
    [(o.x1 + r.x1) / 2, o.z1, o.x1 - r.x1, 0.06],
  ];
  return (
    <group>
      <mesh material={darkMetal} position={[cx, (OVERLOOK_Y - 0.2) / 2, cz]}>
        <boxGeometry args={[w, OVERLOOK_Y - 0.2, d]} />
      </mesh>
      <mesh material={deckTop} position={[cx, OVERLOOK_Y - 0.1, cz]}>
        <boxGeometry args={[w, 0.2, d]} />
      </mesh>
      {/* Ramp: its top surface follows the same line as groundHeight(). */}
      <mesh material={deckTop} position={[0, OVERLOOK_Y / 2 - 0.12, (r.z0 + r.z1) / 2]} rotation-x={rampAngle}>
        <boxGeometry args={[r.x1 - r.x0, 0.24, rampLen]} />
      </mesh>
      {[r.x0, r.x1].map((x) => (
        <mesh key={x} material={rail} position={[x, OVERLOOK_Y / 2 + 0.9, (r.z0 + r.z1) / 2]} rotation-x={rampAngle}>
          <boxGeometry args={[0.06, 0.06, rampLen]} />
        </mesh>
      ))}
      {rails.map(([x, z, sx, sz], i) => (
        <mesh key={i} material={rail} position={[x, OVERLOOK_Y + 1, z]}>
          <boxGeometry args={[Math.max(sx, 0.06), 0.06, Math.max(sz, 0.06)]} />
        </mesh>
      ))}
      {/* Telescope */}
      <group position={[0, OVERLOOK_Y, o.z0 + 3]}>
        <mesh material={darkMetal} position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.06, 0.12, 1.2, 8]} />
        </mesh>
        <mesh material={darkMetal} position={[0, 1.3, 0.1]} rotation-x={-1.2}>
          <cylinderGeometry args={[0.12, 0.17, 1, 10]} />
        </mesh>
      </group>
      <mesh position={[0, OVERLOOK_Y + 3.6, o.z0 + 0.4]}>
        <planeGeometry args={[4.6, 1.4]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <Glow color={HUE_HEX.amber} size={9} position={[0, OVERLOOK_Y + 3.4, o.z0 + 1]} opacity={0.25} />
    </group>
  );
}

/* ───────────────────────── Street lamps ───────────────────────── */

/** Street lamps along the avenues: a post, an arm reaching over the road, and a slim lit head. */
function Lamps() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const { postM, armM, headM } = useMemo(() => {
    const postM: THREE.Matrix4[] = [];
    const armM: THREE.Matrix4[] = [];
    const headM: THREE.Matrix4[] = [];
    const side = AVENUE_HALF + 0.5;
    const runs: [number, number, "x" | "z"][] = [
      [20, 54, "x"],
      [-20, -52, "x"],
      [20, 48, "z"],
      [-20, -50, "z"],
    ];
    const ARM = 1.1;
    for (const [from, to, axis] of runs) {
      const dir = Math.sign(to - from);
      for (let v = from; dir > 0 ? v <= to : v >= to; v += dir * 8) {
        // No posts standing in the ring promenade.
        if (Math.abs(v) > RING_R0 - 1.5 && Math.abs(v) < RING_R1 + 1.5) continue;
        for (const s of [-side, side]) {
          const [x, z] = axis === "x" ? [v, s] : [s, v];
          // Unit vector from the post toward the middle of the road.
          const [ix, iz] = axis === "x" ? [0, -Math.sign(s)] : [-Math.sign(s), 0];
          const rot = axis === "x" ? 0 : Math.PI / 2;
          postM.push(compose(x, 2.1, z));
          armM.push(compose(x + ix * ARM * 0.5, 4.15, z + iz * ARM * 0.5, 1, 1, 1, rot));
          headM.push(compose(x + ix * ARM, 4.06, z + iz * ARM, 1, 1, 1, rot));
        }
      }
    }
    return { postM, armM, headM };
  }, []);
  useInstances(posts, postM);
  useInstances(arms, armM);
  useInstances(heads, headM);
  const headMat = useMemo(() => neon("#d6f5ff"), []);
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, darkMetal, postM.length]}>
        <cylinderGeometry args={[0.06, 0.09, 4.2, 6]} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, darkMetal, armM.length]}>
        <boxGeometry args={[0.06, 0.06, 1.1]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, headMat, headM.length]}>
        <boxGeometry args={[0.2, 0.06, 0.5]} />
      </instancedMesh>
    </>
  );
}

/* ───────────────────────── Elevated highway ───────────────────────── */

const CARS: Record<Quality, number> = { low: 24, medium: 48, high: 72 };

function Highway() {
  const quality = useGame((s) => s.quality);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const pillars = useRef<THREE.InstancedMesh>(null);
  const pillarM = useMemo(() => HIGHWAY_PILLARS.map(([x, z]) => compose(x, (HIGHWAY_Y - 0.3) / 2, z, 1, 1, 1)), []);
  useInstances(pillars, pillarM);

  const count = CARS[quality];
  const carGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const ig = new THREE.InstancedBufferGeometry().copy(g as unknown as THREE.InstancedBufferGeometry);
    g.dispose();
    const rand = mulberry32(77);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const lane = HIGHWAY_R + (dir > 0 ? 1.6 : -1.6) + (rand() - 0.5) * 0.6;
      data.set([lane, rand() * Math.PI * 2, dir, 9 + rand() * 7], i * 4);
    }
    ig.setAttribute("aCar", new THREE.InstancedBufferAttribute(data, 4));
    ig.instanceCount = count;
    return ig;
  }, [count]);
  const carMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: carVertex,
        fragmentShader: carFragment,
        uniforms: { ...fogUniforms(), uDeckY: { value: HIGHWAY_Y } },
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => carGeo.dispose(), [carGeo]);
  useEffect(() => () => carMat.dispose(), [carMat]);
  useFrame((_, dt) => {
    if (!reducedMotion) carMat.uniforms.uTime.value += dt;
  });
  const edge = useMemo(() => neon(HUE_HEX.cyan, 0.8), []);
  const edgeWarm = useMemo(() => neon(HUE_HEX.crimson, 0.8), []);
  return (
    <group>
      <mesh material={deckMat} position={[0, HIGHWAY_Y, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[HIGHWAY_R - HIGHWAY_HALF, HIGHWAY_R + HIGHWAY_HALF, 160, 1]} />
      </mesh>
      <mesh material={edge} position={[0, HIGHWAY_Y + 0.25, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[HIGHWAY_R - HIGHWAY_HALF, 0.05, 4, 200]} />
      </mesh>
      <mesh material={edgeWarm} position={[0, HIGHWAY_Y + 0.25, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[HIGHWAY_R + HIGHWAY_HALF, 0.05, 4, 200]} />
      </mesh>
      <instancedMesh ref={pillars} args={[undefined, darkMetal, pillarM.length]}>
        <boxGeometry args={[1.1, HIGHWAY_Y - 0.3, 1.1]} />
      </instancedMesh>
      <mesh geometry={carGeo} material={carMat} frustumCulled={false} />
    </group>
  );
}

/* ───────────────────────── District glow markers ───────────────────────── */

function DistrictLights() {
  return (
    <>
      {DISTRICTS.map((d) => (
        <Glow key={d.id} color={HUE_HEX[d.hue]} size={14} position={[d.at[0], (d.id === "overlook" ? OVERLOOK_Y : 0) + 0.3, d.at[1]]} opacity={0.12} />
      ))}
    </>
  );
}

export function Districts() {
  return (
    <>
      <ArcadeStrip />
      <Garden />
      <Overlook />
      <Lamps />
      <Highway />
      <DistrictLights />
    </>
  );
}
