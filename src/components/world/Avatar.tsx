"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CABINETS } from "@/lib/arcade";
import { LapTimer, formatLap, type LapEvent } from "@/lib/circuit";
import { postScore } from "@/lib/leaderboard";
import { AVATAR_RADIUS, KART_RADIUS, blinkTarget, clampToWorld, findAnchor, forwardSpeed, launchVelocity, stepAir, stepGround, stepKart, stepSwing, type Body, type Kart } from "@/lib/motion";
import { ENERGY_MAX, ENERGY_REGEN, POWERS, powerById, spend, type PowerId } from "@/lib/powers";
import { SECTIONS } from "@/lib/sections";
import { CABINET_X, CABINET_Z, JUKEBOX_AT, OVERLOOK_RECT, OVERLOOK_Y, groundHeight, inBackroom } from "@/lib/world-map";
import { avatar, hero, input, useGame, view, type HeroMode, type NearId } from "@/store/game";
import { terrainFor } from "./terrain";
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

const CABINET_REACH = 2.4;
const LAP_KEY = "reality.exe/kart-best";
const GHOSTS = 8;

type V3 = [number, number, number];
type HeroState = {
  mode: HeroMode;
  rope: { anchor: V3; len: number; drone: boolean; t: number } | null;
  reach: { target: V3; t: number; launched: boolean } | null;
  slam: boolean;
  slamQueued: boolean;
  airLeap: boolean;
  squash: number;
  walkPhase: number;
  speed: number;
  trailT: number;
  trail: { x: number; y: number; z: number; h: number; t: number }[];
  blink: { from: V3; to: V3; t: number } | null;
  shock: { x: number; y: number; z: number; t: number } | null;
  wheel: number;
  lastSpeed: number;
  used: Set<PowerId>;
};

