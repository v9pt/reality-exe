"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CABINETS } from "@/lib/arcade";
import { SECTIONS } from "@/lib/sections";
import { CABINET_X, CABINET_Z, JUKEBOX_AT, OVERLOOK_Y, groundHeight, inBackroom, resolve } from "@/lib/world-map";
import { avatar, input, useGame, view, type NearId } from "@/store/game";
import { glowTexture } from "./textures";

/**
 * An original avatar: long coat with a crimson lining, a scarf, and a thin
 * cyan visor. Built from primitives, animated procedurally.
 */
function Figure({
  legL,
  legR,
  body,
  scarf,
  shadow,
  head,
}: {
  legL: React.Ref<THREE.Group>;
  legR: React.Ref<THREE.Group>;
  body: React.Ref<THREE.Group>;
  scarf: React.Ref<THREE.Mesh>;
  shadow: React.Ref<THREE.Mesh>;
  head: React.Ref<THREE.Group>;
}) {
  const m = useMemo(
    () => ({
      coat: new THREE.MeshStandardMaterial({ color: "#3a3f5c", roughness: 0.5, metalness: 0.25 }),
      lining: new THREE.MeshBasicMaterial({ color: "#7d1020", side: THREE.BackSide }),
      skin: new THREE.MeshStandardMaterial({ color: "#c9a48a", roughness: 0.8 }),
      hair: new THREE.MeshStandardMaterial({ color: "#0d0d14", roughness: 0.7 }),
      pants: new THREE.MeshStandardMaterial({ color: "#121320", roughness: 0.8 }),
      visor: new THREE.MeshBasicMaterial({ color: "#3ee8e0", toneMapped: false }),
      scarf: new THREE.MeshStandardMaterial({ color: "#c41a2e", roughness: 0.7, side: THREE.DoubleSide, emissive: "#3a0008" }),
    }),
    [],
  );
  const glow = useMemo(() => glowTexture(), []);
  return (
    <group>
      {/* Contact shadow */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <group ref={legL} position={[-0.13, 0.85, 0]}>
        <mesh material={m.pants} position={[0, -0.42, 0]}>
          <capsuleGeometry args={[0.085, 0.7, 4, 8]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.13, 0.85, 0]}>
        <mesh material={m.pants} position={[0, -0.42, 0]}>
          <capsuleGeometry args={[0.085, 0.7, 4, 8]} />
        </mesh>
      </group>
      <group ref={body}>
        {/* Coat: an open, flared cylinder so the lining shows */}
        <mesh material={m.coat} position={[0, 1.08, 0]}>
          <cylinderGeometry args={[0.24, 0.42, 1.05, 12, 1, true, 0.35, Math.PI * 2 - 0.7]} />
        </mesh>
        <mesh material={m.lining} position={[0, 1.08, 0]}>
          <cylinderGeometry args={[0.235, 0.415, 1.04, 12, 1, true, 0.35, Math.PI * 2 - 0.7]} />
        </mesh>
        <mesh material={m.coat} position={[0, 1.42, 0]}>
          <capsuleGeometry args={[0.22, 0.42, 4, 10]} />
        </mesh>
        {/* Scarf wrap and tail */}
        <mesh material={m.scarf} position={[0, 1.72, 0]}>
          <torusGeometry args={[0.15, 0.06, 6, 14]} />
        </mesh>
        <mesh ref={scarf} material={m.scarf} position={[0.08, 1.45, -0.2]} rotation-x={0.3}>
          <planeGeometry args={[0.16, 0.7]} />
        </mesh>
        {/* Head pivots at the neck so it can turn toward where the camera looks. */}
        <group ref={head} position={[0, 1.8, 0]}>
          <mesh material={m.skin} position={[0, 0.13, 0]} scale={[0.17, 0.2, 0.18]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh material={m.hair} position={[0, 0.2, -0.03]} scale={[0.185, 0.17, 0.2]}>
            <sphereGeometry args={[1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          </mesh>
          <mesh material={m.visor} position={[0, 0.15, 0.13]}>
            <boxGeometry args={[0.26, 0.035, 0.08]} />
          </mesh>
          <sprite position={[0, 0.15, 0.2]} scale={[0.7, 0.35, 1]}>
            <spriteMaterial map={glow} color="#3ee8e0" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      </group>
    </group>
  );
}

const GRAVITY = 19;
const CABINET_REACH = 2.4;

/** The avatar: movement, jumping, pose and what it is standing next to. The camera lives in CameraRig. */
export function Player() {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const scarf = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Sprite>(null);
  const shadowMat = useRef<THREE.MeshBasicMaterial | null>(null);
  /** Vertical motion: jump height above the ground, velocity, and a landing squash that decays. */
  const air = useRef({ vy: 0, squash: 0, grounded: true });
  const walkPhase = useRef(0);
  const speedRef = useRef(0);
  const glow = useMemo(() => glowTexture(), []);

  useEffect(() => {
    // Start on the plaza, unless a deep link already sent the avatar somewhere.
    if (!view.snap) {
      avatar.x = 0;
      avatar.z = 3;
      avatar.heading = Math.PI;
    }
    avatar.y = 0;
    avatar.ground = groundHeight(avatar.x, avatar.z);
    input.jump = false;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = useGame.getState();
    const panelOpen = g.panel !== null;
    const rm = g.reducedMotion;

    /* ── Movement, relative to where the camera looks ── */
    let mx = 0;
    let mz = 0;
    if (!panelOpen) {
      const fx = -Math.sin(view.yaw);
      const fz = -Math.cos(view.yaw);
      const rx = Math.cos(view.yaw);
      const rz = -Math.sin(view.yaw);
      mx = fx * input.z + rx * input.x;
      mz = fz * input.z + rz * input.x;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
    }
    const moving = Math.hypot(mx, mz) > 0.05;
    const running = input.run || input.runLock;
    const targetSpeed = moving ? (running ? 10 : 5.2) : 0;
    speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 10, dt);
    if (moving) {
      const nx = avatar.x + mx * speedRef.current * dt;
      const nz = avatar.z + mz * speedRef.current * dt;
      [avatar.x, avatar.z] = resolve(nx, nz, avatar.x, avatar.z);
      const want = Math.atan2(mx, mz);
      let diff = want - avatar.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      avatar.heading += diff * Math.min(1, dt * 12);
      view.idle = 0;
    } else {
      view.idle += dt;
    }
    avatar.ground = groundHeight(avatar.x, avatar.z);
    avatar.speed = speedRef.current;

    /* ── Jump ── */
    const a = air.current;
    if (input.jump) {
      input.jump = false;
      if (a.grounded && !panelOpen) {
        // A running jump goes a little higher.
        a.vy = running && moving ? 7.2 : 6.4;
        a.grounded = false;
        view.idle = 0;
      }
    }
    if (!a.grounded) {
      a.vy -= GRAVITY * dt;
      avatar.y += a.vy * dt;
      if (avatar.y <= 0) {
        avatar.y = 0;
        a.squash = Math.min(1, -a.vy / 8);
        a.vy = 0;
        a.grounded = true;
      }
    }
    a.squash = Math.max(0, a.squash - dt * 6);
    const airborne = !a.grounded;
    // Tuck: knees come up near the top of the arc.
    const tuck = airborne ? THREE.MathUtils.clamp(1 - Math.abs(a.vy) / 6.4, 0, 1) : 0;

    /* ── Pose ── */
    if (root.current) {
      root.current.position.set(avatar.x, avatar.ground + avatar.y, avatar.z);
      root.current.rotation.y = avatar.heading;
      const sq = rm ? 0 : a.squash * 0.18;
      const stretch = rm || !airborne ? 0 : Math.min(0.08, Math.abs(a.vy) * 0.012);
      root.current.scale.set(1 + sq * 0.5 - stretch * 0.4, 1 - sq + stretch, 1 + sq * 0.5 - stretch * 0.4);
    }
    if (shadow.current) {
      // The shadow stays on the ground and shrinks and fades with height.
      shadow.current.position.y = 0.02 - avatar.y;
      const sc = 1 / (1 + avatar.y * 0.45);
      shadow.current.scale.setScalar(sc);
      shadowMat.current ??= shadow.current.material as THREE.MeshBasicMaterial;
      shadowMat.current.opacity = 0.5 * sc;
    }
    if (marker.current) {
      // From far away the avatar is a speck: show a "you are here" glow that scales with distance.
      const far = view.mode === "follow" ? 0 : THREE.MathUtils.clamp((view.dist[view.mode] - 14) / 30, 0, 1);
      marker.current.visible = far > 0;
      const sc = 2 + view.dist[view.mode] * 0.08;
      marker.current.scale.set(sc, sc, 1);
      (marker.current.material as THREE.SpriteMaterial).opacity = far * 0.85;
    }
    const s = speedRef.current;
    if (!rm && !airborne) walkPhase.current += dt * (4 + s * 1.3);
    const swing = airborne ? 0 : Math.sin(walkPhase.current) * Math.min(1, s / 5) * 0.7;
    if (legL.current) legL.current.rotation.x = swing - tuck * 0.9;
    if (legR.current) legR.current.rotation.x = -swing - tuck * 0.5;
    if (body.current) body.current.position.y = rm || airborne ? 0 : Math.abs(Math.cos(walkPhase.current)) * 0.05 * Math.min(1, s / 5) + Math.sin(walkPhase.current * 0.3) * 0.01;
    if (head.current) {
      // Eyes follow the camera: the head turns toward where the visitor is looking, within a neck's reach.
      const lookYaw = view.yaw + Math.PI;
      const turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(lookYaw - avatar.heading), Math.cos(lookYaw - avatar.heading)), -1.1, 1.1);
      const tilt = THREE.MathUtils.clamp((view.pitch[view.mode] - 0.35) * 0.5, -0.25, 0.35);
      const k = 1 - Math.exp(-dt * (rm ? 30 : 8));
      head.current.rotation.y += (turn - head.current.rotation.y) * k;
      head.current.rotation.x += (tilt - head.current.rotation.x) * k;
    }
    if (scarf.current) scarf.current.rotation.x = 0.3 + Math.min(1, s / 6) * 0.7 + (airborne ? THREE.MathUtils.clamp(-a.vy * 0.08, -0.3, 0.6) : 0) + (rm ? 0 : Math.sin(walkPhase.current * 0.7) * 0.08);

    /* ── Proximity ── */
    let near: NearId | null = null;
    let best = 4.3;
    for (const sec of SECTIONS) {
      const d = Math.hypot(avatar.x - sec.at[0], avatar.z - sec.at[1]);
      if (d < best) {
        best = d;
        near = sec.id;
      }
    }
    CABINET_Z.forEach((cz, i) => {
      // Stand in front of the screen (cabinets face -x).
      const d = Math.hypot(avatar.x - (CABINET_X - 1.2), avatar.z - cz);
      if (d < CABINET_REACH && d < best) {
        best = d;
        near = `cab:${CABINETS[i]}`;
      }
    });
    const jd = Math.hypot(avatar.x - JUKEBOX_AT[0], avatar.z - JUKEBOX_AT[1]);
    if (jd < 2.4 && jd < best) {
      best = jd;
      near = "jukebox";
    }
    if (inBackroom(avatar.x, avatar.z)) {
      near = "backroom";
      if (!g.backroomOpen) g.openBackroom();
    }
    if (avatar.ground >= OVERLOOK_Y - 0.1 && !g.secrets.includes("overlook")) g.unlock("overlook");
    g.setNear(near);
  });

  return (
    <group ref={root}>
      {/* Follow lights give the avatar a rim against the dark streets. */}
      <pointLight position={[-0.8, 2.6, -1.4]} intensity={6} distance={5} color="#3ee8e0" decay={1.5} />
      <pointLight position={[0.9, 1.8, 1.6]} intensity={2.5} distance={4} color="#ff6a8a" decay={1.5} />
      <Figure legL={legL} legR={legR} body={body} scarf={scarf} shadow={shadow} head={head} />
      <sprite ref={marker} position={[0, 1.2, 0]} visible={false}>
        <spriteMaterial map={glow} color="#3ee8e0" transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}
