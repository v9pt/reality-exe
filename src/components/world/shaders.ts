/**
 * Hand-written shaders for the city. Lighting is baked into the shading
 * (window glow, street bounce, light pools) so the scene needs almost no
 * real-time lights.
 */

export const FOG_COLOR = "#120f24";
export const FOG_DENSITY = 0.021;

/**
 * One density uniform shared by every city material. The camera rig thins
 * it as the camera pulls back, so the whole district stays readable from above.
 */
export const fogDensity = { value: FOG_DENSITY };

const fogChunk = /* glsl */ `
  float fogD = length(vWorld - cameraPosition);
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * fogD * fogD);
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
`;

/**
 * Sky and weather, shared by every city material (see SkyDriver): how much
 * daylight there is, where the sun is, the ambient light, and how wet or
 * snowy the city is.
 */
export const envChunk = /* glsl */ `
  uniform float uDay;
  uniform float uDusk;
  uniform vec3 uSunDir;
  uniform vec3 uSunCol;
  uniform vec3 uAmbient;
  uniform float uWet;
  uniform float uSnow;
  uniform float uFlash;
`;

const hashChunk = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

export const buildingVertex = /* glsl */ `
  attribute float aSeed;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vLocalN;
  varying float vSeed;
  varying float vHeight;
  varying vec3 vWN;
  void main() {
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      vec3 scl = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec4 world = modelMatrix * instanceMatrix * local;
      vWN = normalize(mat3(modelMatrix * instanceMatrix) * (normal / scl));
    #else
      vec3 scl = vec3(1.0);
      vec4 world = modelMatrix * local;
      vWN = normalize(mat3(modelMatrix) * normal);
    #endif
    vLocal = position * scl;
    vLocalN = normal;
    vSeed = aSeed;
    vHeight = scl.y;
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const buildingFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  ${envChunk}
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vLocalN;
  varying float vSeed;
  varying float vHeight;
  varying vec3 vWN;
  ${hashChunk}
  void main() {
    // Night: dark facades lit by their own windows. Day: concrete and glass lit by the sun.
    vec3 night = mix(vec3(0.03, 0.034, 0.062), vec3(0.055, 0.058, 0.095), smoothstep(0.0, 50.0, vLocal.y));
    vec3 albedo = mix(vec3(0.3, 0.32, 0.38), vec3(0.48, 0.47, 0.5), fract(vSeed * 4.7));
    float lam = max(dot(normalize(vWN), uSunDir), 0.0) * smoothstep(-0.02, 0.08, uSunDir.y);
    vec3 dayCol = albedo * (uAmbient + uSunCol * lam * 0.95);
    vec3 col = mix(night, dayCol, uDay);
    vec3 glow = vec3(0.0);
    float glass = 0.0;
    if (abs(vLocalN.y) < 0.5) {
      vec2 uv = abs(vLocalN.x) > 0.5 ? vLocal.zy : vLocal.xy;
      // Each building gets its own floor height and window rhythm.
      vec2 cell = vec2(0.85 + fract(vSeed * 3.7) * 0.5, 1.05 + fract(vSeed * 5.3) * 0.3);
      vec2 id = floor(uv / cell);
      vec2 f = fract(uv / cell);
      float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.72);
      float h = hash(id + vec2(vSeed * 17.0) + vLocalN.xz * 3.1);
      float density = 0.7 + fract(vSeed * 9.1) * 0.22;
      float lit = step(density, h) * step(2.2, vLocal.y);
      vec3 warm = vec3(1.0, 0.68, 0.38);
      vec3 cool = vec3(0.4, 0.88, 1.0);
      vec3 pale = vec3(0.78, 0.8, 1.0);
      vec3 wc = h > 0.95 ? cool : (h > 0.84 ? warm : pale);
      float intensity = (0.2 + 0.55 * fract(h * 7.31)) * (0.75 + 0.25 * f.y);
      glow += win * lit * wc * intensity;
      col += win * (1.0 - lit) * vec3(0.02, 0.026, 0.05) * (1.0 - uDay);
      glass = win;
      // Bounce light from the street below.
      glow += vec3(0.32, 0.08, 0.36) * exp(-vLocal.y * 0.28) * 0.32;
      // Some roofs carry a lit trim.
      float trim = step(0.82, fract(vSeed * 13.7));
      vec3 trimCol = fract(vSeed * 21.3) > 0.5 ? vec3(0.24, 0.9, 0.88) : vec3(1.0, 0.23, 0.31);
      col += trim * smoothstep(0.5, 0.0, vHeight - vLocal.y) * trimCol * 0.9;
    } else if (vLocalN.y > 0.5) {
      // Roofs gather snow.
      col = mix(col, vec3(0.9, 0.92, 0.97) * (0.22 + 0.78 * uDay) * (0.8 + 0.2 * hash(floor(vWorld.xz * 3.0))), uSnow * 0.92);
    }
    // Windows read as glass by day and glow by night; a lightning flash lights everything.
    col = mix(col, vec3(0.16, 0.22, 0.3) * (0.4 + uAmbient), glass * uDay * 0.6);
    col += glow * (1.0 - 0.85 * uDay);
    col += uFlash * 0.35 * vec3(0.75, 0.8, 1.0) * (0.3 + 0.7 * max(vWN.y, 0.3));
    ${fogChunk}
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const groundVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const groundFragment = /* glsl */ `
  #define POOLS 12
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  uniform vec3 uPools[POOLS];
  uniform vec3 uPoolCol[POOLS];
  uniform sampler2D uMap;
  uniform float uMapHalf;
  ${envChunk}
  varying vec3 vWorld;
  ${hashChunk}
  void main() {
    vec2 p = vWorld.xz;
    vec3 col = vec3(0.022, 0.024, 0.042);

    // The walkable map: R = paving, B = road markings. Painted from world-map.ts.
    vec2 uv = p / (uMapHalf * 2.0) + 0.5;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec4 m = texture2D(uMap, uv) * inside;
    float px = 1.0 / 1024.0;
    float around = min(min(texture2D(uMap, uv + vec2(px * 2.0, 0.0)).r, texture2D(uMap, uv - vec2(px * 2.0, 0.0)).r),
                       min(texture2D(uMap, uv + vec2(0.0, px * 2.0)).r, texture2D(uMap, uv - vec2(0.0, px * 2.0)).r));
    float edge = clamp((m.r - around * inside) * 3.0, 0.0, 1.0);

    vec2 g = abs(fract(p / 1.6) - 0.5);
    float joint = smoothstep(0.47, 0.5, max(g.x, g.y));
    col += m.r * vec3(0.012, 0.012, 0.022);
    col += m.r * joint * vec3(0.025, 0.028, 0.045);
    col += m.b * vec3(0.5, 0.45, 0.32) * 0.45;

    // By day: asphalt, lighter paving with joints, painted markings, lit by sun and sky.
    float grain = vnoise(p * 1.7) * 0.05;
    vec3 dayAlb = vec3(0.16, 0.165, 0.18) + grain;
    dayAlb = mix(dayAlb, vec3(0.34, 0.33, 0.33) + grain, m.r);
    dayAlb -= m.r * joint * 0.08;
    dayAlb = mix(dayAlb, vec3(0.82, 0.76, 0.55), m.b * 0.8);
    vec3 dayCol = dayAlb * (uAmbient + uSunCol * max(uSunDir.y, 0.0) * 0.9);
    col = mix(col, dayCol, uDay);
    col += edge * vec3(0.24, 0.9, 0.88) * 0.5 * (1.0 - 0.6 * uDay);

    // Inlaid circle at the heart of the plaza.
    col += smoothstep(0.04, 0.0, abs(length(p) - 5.0)) * vec3(1.0, 0.23, 0.31) * 0.22;

    // Wet patches reflect more of everything; they dry out in clear weather.
    float n = vnoise(p * 0.16) * 0.6 + vnoise(p * 0.55) * 0.4;
    float wet = smoothstep(0.5, 0.68, n) * uWet;
    col += wet * mix(vec3(0.03, 0.02, 0.065), vec3(0.05, 0.06, 0.08), uDay);
    col *= 1.0 - wet * 0.25 * uDay;

    // Baked light pools under each landmark and district: strongest at night.
    for (int i = 0; i < POOLS; i++) {
      float d = length(p - uPools[i].xz);
      col += uPoolCol[i] * exp(-d * d * 0.07 / max(uPools[i].y, 1.0)) * (0.22 + wet * 0.75) * (1.0 - 0.8 * uDay);
    }
    // Rain ripples on wet patches.
    float ripple = sin(length(fract(p * 0.7) - 0.5) * 40.0 - uTime * 6.0 + hash(floor(p * 0.7)) * 6.28);
    col += wet * smoothstep(0.92, 1.0, ripple) * vec3(0.05, 0.06, 0.09) * (1.0 - uSnow);

    // Snow settles unevenly, thinnest where people walk.
    float drift = smoothstep(0.25, 0.7, vnoise(p * 0.35) * 0.7 + vnoise(p * 2.1) * 0.3 + uSnow * 0.45 - m.r * 0.15);
    col = mix(col, vec3(0.88, 0.9, 0.95) * (0.2 + 0.8 * (uAmbient.g + uSunCol.g * max(uSunDir.y, 0.0) * 0.6)), uSnow * drift * 0.9);

    col += uFlash * 0.25 * vec3(0.75, 0.8, 1.0);
    ${fogChunk}
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

export const skyFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunCol;
  uniform vec3 uMoonDir;
  uniform float uPhase;
  uniform float uDay;
  uniform float uDusk;
  uniform float uCloud;
  uniform float uFlash;
  varying vec3 vDir;
  ${hashChunk}
  float fbm(vec2 p) {
    return vnoise(p) * 0.5 + vnoise(p * 2.03) * 0.3 + vnoise(p * 4.1) * 0.2;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.5, h));
    // The low glow toward the sun at dawn and dusk.
    float sd = max(dot(d, uSunDir), 0.0);
    float clear = 1.0 - uCloud * 0.8;
    col += uSunCol * pow(sd, 6.0) * (0.55 * uDusk + 0.12 * uDay) * clear;

    // Night: the magenta street glow along the horizon, haze lines, stars and the orbital ring.
    float night = 1.0 - uDay;
    col += vec3(0.55, 0.12, 0.32) * exp(-abs(h) * 12.0) * 0.32 * night;
    vec3 axis = normalize(vec3(0.3, 1.0, -0.42));
    float band = abs(dot(d, axis) - 0.22);
    float ring = smoothstep(0.012, 0.0, band) * smoothstep(0.02, 0.25, h);
    float seg = step(0.15, fract(atan(d.z, d.x) * 18.0));
    col += ring * (0.5 + 0.5 * seg) * vec3(0.55, 0.6, 0.85) * 0.28 * (1.0 - 0.65 * uDay);
    col += smoothstep(0.004, 0.0, abs(h - 0.06)) * vec3(0.3, 0.1, 0.25) * 0.2 * night;
    vec2 sp = vec2(atan(d.z, d.x) * 120.0, h * 120.0);
    float star = step(0.995, hash(floor(sp))) * smoothstep(0.15, 0.6, h);
    col += star * vec3(0.7, 0.75, 1.0) * 0.6 * night * night * (1.0 - uCloud);

    // The sun: a bright disc with a soft halo, dimmed by cloud.
    float above = smoothstep(-0.03, 0.02, uSunDir.y);
    col += uSunCol * (smoothstep(0.99935, 0.9997, sd) * 5.0 + pow(sd, 400.0) * 1.2) * clear * above;

    // The moon, lit by its real phase: waxing lights the right side, waning the left.
    float md = dot(d, uMoonDir);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.001), uMoonDir));
    vec3 up = cross(uMoonDir, right);
    vec3 off = d - uMoonDir * md;
    vec2 mp = vec2(dot(off, right), dot(off, up)) / 0.028;
    float r2 = dot(mp, mp);
    if (md > 0.0 && r2 < 1.0) {
      float edgeX = cos(uPhase * 6.2831853) * sqrt(1.0 - mp.y * mp.y);
      float lit = uPhase < 0.5 ? smoothstep(edgeX - 0.06, edgeX + 0.06, mp.x) : smoothstep(-edgeX + 0.06, -edgeX - 0.06, mp.x);
      float mare = 0.82 + 0.18 * vnoise(mp * 3.0 + 7.0);
      float disc = smoothstep(1.0, 0.92, r2);
      float vis = disc * smoothstep(-0.04, 0.03, uMoonDir.y) * (1.0 - 0.75 * uDay) * (1.0 - uCloud * 0.85);
      col = mix(col, vec3(0.92, 0.93, 0.86) * mare * (0.06 + lit), vis * (0.25 + 0.75 * lit));
    }
    col += vec3(0.75, 0.8, 0.95) * exp(-max(1.0 - md, 0.0) * 160.0) * 0.12 * night * (1.0 - uCloud) * smoothstep(-0.04, 0.03, uMoonDir.y);

    // Clouds drift above the horizon: lit by the sun by day, glowing faintly with the city at night.
    vec2 cp = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
    float cover = smoothstep(0.62 - uCloud * 0.45, 0.95 - uCloud * 0.3, fbm(cp)) * smoothstep(0.0, 0.18, h);
    vec3 cloudCol = mix(vec3(0.07, 0.05, 0.11), vec3(0.86, 0.88, 0.92) * (1.0 - uCloud * 0.45), uDay);
    cloudCol = mix(cloudCol, uSunCol * 0.85, uDusk * 0.5);
    col = mix(col, cloudCol, cover * (0.35 + 0.6 * uCloud));

    col += vec3(0.75, 0.8, 1.0) * uFlash * 0.7 * smoothstep(-0.1, 0.4, h);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Rain streaks round the avatar. `uAmount` hides a share of the drops (none in
 * clear weather), `uSpeed` sets how fast they fall, and drops under the café
 * roof (`uRoof`) are hidden.
 */