function readBestLap(): number | null {
  try {
    const v = Number(localStorage.getItem(LAP_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * The visitor's character: walking, jumping, six powers, the kart and lap
 * timing, plus what it is standing next to. Physics lives in lib/motion
 * (pure and tested); the camera lives in CameraRig.
 */
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
  // Plain holders for effect objects, filled by the effect components' ref callbacks.
  const [fx] = useState<FxRefs>(() => ({ rope: null, drone: null, arm: null, hand: null, ghosts: [], blinkA: null, blinkB: null, ring: null }));
  const [kartRefs] = useState<KartRefs>(() => ({ root: null, wheels: [], front: [], glow: null }));
  const glow = useMemo(() => glowTexture(), []);
  const quality = useGame((s) => s.quality);
  const terrain = useMemo(() => terrainFor(quality), [quality]);
  const lap = useMemo(() => new LapTimer(), []);

  const B = useRef<Body>({ x: 0, y: 0, z: 3, vx: 0, vy: 0, vz: 0, grounded: true });
  const K = useRef<Kart & { parked: boolean }>({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, heading: 0, steer: 0, drifting: false, parked: false });
  const S = useRef<HeroState>({
    mode: "walk",
    rope: null,
    reach: null,
    slam: false,
    slamQueued: false,
    airLeap: false,
    squash: 0,
    walkPhase: 0,
    speed: 0,
    trailT: 0,
    trail: [],
    blink: null,
    shock: null,
    wheel: 0,
    lastSpeed: 0,
    used: new Set(),
  });

  useEffect(() => {
    // Start on the plaza, unless a deep link already sent the avatar somewhere.
    if (!view.snap) {
      avatar.x = 0;
      avatar.z = 3;
      avatar.heading = Math.PI;
    }
    const b = B.current;
    b.x = avatar.x;
    b.z = avatar.z;
    b.y = groundHeight(avatar.x, avatar.z);
    avatar.y = 0;
    avatar.ground = b.y;
    input.jump = false;
    hero.lap.bestMs = readBestLap();
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = useGame.getState();
    const panelOpen = g.panel !== null;
    const rm = g.reducedMotion;
    const s = S.current;
    const b = B.current;
    const k = K.current;

    // Moved from outside (fast travel, dev tools): start again from there, on foot.
    if (Math.hypot(avatar.x - b.x, avatar.z - b.z) > 0.5) {
      b.x = avatar.x;
      b.z = avatar.z;
      b.y = terrain.support(b.x, b.z, 200);
      b.vx = b.vy = b.vz = 0;
      b.grounded = true;
      if (s.mode === "kart") {
        k.parked = true;
        lap.reset();
        hero.lap.running = false;
        useGame.setState({ driving: false });
      }
      s.mode = "walk";
      s.rope = null;
      s.reach = null;
    }

    /* ── Input, relative to where the camera looks ── */
    const camFx = -Math.sin(view.yaw);
    const camFz = -Math.cos(view.yaw);
    let mx = 0;
    let mz = 0;
    if (!panelOpen) {
      const rx = Math.cos(view.yaw);
      const rz = -Math.sin(view.yaw);
      mx = camFx * input.z + rx * input.x;
      mz = camFz * input.z + rz * input.x;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
    }
    const moving = Math.hypot(mx, mz) > 0.05;
    const running = input.run || input.runLock;
    const taps = input.powerTaps;
    input.powerTaps = 0;
    const pressed = taps > 0 && !panelOpen;
    const held = input.powerHeld && !panelOpen;
    const deny = () => (hero.deniedAt = performance.now());
    const spendOk = (cost: number) => {
      const left = spend(hero.energy, cost);
      if (left === null) {
        deny();
        return false;
      }
      hero.energy = left;
      return true;
    };
    const markUsed = (p: PowerId) => {
      s.used.add(p);
      if (s.used.size === POWERS.length) g.unlock("hero");
    };

    /* ── Kart: in and out ── */
    const leaveKart = () => {
      // Step out beside the kart, wherever there's room.
      k.parked = true;
      const rx = Math.cos(k.heading);
      const rz = -Math.sin(k.heading);
      const spots: [number, number][] = [
        [-rx * 1.7, -rz * 1.7],
        [rx * 1.7, rz * 1.7],
        [-Math.sin(k.heading) * 2.4, -Math.cos(k.heading) * 2.4],
      ];
      const spot = spots.find(([dx, dz]) => !terrain.blocked(k.x + dx, k.z + dz, k.y, AVATAR_RADIUS)) ?? [0, 0];
      b.x = k.x + spot[0];
      b.z = k.z + spot[1];
      b.y = k.y;
      b.vx = b.vy = b.vz = 0;
      b.grounded = k.grounded;
      s.mode = k.grounded ? "walk" : "air";
      s.slam = false;
      s.slamQueued = false;
      lap.reset();
      hero.lap.running = false;
      useGame.setState({ driving: false });
    };
    if (input.kartToggle) {
      input.kartToggle = false;
      if (!panelOpen) {
        if (s.mode === "kart") leaveKart();
        else {
          const near = k.parked && Math.hypot(k.x - b.x, k.z - b.z) < 4 && Math.abs(k.y - b.y) < 2;
          if (!near) {
            // Call the kart to wherever you are.
            k.x = b.x;
            k.z = b.z;
            k.y = b.y;
            k.heading = avatar.heading;
            k.vx = k.vz = k.vy = 0;
            k.steer = 0;
            k.grounded = b.grounded;
          }
          k.parked = false;
          s.mode = "kart";
          s.rope = null;
          s.reach = null;
          s.slam = false;
          s.slamQueued = false;
          useGame.setState({ driving: true });
          g.unlock("kart");
        }
      }
    }

    /* ── Powers: every one works everywhere, on foot, in the air and in the kart ── */
    const power = g.power;
    if (pressed) {
      const def = powerById(power)!;
      // The grapple and the stretch need your hands: hop out of the kart and fire.
      if (s.mode === "kart" && (power === "grapple" || power === "reach") && hero.energy >= def.cost) {
        leaveKart();
        if (!b.grounded) s.mode = "air";
      }
      if (s.mode === "kart") {
        switch (power) {
          case "overdrive":
            if (hero.overdrive) hero.overdrive = false;
            else if (hero.energy > 15) hero.overdrive = true;
            else deny();
            if (hero.overdrive) markUsed("overdrive");
            break;
          case "leap":
            // Kart jump; a second press in the air gives one more lift.
            if ((k.grounded || !s.airLeap) && spendOk(def.cost)) {
              if (!k.grounded) s.airLeap = true;
              k.vy = Math.max(k.vy, 11);
              k.grounded = false;
              markUsed("leap");
            }
            break;
          case "slam":
            if (!s.slam && spendOk(def.cost)) {
              if (k.grounded) {
                // Hop first, slam on the way down.
                k.vy = 9;
                k.grounded = false;
                s.slamQueued = true;
              } else {
                s.slam = true;
                k.vy = -34;
              }
              markUsed("slam");
            }
            break;
          case "blink":
            if (spendOk(def.cost)) {
              const fx = Math.sin(k.heading);
              const fz = Math.cos(k.heading);
              const from: V3 = [k.x, k.y, k.z];
              const [tx, tz] = blinkTarget(terrain, k, fx, fz, 12, KART_RADIUS);
              k.x = tx;
              k.z = tz;
              s.blink = { from, to: [tx, k.y, tz], t: 0 };
              if (terrain.support(k.x, k.z, k.y) < k.y - 0.6) k.grounded = false;
              markUsed("blink");
            }
            break;
        }
      } else {
        switch (power) {
          case "grapple":
            // Fires from the ground, mid-air, or mid-swing to chain to the next anchor.
            if (spendOk(def.cost)) {
              const { point, drone } = findAnchor(terrain, b.x, b.y, b.z, camFx, camFz);
              const dx = point[0] - b.x;
              const dy = point[1] - (b.y + 1.6);
              const dz = point[2] - b.z;
              const len = Math.hypot(dx, dy, dz) || 1;
              s.rope = { anchor: point, len, drone, t: 0 };
              s.mode = "swing";
              s.slam = false;
              s.slamQueued = false;
              b.grounded = false;
              // The line yanks you up toward the anchor, then you swing.
              b.vx += (dx / len) * 15;
              b.vy = Math.max(b.vy, (dy / len) * 15 + 5);
              b.vz += (dz / len) * 15;
              markUsed("grapple");
            }
            break;
          case "reach":
            if (!s.reach && spendOk(def.cost)) {
              const a = findAnchor(terrain, b.x, b.y, b.z, camFx, camFz, { reach: 20, lift: 4, minRise: 1 });
              let target = a.point;
              if (a.drone) {
                // Nothing to grab: stretch to the ground ahead instead.
                const [tx, , tz] = clampToWorld([b.x + camFx * 18, 0, b.z + camFz * 18]);
                target = [tx, terrain.support(tx, tz, b.y + 2), tz];
              }
              s.reach = { target, t: 0, launched: false };
              s.rope = null;
              s.slam = false;
              s.slamQueued = false;
              markUsed("reach");
            }
            break;
          case "overdrive":
            if (hero.overdrive) hero.overdrive = false;
            else if (hero.energy > 15) {
              hero.overdrive = true;
              markUsed("overdrive");
            } else deny();
            break;
          case "leap": {
            // A big jump from the ground; one more lift in the air (or off a swing).
            const inAir = !b.grounded || s.mode === "swing";
            if ((!inAir || !s.airLeap) && spendOk(def.cost)) {
              if (inAir) s.airLeap = true;
              b.vy = inAir ? Math.max(b.vy, 12) : 15.5;
              b.grounded = false;
              s.rope = null;
              s.slam = false;
              s.slamQueued = false;
              s.mode = "air";
              markUsed("leap");
            }
            break;
          }
          case "slam":
            if (!s.slam && !s.slamQueued && spendOk(def.cost)) {
              s.rope = null;
              s.mode = "air";
              if (b.grounded) {
                // From standing: spring up, then slam down.
                b.vy = 9;
                b.grounded = false;
                s.slamQueued = true;
              } else {
                s.slam = true;
                b.vy = -34;
                b.vx *= 0.3;
                b.vz *= 0.3;
              }
              markUsed("slam");
            }
            break;
          case "blink":
            if (spendOk(def.cost)) {
              const fx = moving ? mx : Math.sin(avatar.heading);
              const fz = moving ? mz : Math.cos(avatar.heading);
              const l = Math.hypot(fx, fz) || 1;
              const from: V3 = [b.x, b.y, b.z];
              const [tx, tz] = blinkTarget(terrain, b, fx / l, fz / l, 12);
              b.x = tx;
              b.z = tz;
              s.blink = { from, to: [tx, b.y, tz], t: 0 };
              if (s.mode !== "swing" && terrain.support(b.x, b.z, b.y) < b.y - 0.6) {
                b.grounded = false;
                s.mode = "air";
              }
              markUsed("blink");
            }
            break;
        }
      }
    }
    // A queued slam fires at the top of the hop.
    if (s.slamQueued) {
      const body = s.mode === "kart" ? k : b;
      if (body.vy <= 0 && !body.grounded) {
        s.slamQueued = false;
        s.slam = true;
        body.vy = -34;
        if (s.mode !== "kart") {
          b.vx *= 0.3;
          b.vz *= 0.3;
        }
      } else if (body.grounded) s.slamQueued = false;
    }
    // Let go of the grapple to fly.
    if (s.mode === "swing" && (!held || power !== "grapple" || panelOpen)) {
      s.mode = "air";
      s.rope = null;
      b.vx *= 1.1;
      b.vz *= 1.1;
      b.vy += 2;
    }
    // Elastic reach: stretch (0.18 s), then sling toward the target.
    if (s.reach) {
      s.reach.t += dt;
      if (!s.reach.launched && s.reach.t >= 0.18) {
        const from: V3 = [b.x, b.y, b.z];
        const to: V3 = [s.reach.target[0], s.reach.target[1] + 0.2, s.reach.target[2]];
        const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
        const [vx, vy, vz] = launchVelocity(from, to, THREE.MathUtils.clamp(d / 26, 0.45, 1.1));
        b.vx = vx;
        b.vy = vy;
        b.vz = vz;
        b.grounded = false;
        s.mode = "air";
        s.reach.launched = true;
      }
      if (s.reach.t > 0.45) s.reach = null;
    }

    // Energy: Overdrive drains it, everything else lets it refill.
    if (hero.overdrive) {
      hero.energy -= powerById("overdrive")!.cost * dt;
      if (hero.energy <= 0) {
        hero.energy = 0;
        hero.overdrive = false;
      }
    } else hero.energy = Math.min(ENERGY_MAX, hero.energy + ENERGY_REGEN * dt);

    /* ── Movement ── */
    let landed = 0;
    if (s.mode === "kart") {
      const before = Math.abs(forwardSpeed(k));
      const wasAir = !k.grounded;
      const impact = stepKart(terrain, k, panelOpen ? 0 : input.z, panelOpen ? 0 : input.x, input.jumpHeld && !panelOpen, dt, hero.overdrive ? 1.45 : 1);
      if (wasAir && k.grounded) {
        s.airLeap = false;
        if (s.slam) {
          s.shock = { x: k.x, y: k.y, z: k.z, t: 0 };
          view.shake = 0.9;
          s.slam = false;
        } else if (impact > 14) view.shake = 0.3;
      }
      const after = Math.abs(forwardSpeed(k));
      if (before - after > 8) view.shake = Math.min(0.6, (before - after) * 0.04); // crash
      b.x = k.x;
      b.y = k.y;
      b.z = k.z;
      b.grounded = k.grounded;
      avatar.heading = k.heading;
      s.speed = after;
      s.wheel += forwardSpeed(k) * dt / 0.26;
      input.jump = false;
    } else if (s.mode === "swing" && s.rope) {
      s.rope.t += dt;
      // Reel in hard until the bottom of the arc clears the street, then gently.
      const floor = terrain.support(b.x, b.z, b.y);
      const lowArc = s.rope.anchor[1] - s.rope.len < floor + 3;
      s.rope.len = stepSwing(terrain, b, s.rope.anchor, s.rope.len, mx, mz, dt, lowArc ? 16 : 3);
      if (s.rope.t > 0.4 && b.vy <= 0 && b.y <= terrain.support(b.x, b.z, b.y) + 0.01) {
        b.grounded = true;
        s.mode = "walk";
        s.rope = null;
        s.airLeap = false;
      }
      s.speed = Math.hypot(b.vx, b.vz);
      input.jump = false;
    } else if (!b.grounded) {
      s.mode = "air";
      const glide = power === "leap" && held && !s.slam;
      landed = stepAir(terrain, b, mx, mz, dt, { glide, control: hero.overdrive ? 12 : 6 });
      if (b.grounded) {
        s.mode = "walk";
        s.airLeap = false;
        s.squash = Math.min(1, landed / 12);
        if (s.slam) {
          s.shock = { x: b.x, y: b.y, z: b.z, t: 0 };
          view.shake = 0.9;
          s.slam = false;
        } else if (landed > 16) view.shake = 0.3;
      }
      s.speed = Math.hypot(b.vx, b.vz);
      input.jump = false;
    } else {
      s.mode = "walk";
      const top = hero.overdrive ? 34 : running ? 10 : 5.2;
      s.speed = THREE.MathUtils.damp(s.speed, moving ? top : 0, hero.overdrive ? 4 : 10, dt);
      stepGround(terrain, b, mx * s.speed, mz * s.speed, dt);
      if (!b.grounded) s.mode = "air";
      if (input.jump && !panelOpen && b.grounded) {
        b.vy = hero.overdrive ? 9 : running && moving ? 7.2 : 6.4;
        b.grounded = false;
        s.mode = "air";
      }
      input.jump = false;
    }
    s.squash = Math.max(0, s.squash - dt * 6);

    // Facing: where you walk, or where you fly.
    if (s.mode === "walk" && moving) {
      const want = Math.atan2(mx, mz);
      const diff = Math.atan2(Math.sin(want - avatar.heading), Math.cos(want - avatar.heading));
      avatar.heading += diff * Math.min(1, dt * 12);
    } else if ((s.mode === "air" || s.mode === "swing") && Math.hypot(b.vx, b.vz) > 2) {
      const want = Math.atan2(b.vx, b.vz);
      const diff = Math.atan2(Math.sin(want - avatar.heading), Math.cos(want - avatar.heading));
      avatar.heading += diff * Math.min(1, dt * 8);
    }
    if (moving || s.mode !== "walk") view.idle = 0;
    else view.idle += dt;

    // Publish for the camera, HUD, minimap and labels.
    avatar.x = b.x;
    avatar.z = b.z;
    const ground = terrain.support(b.x, b.z, b.y + 0.01);
    avatar.ground = ground;
    avatar.y = Math.max(0, b.y - ground);
    avatar.speed = s.speed;
    hero.speed = s.speed;
    hero.mode = s.mode;

    /* ── Lap timing ── */
    if (s.mode === "kart") {
      for (const e of lap.update(k.x, k.z, performance.now())) onLap(e, lap, g);
      hero.lap.running = lap.running;
      hero.lap.startedAt = lap.startedAt;
      hero.lap.valid = lap.valid;
      hero.lap.passed = lap.passed;
    }

    /* ── Pose ── */
    const inKart = s.mode === "kart";
    const airborne = !b.grounded || s.mode === "swing";
    const tuck = airborne && !inKart ? THREE.MathUtils.clamp(1 - Math.abs(b.vy) / 6.4, 0, 1) : 0;
    if (root.current) {
      root.current.position.set(b.x, b.y + (inKart ? -0.32 : 0), b.z);
      root.current.rotation.y = avatar.heading;
      // Lean into swings and super-speed runs.
      root.current.rotation.x = rm ? 0 : s.mode === "swing" ? -0.35 : hero.overdrive && s.mode === "walk" ? 0.28 * Math.min(1, s.speed / 20) : 0;
      const sq = rm ? 0 : s.squash * 0.18;
      const stretch = rm || !airborne ? 0 : Math.min(0.08, Math.abs(b.vy) * 0.012);
      root.current.scale.set(1 + sq * 0.5 - stretch * 0.4, 1 - sq + stretch, 1 + sq * 0.5 - stretch * 0.4);
    }
    if (shadow.current) {
      // The shadow stays on the ground and shrinks and fades with height.
      shadow.current.visible = !inKart;
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
    const sp = inKart ? 0 : s.speed;
    if (!rm && !airborne) s.walkPhase += dt * (4 + Math.min(sp, 14) * 1.3);
    const swing = airborne || inKart ? 0 : Math.sin(s.walkPhase) * Math.min(1, sp / 5) * 0.7;
    if (legL.current) legL.current.rotation.x = inKart ? -1.35 : swing - tuck * 0.9;
    if (legR.current) legR.current.rotation.x = inKart ? -1.35 : -swing - tuck * 0.5;
    if (body.current) body.current.position.y = rm || airborne || inKart ? 0 : Math.abs(Math.cos(s.walkPhase)) * 0.05 * Math.min(1, sp / 5) + Math.sin(s.walkPhase * 0.3) * 0.01;
    if (head.current) {
      // Eyes follow the camera: the head turns toward where the visitor is looking, within a neck's reach.
      const lookYaw = view.yaw + Math.PI;
      const turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(lookYaw - avatar.heading), Math.cos(lookYaw - avatar.heading)), -1.1, 1.1);
      const tilt = THREE.MathUtils.clamp((view.pitch[view.mode] - 0.35) * 0.5, -0.25, 0.35);
      const kk = 1 - Math.exp(-dt * (rm ? 30 : 8));
      head.current.rotation.y += (turn - head.current.rotation.y) * kk;
      head.current.rotation.x += (tilt - head.current.rotation.x) * kk;
    }
    if (scarf.current) scarf.current.rotation.x = 0.3 + Math.min(1, (inKart ? s.speed / 3 : sp) / 6) * 0.7 + (airborne ? THREE.MathUtils.clamp(-b.vy * 0.08, -0.3, 0.6) : 0) + (rm ? 0 : Math.sin(s.walkPhase * 0.7) * 0.08);

    updateFx(fx, s, b, dt, rm);
    updateKart(kartRefs, k, s, inKart);

    /* ── Proximity ── */
    let near: NearId | null = null;
    let best = 4.3;
    if (b.y < 3) {
      for (const sec of SECTIONS) {
        const d = Math.hypot(b.x - sec.at[0], b.z - sec.at[1]);
        if (d < best) {
          best = d;
          near = sec.id;
        }
      }
      CABINET_Z.forEach((cz, i) => {
        // Stand in front of the screen (cabinets face -x).
        const d = Math.hypot(b.x - (CABINET_X - 1.2), b.z - cz);
        if (d < CABINET_REACH && d < best) {
          best = d;
          near = `cab:${CABINETS[i]}`;
        }
      });
      const jd = Math.hypot(b.x - JUKEBOX_AT[0], b.z - JUKEBOX_AT[1]);
      if (jd < 2.4 && jd < best) {
        best = jd;
        near = "jukebox";
      }
      if (inBackroom(b.x, b.z)) {
        near = "backroom";
        if (!g.backroomOpen) g.openBackroom();
      }
    }
    const o = OVERLOOK_RECT;
    if (b.y >= OVERLOOK_Y - 0.1 && b.x > o.x0 && b.x < o.x1 && b.z > o.z0 && b.z < o.z1 && !g.secrets.includes("overlook")) g.unlock("overlook");
    g.setNear(near);
  });

  return (
    <>
      <group ref={root}>
        {/* Follow lights give the avatar a rim against the dark streets. */}
        <pointLight position={[-0.8, 2.6, -1.4]} intensity={6} distance={5} color="#3ee8e0" decay={1.5} />
        <pointLight position={[0.9, 1.8, 1.6]} intensity={2.5} distance={4} color="#ff6a8a" decay={1.5} />
        <Figure legL={legL} legR={legR} body={body} scarf={scarf} shadow={shadow} head={head} />
        <sprite ref={marker} position={[0, 1.2, 0]} visible={false}>
          <spriteMaterial map={glow} color="#3ee8e0" transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      <HeroFx refs={fx} />
      <KartModel refs={kartRefs} />
    </>
  );
}

/* ───────────────────────── Lap events ───────────────────────── */

function onLap(e: LapEvent, lap: LapTimer, g: ReturnType<typeof useGame.getState>) {
  const now = performance.now();
  hero.lap.lastEventAt = now;
  if (e.type === "start") hero.lap.lastEvent = "Lap started";
  else if (e.type === "checkpoint") hero.lap.lastEvent = `Checkpoint ${e.n}`;
  else if (e.type === "invalid") {
    hero.lap.lastEvent = `${e.reason}: lap won't count`;
  } else if (e.type === "lap") {
    if (!e.valid) {
      hero.lap.lastEvent = "Lap not counted";
      return;
    }
    hero.lap.lastMs = e.ms;
    hero.lap.lastEvent = `Lap ${formatLap(e.ms)}`;
    const prevBest = hero.lap.bestMs;
    if (prevBest === null || e.ms < prevBest) {
      hero.lap.bestMs = e.ms;
      try {
        localStorage.setItem(LAP_KEY, String(Math.round(e.ms)));
      } catch {
        /* no storage */
      }
    }
    g.unlock("lap");
    void postScore("kart", Math.round(e.ms)).then((r) => {
      const body = r.ok ? (r.rank ? `#${r.rank} of everyone who has driven here.` : "Logged on the global board.") : "Saved on this device; the global board is offline.";
      useGame.getState().toast({ tone: "info", title: `${prevBest === null || e.ms < prevBest ? "New best lap" : "Lap"} ${formatLap(e.ms)}`, body });
    });
    void lap;
  }
}

/* ───────────────────────── Effects ───────────────────────── */

type FxRefs = {
  rope: THREE.Line | null;
  drone: THREE.Group | null;
  arm: THREE.Mesh | null;
  hand: THREE.Mesh | null;
  ghosts: THREE.Group[];
  blinkA: THREE.Sprite | null;
  blinkB: THREE.Sprite | null;
  ring: THREE.Mesh | null;
};

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();

function updateFx(f: FxRefs, s: HeroState, b: Body, dt: number, rm: boolean) {
  const hx = b.x + Math.sin(avatar.heading) * 0.15;
  const hy = b.y + 1.75;
  const hz = b.z + Math.cos(avatar.heading) * 0.15;
  // Grapple line and the courier drone that catches it in open sky.
  if (f.rope) {
    f.rope.visible = !!s.rope;
    if (s.rope) {
      const pos = f.rope.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, hx, hy, hz);
      pos.setXYZ(1, ...s.rope.anchor);
      pos.needsUpdate = true;
      f.rope.geometry.computeBoundingSphere();
    }
  }
  if (f.drone) {
    f.drone.visible = !!s.rope?.drone;
    if (s.rope?.drone) {
      f.drone.position.set(s.rope.anchor[0], s.rope.anchor[1] + 0.3, s.rope.anchor[2]);
      if (!rm) f.drone.rotation.y += dt * 4;
    }
  }
  // Elastic reach: an arm that stretches out to the target and snaps back.
  if (f.arm && f.hand) {
    const r = s.reach;
    f.arm.visible = f.hand.visible = !!r;
    if (r) {
      const out = r.t < 0.18 ? r.t / 0.18 : Math.max(0, 1 - (r.t - 0.18) / 0.27);
      const sx = b.x;
      const sy = b.y + 1.5;
      const sz = b.z;
      _dir.set(r.target[0] - sx, r.target[1] + 0.4 - sy, r.target[2] - sz);
      const full = _dir.length();
      const len = Math.max(0.05, full * out);
      _dir.normalize();
      f.arm.position.set(sx + _dir.x * len * 0.5, sy + _dir.y * len * 0.5, sz + _dir.z * len * 0.5);
      f.arm.quaternion.copy(_q.setFromUnitVectors(_up, _dir));
      f.arm.scale.set(1, len, 1);
      f.hand.position.set(sx + _dir.x * len, sy + _dir.y * len, sz + _dir.z * len);
    }
  }
  // Overdrive afterimages: a fading trail of the silhouette.
  s.trailT += dt;
  if (hero.overdrive && s.mode !== "kart" && s.trailT > 0.035) {
    s.trailT = 0;
    s.trail.unshift({ x: b.x, y: b.y, z: b.z, h: avatar.heading, t: performance.now() });
    s.trail.length = Math.min(s.trail.length, GHOSTS);
  }
  const now = performance.now();
  f.ghosts.forEach((gh, i) => {
    const p = s.trail[i];
    const age = p ? (now - p.t) / 320 : 1;
    gh.visible = !!p && age < 1 && !rm;
    if (!p || !gh.visible) return;
    gh.position.set(p.x, p.y, p.z);
    gh.rotation.y = p.h;
    gh.children.forEach((c) => (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - age)));
  });
  if (!hero.overdrive && s.trail.length && now - s.trail[0].t > 400) s.trail.length = 0;
  // Blink: flashes at both ends.
  if (s.blink) {
    s.blink.t += dt;
    const a = Math.max(0, 1 - s.blink.t / 0.35);
    for (const [sp, p] of [
      [f.blinkA, s.blink.from],
      [f.blinkB, s.blink.to],
    ] as const) {
      if (!sp) continue;
      sp.visible = a > 0;
      sp.position.set(p[0], p[1] + 1, p[2]);
      sp.scale.setScalar(2 + (1 - a) * 3);
      (sp.material as THREE.SpriteMaterial).opacity = a;
    }
    if (a <= 0) s.blink = null;
  }
  // Slam shockwave ring.
  if (f.ring) {
    f.ring.visible = !!s.shock;
    if (s.shock) {
      s.shock.t += dt;
      const t = s.shock.t / 0.55;
      f.ring.position.set(s.shock.x, s.shock.y + 0.06, s.shock.z);
      f.ring.scale.setScalar(1 + t * 11);
      (f.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) s.shock = null;
    }
  }
}

