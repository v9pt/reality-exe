import { Terrain } from "@/lib/motion";
import { CITY_RANGE, generateBuildings, obstacleGrid } from "@/lib/world-map";
import type { Quality } from "@/store/game";

const cache = new Map<Quality, Terrain>();

/** One terrain per quality tier, shared by the player and the camera so both collide with what is drawn. */
export function terrainFor(q: Quality) {
  let t = cache.get(q);
  if (!t) {
    const buildings = generateBuildings(CITY_RANGE[q]);
    t = new Terrain(obstacleGrid(buildings), buildings);
    cache.set(q, t);
  }
  return t;
}