export const rainVertex = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aEnd;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uSize;
  uniform float uAmount;
  uniform float uSpeed;
  uniform vec4 uRoof;
  uniform float uRoofY;
  varying float vA;
  void main() {
    vec3 p;
    p.x = uCenter.x + mod(aSeed.x * uSize - uCenter.x, uSize) - uSize * 0.5;
    p.z = uCenter.z + mod(aSeed.z * uSize - uCenter.z, uSize) - uSize * 0.5;
    p.y = mod(aSeed.y * 28.0 - uTime * uSpeed, 28.0) - 1.0;
    float keep = step(fract(aSeed.x * 91.7 + aSeed.z * 13.3), uAmount);
    float roofed = step(uRoof.x, p.x) * step(p.x, uRoof.z) * step(uRoof.y, p.z) * step(p.z, uRoof.w) * step(p.y, uRoofY);
    keep *= 1.0 - roofed;
    p.y += aEnd * 0.75 * (uSpeed / 24.0);
    p.x += aEnd * 0.1;
    vA = mix(1.0, 0.0, aEnd) * keep;
    // Hidden drops collapse to a point behind the camera.
    gl_Position = keep > 0.5 ? projectionMatrix * viewMatrix * vec4(p, 1.0) : vec4(0.0, 0.0, -2.0, 1.0);
  }
