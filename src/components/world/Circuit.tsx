"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BARRIERS, BARRIER_HEIGHT, BARRIER_THICK, START, TANGENTS, TRACK, TRACK_HALF_WIDTH, formatLap } from "@/lib/circuit";
import { HUE_HEX } from "@/lib/sections";
import { CIRCUIT_RECT, CIRCUIT_SOLIDS } from "@/lib/world-map";
import { hero } from "@/store/game";
import { fogUniforms } from "./City";
import { glowTexture, signTexture } from "./textures";

const trackVertex = /* glsl */ `
  attribute vec2 aTrack; // x: distance along the lap (m), y: across (-1 left kerb … 1 right kerb)
  varying vec2 vTrack;
  varying vec3 vWorld;
  void main() {
    vTrack = aTrack;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const trackFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec2 vTrack;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float across = abs(vTrack.y);
    // Asphalt with a little grain.
    vec3 col = vec3(0.055, 0.058, 0.075) + hash(floor(vWorld.xz * 6.0)) * 0.012;
    // Red and white kerbs on both edges.
    float kerb = step(0.86, across);
    float band = step(0.5, fract(vTrack.x / 2.0));
    col = mix(col, mix(vec3(0.85, 0.12, 0.2), vec3(0.88, 0.86, 0.8), band), kerb);
    // A thin white line just inside each kerb.
    col += step(0.80, across) * step(across, 0.83) * vec3(0.6);
    // Chequered start line across the track.
    float onLine = step(vTrack.x, 1.2) + step(${"$"}{LEN} - 0.4, vTrack.x);
    vec2 cell = floor(vec2(vTrack.x * 2.5, vTrack.y * 5.0));
    float chk = mod(cell.x + cell.y, 2.0);
    col = mix(col, vec3(chk) * 0.9, onLine * (1.0 - kerb));
    float fogD = length(vWorld - cameraPosition);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * fogD * fogD);
    col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** The track ribbon: a flat strip following the centre line, with lap distance baked in for kerbs and the start line. */
function Track() {
  const { geometry, length } = useMemo(() => {
    const n = TRACK.length;
    const pos = new Float32Array((n + 1) * 2 * 3);
    const uv = new Float32Array((n + 1) * 2 * 2);
    const idx: number[] = [];
    let dist = 0;
    for (let i = 0; i <= n; i++) {
      const p = TRACK[i % n];
      const t = TANGENTS[i % n];
      if (i > 0) {
        const q = TRACK[i - 1];
        dist += Math.hypot(p[0] - q[0], p[1] - q[1]);
      }
      // Normal to the left of travel.
      const nx = -t[1];
      const nz = t[0];
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1;
        const o = (i * 2 + s) * 3;
        pos[o] = p[0] + nx * TRACK_HALF_WIDTH * side;
        pos[o + 1] = 0.03;
        pos[o + 2] = p[1] + nz * TRACK_HALF_WIDTH * side;
        uv[(i * 2 + s) * 2] = dist;
        uv[(i * 2 + s) * 2 + 1] = side;
      }
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aTrack", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return { geometry: g, length: dist };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trackVertex,
        fragmentShader: trackFragment.replace("${LEN}", length.toFixed(2)),
        uniforms: fogUniforms(),
        side: THREE.DoubleSide,
      }),
    [length],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geometry} material={mat} />;
}

/** Live timing board on the start gantry, drawn to a canvas a few times a second. */
function TimingBoard() {
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, tex: t };
  }, []);
  const last = useRef(0);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    const now = performance.now();
    if (now - last.current < 120) return;
    last.current = now;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#05060f";
    g.fillRect(0, 0, 512, 128);
    g.font = "700 30px monospace";
    g.textBaseline = "middle";
    const lap = hero.lap;
    const cur = lap.running ? formatLap(now - lap.startedAt) : "-:--.--";
    g.fillStyle = lap.running ? (lap.valid ? "#3ee8e0" : "#ff3b4f") : "#7d7a90";
    g.fillText(`LAP  ${cur}`, 20, 40);
    g.fillStyle = "#ffb547";
    g.fillText(`BEST ${lap.bestMs ? formatLap(lap.bestMs) : "-:--.--"}`, 20, 92);
    tex.needsUpdate = true;
  });
  return (
    <mesh position={[START[0] - 0.2, 7.3, 64]} rotation-y={-Math.PI / 2}>
      <planeGeometry args={[5, 1.25]} />
      <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

const darkMetal = new THREE.MeshStandardMaterial({ color: "#1a1c2b", roughness: 0.55, metalness: 0.6 });

/** Start gantry over the line, a grandstand on the infield side and the circuit sign. */
function Furniture() {
  const sign = useMemo(() => signTexture("サーキット V9", HUE_HEX.crimson, false), []);
  const glow = useMemo(() => glowTexture(), []);
  const neon = useMemo(() => new THREE.MeshBasicMaterial({ color: HUE_HEX.crimson, toneMapped: false }), []);
  const half = CIRCUIT_SOLIDS[2].z - START[1];
  const stand = CIRCUIT_SOLIDS[0];
  return (
    <group>
      {/* Start gantry: posts either side of the line (the line runs across x = 0). */}
      {[-half, half].map((dz) => (
        <mesh key={dz} material={darkMetal} position={[START[0], 3.2, 64 + dz]}>
          <boxGeometry args={[0.35, 6.4, 0.35]} />
        </mesh>
      ))}
      <mesh material={neon} position={[START[0], 6.5, 64]}>
        <boxGeometry args={[0.3, 0.25, half * 2 + 0.6]} />
      </mesh>
      <TimingBoard />
      {/* Grandstand on the infield. */}
      {/* Stepped seating, filling the same box the collision uses. */}
      <group position={[stand.x, 0, stand.z - stand.d / 2]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={darkMetal} position={[0, (0.55 * (i + 1)) / 2, i * 0.9 + 0.45]}>
            <boxGeometry args={[stand.w, 0.55 * (i + 1), 0.9]} />
          </mesh>
        ))}
        <mesh position={[0, 4.6, 3.2]} rotation-y={Math.PI}>
          <planeGeometry args={[11, 2.2]} />
          <meshBasicMaterial map={sign} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <sprite position={[0, 4.6, 2.9]} scale={[16, 6, 1]}>
          <spriteMaterial map={glow} color={HUE_HEX.crimson} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      {/* Low neon strips marking the circuit boundary. */}
      <mesh position={[(CIRCUIT_RECT.x0 + CIRCUIT_RECT.x1) / 2, 0.05, CIRCUIT_RECT.z1]} material={neon}>
        <boxGeometry args={[CIRCUIT_RECT.x1 - CIRCUIT_RECT.x0, 0.1, 0.1]} />
      </mesh>
    </group>
  );
}

/**
 * Barriers along both edges: low red and white blocks with a thin neon rail,
 * drawn as two instanced meshes from the same data as the collision.
 */
function Barriers() {
  const blocks = useRef<THREE.InstancedMesh>(null);
  const rails = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, emissive: "#140408" }), []);
  const rail = useMemo(() => new THREE.MeshBasicMaterial({ color: HUE_HEX.cyan, toneMapped: false, transparent: true, opacity: 0.8 }), []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const red = new THREE.Color("#c4162c");
    const white = new THREE.Color("#d9d6cf");
    BARRIERS.forEach((w, i) => {
      q.setFromAxisAngle(up, w.rot);
      m.compose(new THREE.Vector3(w.x, BARRIER_HEIGHT / 2, w.z), q, new THREE.Vector3(w.len, BARRIER_HEIGHT, BARRIER_THICK));
      blocks.current?.setMatrixAt(i, m);
      blocks.current?.setColorAt(i, i % 2 ? red : white);
      m.compose(new THREE.Vector3(w.x, BARRIER_HEIGHT + 0.03, w.z), q, new THREE.Vector3(w.len, 0.06, 0.12));
      rails.current?.setMatrixAt(i, m);
    });
    for (const r of [blocks.current, rails.current]) {
      if (!r) continue;
      r.instanceMatrix.needsUpdate = true;
      if (r.instanceColor) r.instanceColor.needsUpdate = true;
      r.computeBoundingSphere();
    }
  }, []);
  return (
    <group>
      <instancedMesh ref={blocks} args={[undefined, mat, BARRIERS.length]}>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={rails} args={[undefined, rail, BARRIERS.length]}>
        <boxGeometry />
      </instancedMesh>
    </group>
  );
}

export function Circuit() {
  return (
    <>
      <Track />
      <Barriers />
      <Furniture />
    </>
  );
}
