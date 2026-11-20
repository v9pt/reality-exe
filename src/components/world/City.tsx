"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BACKROOM_AT, DISTRICTS, HUE_HEX, SECTIONS } from "@/lib/sections";
import { CITY_RANGE, MAP_HALF, generateBuildings, mulberry32, type Building } from "@/lib/world-map";
import { useGame, avatar, view, type Quality } from "@/store/game";
import {
  FOG_COLOR,
  buildingFragment,
  buildingVertex,
  fogDensity,
  groundFragment,
  groundVertex,
  rainFragment,
  rainVertex,
  skyFragment,
  skyVertex,
} from "./shaders";
import { glowTexture, mapTexture, signTexture } from "./textures";

const fogColor = { value: new THREE.Color(FOG_COLOR) };

/** Fog uniforms: colour and density are shared objects, so one update reaches every material. */
export const fogUniforms = () => ({
  uFogColor: fogColor,
  uFogDensity: fogDensity,
  uTime: { value: 0 },
});

/* ─────────────────────────── Sky ─────────────────────────── */

export function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: { uTime: { value: 0 } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

/* ─────────────────────────── Ground ─────────────────────────── */

export function Ground() {
  const reducedMotion = useGame((s) => s.reducedMotion);
  const mat = useMemo(() => {
    // x = world x, y = spread (1 = landmark-sized pool), z = world z.
    const pools = SECTIONS.map((s) => new THREE.Vector3(s.at[0], 1, s.at[1]));
    const cols = SECTIONS.map((s) => new THREE.Color(HUE_HEX[s.hue]).multiplyScalar(0.55));
    pools.push(new THREE.Vector3(0, 1, 0), new THREE.Vector3(BACKROOM_AT[0], 1, BACKROOM_AT[1]));
    cols.push(new THREE.Color("#3a1840"), new THREE.Color("#ff3b4f").multiplyScalar(0.5));
    for (const d of DISTRICTS) {
      pools.push(new THREE.Vector3(d.at[0], 3, d.at[1]));
      cols.push(new THREE.Color(HUE_HEX[d.hue]).multiplyScalar(0.16));
    }
    while (pools.length < 12) {
      pools.push(new THREE.Vector3(0, 1, 9999));
      cols.push(new THREE.Color(0));
    }
    return new THREE.ShaderMaterial({
      vertexShader: groundVertex,
      fragmentShader: groundFragment,
      uniforms: {
        ...fogUniforms(),
        uPools: { value: pools },
        uPoolCol: { value: cols },
        uMap: { value: mapTexture() },
        uMapHalf: { value: MAP_HALF },
      },
    });
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    if (!reducedMotion) mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat}>
      <planeGeometry args={[640, 640, 1, 1]} />
    </mesh>
  );
}

/* ─────────────────────────── Buildings ─────────────────────────── */

const CHUNKS = 4;

/**
 * Every block in one shared material, split into a 4 × 4 grid of instanced
 * meshes. Each chunk has a real bounding sphere, so blocks behind the
 * camera are culled even when it looks over the whole district.
 */
export function Buildings() {
  const quality = useGame((s) => s.quality);
  const devMode = useGame((s) => s.devMode);
  const range = CITY_RANGE[quality];

  const chunks = useMemo(() => {
    const all = generateBuildings(range);
    const extent = range + 80;
    const size = (extent * 2) / CHUNKS;
    const buckets: Building[][] = Array.from({ length: CHUNKS * CHUNKS }, () => []);
    for (const b of all) {
      const ix = THREE.MathUtils.clamp(Math.floor((b.x + extent) / size), 0, CHUNKS - 1);
      const iz = THREE.MathUtils.clamp(Math.floor((b.z + extent) / size), 0, CHUNKS - 1);
      buckets[iz * CHUNKS + ix].push(b);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    return buckets
      .filter((list) => list.length > 0)
      .map((list) => {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.translate(0, 0.5, 0);
        geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.seed)), 1));
        const matrices = list.map((b) => {
          q.setFromAxisAngle(up, b.rot);
          return m.compose(new THREE.Vector3(b.x, 0, b.z), q, new THREE.Vector3(b.w, b.h, b.d)).clone();
        });
        return { geo, matrices };
      });
  }, [range]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: buildingVertex,
        fragmentShader: buildingFragment,
        uniforms: fogUniforms(),
      }),
    [],
  );
  mat.wireframe = devMode;
  useEffect(() => () => chunks.forEach((c) => c.geo.dispose()), [chunks]);
  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <>
      {chunks.map((c, i) => (
        <Chunk key={`${range}:${i}`} geo={c.geo} matrices={c.matrices} mat={mat} />
      ))}
    </>
  );
}