`;

export const rainFragment = /* glsl */ `
  uniform float uFlash;
  varying float vA;
  void main() {
    gl_FragColor = vec4(mix(vec3(0.62, 0.72, 0.95), vec3(0.9, 0.93, 1.0), uFlash), 0.05 + vA * 0.22);
  }
`;

/** Snowflakes: soft round points that drift and sway as they fall. Same seeds as the rain. */
export const snowVertex = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uSize;
  uniform float uAmount;
  uniform float uSpeed;
  uniform float uPx;
  uniform vec4 uRoof;
  uniform float uRoofY;
  varying float vKeep;
  void main() {
    vec3 p;
    float t = uTime + aSeed.x * 40.0;
    p.x = uCenter.x + mod(aSeed.x * uSize - uCenter.x, uSize) - uSize * 0.5 + sin(t * 0.9 + aSeed.z * 30.0) * 0.45;
    p.z = uCenter.z + mod(aSeed.z * uSize - uCenter.z, uSize) - uSize * 0.5 + cos(t * 0.7 + aSeed.y * 20.0) * 0.35;
    p.y = mod(aSeed.y * 24.0 - uTime * uSpeed * (0.7 + aSeed.z * 0.6), 24.0) - 1.0 + uCenter.y;
    float keep = step(fract(aSeed.x * 91.7 + aSeed.z * 13.3), uAmount);
    keep *= 1.0 - step(uRoof.x, p.x) * step(p.x, uRoof.z) * step(uRoof.y, p.z) * step(p.z, uRoof.w) * step(p.y, uRoofY);
    vKeep = keep;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_PointSize = keep * uPx * (0.06 + aSeed.y * 0.05) / max(-mv.z, 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;

export const snowFragment = /* glsl */ `
  uniform float uDay;
  varying float vKeep;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(c)) * vKeep;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * (0.55 + 0.45 * uDay), a * 0.9);
  }