function HeroFx({ refs }: { refs: FxRefs }) {
  const glow = useMemo(() => glowTexture(), []);
  const rope = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#e9e4d6", toneMapped: false }));
    line.frustumCulled = false;
    line.visible = false;
    return line;
  }, []);
  useEffect(() => {
    refs.rope = rope;
    return () => {
      rope.geometry.dispose();
      (rope.material as THREE.Material).dispose();
    };
  }, [refs, rope]);
  const ghostMats = useMemo(() => Array.from({ length: GHOSTS }, () => new THREE.MeshBasicMaterial({ color: "#ffb547", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), []);
  return (
    <>
      <primitive object={rope} />
      <group ref={(el: THREE.Group | null) => void (refs.drone = el)} visible={false}>
        <mesh>
          <octahedronGeometry args={[0.35, 0]} />
          <meshBasicMaterial color="#3ee8e0" toneMapped={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.6, 0.04, 4, 20]} />
          <meshBasicMaterial color="#ff3b4f" toneMapped={false} />
        </mesh>
        <sprite scale={[2.4, 2.4, 1]}>
          <spriteMaterial map={glow} color="#3ee8e0" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      <mesh ref={(el: THREE.Mesh | null) => void (refs.arm = el)} visible={false}>
        <cylinderGeometry args={[0.07, 0.07, 1, 8]} />
        <meshStandardMaterial color="#c41a2e" emissive="#3a0008" roughness={0.6} />
      </mesh>
      <mesh ref={(el: THREE.Mesh | null) => void (refs.hand = el)} visible={false}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color="#c9a48a" roughness={0.8} />
      </mesh>
      {ghostMats.map((m, i) => (
        <group key={i} ref={(el: THREE.Group | null) => void (refs.ghosts[i] = el!)} visible={false}>
          <mesh material={m} position={[0, 1.05, 0]}>
            <capsuleGeometry args={[0.28, 1.1, 4, 8]} />
          </mesh>
          <mesh material={m} position={[0, 1.93, 0]}>
            <sphereGeometry args={[0.18, 10, 8]} />
          </mesh>
        </group>
      ))}
      {(["blinkA", "blinkB"] as const).map((key) => (
        <sprite key={key} ref={(el: THREE.Sprite | null) => void (refs[key] = el)} visible={false}>
          <spriteMaterial map={glow} color="#3ee8e0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      <mesh ref={(el: THREE.Mesh | null) => void (refs.ring = el)} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#ff3b4f" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/* ───────────────────────── Kart ───────────────────────── */

type KartRefs = { root: THREE.Group | null; wheels: THREE.Group[]; front: THREE.Group[]; glow: THREE.MeshBasicMaterial | null };

function updateKart(r: KartRefs, k: Kart & { parked: boolean }, s: HeroState, inKart: boolean) {
  if (!r.root) return;
  r.root.visible = inKart || k.parked;
  if (!r.root.visible) return;
  r.root.position.set(k.x, k.y, k.z);
  r.root.rotation.y = k.heading;
  r.wheels.forEach((w) => w && (w.rotation.x = s.wheel));
  r.front.forEach((w) => w && (w.rotation.y = -k.steer * 0.45));
  if (r.glow) r.glow.opacity = inKart ? (k.drifting ? 0.85 : hero.overdrive ? 0.7 : 0.45) : 0.2;
}

/** An original go-kart: low chassis, side pods, a spoiler with a lit edge and an underglow. */
function KartModel({ refs }: { refs: KartRefs }) {
  const m = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: "#2a2f52", roughness: 0.4, metalness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: "#101220", roughness: 0.7, metalness: 0.3 }),
      tyre: new THREE.MeshStandardMaterial({ color: "#0b0b10", roughness: 0.9 }),
      crimson: new THREE.MeshBasicMaterial({ color: "#ff3b4f", toneMapped: false }),
      cyan: new THREE.MeshBasicMaterial({ color: "#3ee8e0", toneMapped: false }),
    }),
    [],
  );
  const wheelPos: [number, number, boolean][] = [
    [-0.72, 0.72, true],
    [0.72, 0.72, true],
    [-0.72, -0.72, false],
    [0.72, -0.72, false],
  ];
  return (
    <group ref={(el: THREE.Group | null) => void (refs.root = el)} visible={false}>
      {/* Underglow */}
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.8, 2.6]} />
        <meshBasicMaterial ref={(el: THREE.MeshBasicMaterial | null) => void (refs.glow = el)} map={glowTexture()} color="#ff3b4f" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Chassis, nose and side pods */}
      <mesh material={m.dark} position={[0, 0.22, 0]}>
        <boxGeometry args={[1.15, 0.12, 2.1]} />
      </mesh>
      <mesh material={m.body} position={[0, 0.34, 0.82]} rotation-x={0.25}>
        <boxGeometry args={[0.9, 0.18, 0.6]} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} material={m.body} position={[x, 0.33, -0.05]}>
          <boxGeometry args={[0.22, 0.22, 1.1]} />
        </mesh>
      ))}
      <mesh material={m.crimson} position={[0, 0.3, 1.13]}>
        <boxGeometry args={[0.95, 0.05, 0.05]} />
      </mesh>
      {/* Seat and steering wheel */}
      <mesh material={m.dark} position={[0, 0.5, -0.45]} rotation-x={-0.25}>
        <boxGeometry args={[0.55, 0.55, 0.12]} />
      </mesh>
      <mesh material={m.dark} position={[0, 0.62, 0.32]} rotation-x={-1.1}>
        <torusGeometry args={[0.16, 0.025, 6, 16]} />
      </mesh>
      {/* Rear spoiler with a lit edge */}
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} material={m.dark} position={[x, 0.55, -0.98]}>
          <boxGeometry args={[0.05, 0.35, 0.08]} />
        </mesh>
      ))}
      <mesh material={m.body} position={[0, 0.74, -1.0]}>
        <boxGeometry args={[1.15, 0.05, 0.3]} />
      </mesh>
      <mesh material={m.cyan} position={[0, 0.77, -1.15]}>
        <boxGeometry args={[1.15, 0.03, 0.03]} />
      </mesh>
      {/* Wheels: rear spin, front spin and steer */}
      {wheelPos.map(([x, z, front], i) => (
        <group key={i} position={[x, 0.26, z]} ref={(el: THREE.Group | null) => void (front ? (refs.front[i] = el!) : null)}>
          <group ref={(el: THREE.Group | null) => void (refs.wheels[i] = el!)}>
            <mesh material={m.tyre} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.26, 0.26, 0.24, 14]} />
            </mesh>
            <mesh material={front ? m.cyan : m.crimson} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.12, 0.12, 0.25, 6]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