function Chunk({ geo, matrices, mat }: { geo: THREE.BufferGeometry; matrices: THREE.Matrix4[]; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} />;
}

/* ─────────────────────────── Signs ─────────────────────────── */

type SignDef = { text: string; hue: string; vertical: boolean; pos: [number, number, number]; size: [number, number]; broken?: boolean };

/** Original signage. Words chosen for the district: cyber-town, ward 9, night market, memory, line, coffee. */
const SIGNS: SignDef[] = [
  { text: "電脳街", hue: HUE_HEX.cyan, vertical: true, pos: [-13.5, 7, -15.5], size: [1.3, 4.2] },
  { text: "第九区", hue: HUE_HEX.crimson, vertical: true, pos: [14.5, 8, -14.5], size: [1.3, 4.2] },
  { text: "夜市", hue: HUE_HEX.amber, vertical: true, pos: [17.5, 5, 9.5], size: [1.2, 3.0], broken: true },
  { text: "記憶", hue: HUE_HEX.violet, vertical: true, pos: [-17.5, 6, 10.5], size: [1.2, 3.0] },
  { text: "REALITY.EXE", hue: HUE_HEX.crimson, vertical: false, pos: [0, 13, -21.5], size: [8, 1.4] },
  { text: "珈琲 24H", hue: HUE_HEX.amber, vertical: false, pos: [-15, 4.2, 15], size: [4, 1] },
  { text: "回線", hue: HUE_HEX.cyan, vertical: true, pos: [19.5, 12, -3], size: [1.2, 3.0] },
  { text: "V9", hue: HUE_HEX.violet, vertical: false, pos: [-20, 15, -2], size: [2.4, 1.3] },
];

function Sign({ def }: { def: SignDef }) {
  const reducedMotion = useGame((s) => s.reducedMotion);
  const fixed = useGame((s) => s.secrets.includes("sign"));
  const unlock = useGame((s) => s.unlock);
  const map = useMemo(() => signTexture(def.text, def.hue, def.vertical), [def]);
  const face = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const lookAt = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...def.pos);
    o.lookAt(0, def.pos[1] * 0.4, 0);
    return o.rotation.clone();
  }, [def]);
  const glow = useMemo(() => glowTexture(), []);
  const color = useMemo(() => new THREE.Color(def.hue), [def.hue]);

  useFrame(({ clock }) => {
    if (!face.current || !halo.current) return;
    let k = 1;
    if (def.broken && !fixed) {
      const t = clock.elapsedTime;
      k = reducedMotion ? 0.5 : Math.sin(t * 23) > 0.2 || Math.sin(t * 3.1) > 0.7 ? 0.25 : 1;
    }
    face.current.opacity = k;
    halo.current.opacity = 0.38 * k;
  });

  return (
    <group position={def.pos} rotation={lookAt}>
      <mesh
        onClick={
          def.broken
            ? (e) => {
                e.stopPropagation();
                if (e.delta < 6) unlock("sign");
              }
            : undefined
        }
        onPointerOver={def.broken ? () => (document.body.dataset.hover = "1") : undefined}
        onPointerOut={def.broken ? () => delete document.body.dataset.hover : undefined}
      >
        <planeGeometry args={def.size} />
        <meshBasicMaterial ref={face} map={map} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[def.size[0] * 2.6, def.size[1] * 1.8]} />
        <meshBasicMaterial
          ref={halo}
          map={glow}
          color={color}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function Signs() {
  return (
    <>
      {SIGNS.map((s) => (
        <Sign key={s.text} def={s} />
      ))}
    </>
  );
}

/* ─────────────────────────── Rain ─────────────────────────── */

const RAIN: Record<Quality, number> = { low: 900, medium: 2200, high: 4000 };

export function Rain() {
  const quality = useGame((s) => s.quality);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const count = RAIN[quality];
  const lines = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => {
    const rand = mulberry32(7);
    const seed = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const a = rand();
      const b = rand();
      const c = rand();
      seed.set([a, b, c, a, b, c], i * 6);
      end[i * 2] = 0;
      end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rainVertex,
        fragmentShader: rainFragment,
        uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: 44 } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    // Reduced motion: rain hangs still rather than disappearing.
    if (!reducedMotion) mat.uniforms.uTime.value += dt;
    mat.uniforms.uCenter.value.set(avatar.x, avatar.ground, avatar.z);
    // Rain only falls round the avatar; from far away it would read as a column.
    if (lines.current) lines.current.visible = view.mode === "follow" || view.dist[view.mode] < 28;
  });
  return <lineSegments ref={lines} geometry={geometry} material={mat} frustumCulled={false} />;
}