`;

/** Traffic on the elevated highway: every car is placed by the GPU from its lane and phase. */
export const carVertex = /* glsl */ `
  attribute vec4 aCar; // radius, phase, direction (+1/-1), speed
  uniform float uTime;
  uniform float uDeckY;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vDir;
  void main() {
    float ang = aCar.y + uTime * aCar.w * aCar.z / aCar.x;
    // Local box: x across the lane, z along the direction of travel.
    vec3 lp = position * vec3(1.0, 0.55, 2.3);
    vec2 radial = vec2(cos(ang), sin(ang));
    vec2 tangent = vec2(-sin(ang), cos(ang)) * aCar.z;
    vec3 world = vec3(radial * aCar.x + radial * lp.x + tangent * lp.z, 0.0);
    world = vec3(world.x, uDeckY + 0.35 + lp.y, world.y);
    vLocal = lp;
    vDir = aCar.z;
    vWorld = world;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

export const carFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vDir;
  void main() {
    vec3 col = vec3(0.04, 0.045, 0.08);
    // Headlights at the front, tail lights at the back, a lit stripe along the side.
    col += step(1.05, vLocal.z) * step(0.0, vLocal.y) * vec3(1.0, 0.95, 0.8) * 1.4;
    col += step(vLocal.z, -1.05) * step(0.0, vLocal.y) * vec3(1.0, 0.15, 0.25) * 1.2;
    col += step(abs(vLocal.y - 0.05), 0.04) * vec3(0.24, 0.9, 0.88) * 0.6;
    ${fogChunk}
    gl_FragColor = vec4(col, 1.0);
  }
`;
