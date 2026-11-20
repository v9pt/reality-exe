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
  void main() {
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      vec3 scl = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec4 world = modelMatrix * instanceMatrix * local;
    #else
      vec3 scl = vec3(1.0);
      vec4 world = modelMatrix * local;
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
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vLocalN;
  varying float vSeed;
  varying float vHeight;
  ${hashChunk}
  void main() {
    vec3 col = mix(vec3(0.03, 0.034, 0.062), vec3(0.055, 0.058, 0.095), smoothstep(0.0, 50.0, vLocal.y));
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
      col += win * lit * wc * intensity;
      col += win * (1.0 - lit) * vec3(0.02, 0.026, 0.05);
      // Bounce light from the street below.
      col += vec3(0.32, 0.08, 0.36) * exp(-vLocal.y * 0.28) * 0.32;
      // Some roofs carry a lit trim.
      float trim = step(0.82, fract(vSeed * 13.7));
      vec3 trimCol = fract(vSeed * 21.3) > 0.5 ? vec3(0.24, 0.9, 0.88) : vec3(1.0, 0.23, 0.31);
      col += trim * smoothstep(0.5, 0.0, vHeight - vLocal.y) * trimCol * 0.9;
    }
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
    col += m.r * vec3(0.012, 0.012, 0.022);
    col += m.r * smoothstep(0.47, 0.5, max(g.x, g.y)) * vec3(0.025, 0.028, 0.045);
    col += edge * vec3(0.24, 0.9, 0.88) * 0.5;
    col += m.b * vec3(0.5, 0.45, 0.32) * 0.45;

    // Inlaid circle at the heart of the plaza.
    col += smoothstep(0.04, 0.0, abs(length(p) - 5.0)) * vec3(1.0, 0.23, 0.31) * 0.22;

    // Wet patches reflect more of everything.
    float n = vnoise(p * 0.16) * 0.6 + vnoise(p * 0.55) * 0.4;
    float wet = smoothstep(0.5, 0.68, n);
    col += wet * vec3(0.03, 0.02, 0.065);

    // Baked light pools under each landmark and district.
    for (int i = 0; i < POOLS; i++) {
      float d = length(p - uPools[i].xz);
      col += uPoolCol[i] * exp(-d * d * 0.07 / max(uPools[i].y, 1.0)) * (0.22 + wet * 0.75);
    }
    // Rain ripples on wet patches.
    float ripple = sin(length(fract(p * 0.7) - 0.5) * 40.0 - uTime * 6.0 + hash(floor(p * 0.7)) * 6.28);
    col += wet * smoothstep(0.92, 1.0, ripple) * vec3(0.05, 0.06, 0.09);

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
  varying vec3 vDir;
  ${hashChunk}
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(vec3(0.15, 0.06, 0.21), vec3(0.016, 0.02, 0.052), smoothstep(-0.02, 0.5, h));
    col += vec3(0.55, 0.12, 0.32) * exp(-abs(h) * 12.0) * 0.32;
    // A colossal orbital ring hangs over the district.
    vec3 axis = normalize(vec3(0.3, 1.0, -0.42));
    float band = abs(dot(d, axis) - 0.22);
    float ring = smoothstep(0.012, 0.0, band) * smoothstep(0.02, 0.25, h);
    float seg = step(0.15, fract(atan(d.z, d.x) * 18.0));
    col += ring * (0.5 + 0.5 * seg) * vec3(0.55, 0.6, 0.85) * 0.28;
    // Thin haze lines.
    col += smoothstep(0.004, 0.0, abs(h - 0.06)) * vec3(0.3, 0.1, 0.25) * 0.2;
    // Sparse stars above the glow.
    vec2 sp = vec2(atan(d.z, d.x) * 120.0, h * 120.0);
    float star = step(0.995, hash(floor(sp))) * smoothstep(0.15, 0.6, h);
    col += star * vec3(0.7, 0.75, 1.0) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const rainVertex = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aEnd;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uSize;
  varying float vA;
  void main() {
    vec3 p;
    p.x = uCenter.x + mod(aSeed.x * uSize - uCenter.x, uSize) - uSize * 0.5;
    p.z = uCenter.z + mod(aSeed.z * uSize - uCenter.z, uSize) - uSize * 0.5;
    p.y = mod(aSeed.y * 28.0 - uTime * 24.0, 28.0) - 1.0;
    p.y += aEnd * 0.75;
    p.x += aEnd * 0.1;
    vA = mix(1.0, 0.0, aEnd);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const rainFragment = /* glsl */ `
  varying float vA;
  void main() {
    gl_FragColor = vec4(0.62, 0.72, 0.95, 0.05 + vA * 0.22);
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
