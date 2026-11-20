/** Shared between the in-canvas probe and the DOM overlay (no React state per frame). */
export const perf: { el: HTMLElement | null; refresh: number } = { el: null, refresh: 60 };

/**
 * Estimate the display refresh rate from requestAnimationFrame intervals.
 * Clamped to 50–240 Hz; a throttled or hidden page falls back to 60.
 */
export function measureRefresh(samples = 40): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || document.hidden) return resolve(60);
    const dts: number[] = [];
    let last = 0;
    const tick = (t: number) => {
      if (last) dts.push(t - last);
      last = t;
      if (dts.length < samples) requestAnimationFrame(tick);
      else {
        dts.sort((a, b) => a - b);
        const hz = 1000 / dts[Math.floor(dts.length / 2)];
        resolve(hz >= 50 && hz <= 240 ? Math.round(hz) : 60);
      }
    };
    requestAnimationFrame(tick);
    // Never wait on a throttled tab.
    setTimeout(() => resolve(60), 1500);
  });
}
