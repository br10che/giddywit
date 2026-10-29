import { hex, mix, REGION_PALETTES, type RGB } from './palette';

/** The trail. Progress p runs from 0 (start, 0 points) to 1 (maximum score). */

export interface Region {
  id: 'town' | 'desert' | 'canyon' | 'frontier' | 'end';
  name: string;
  start: number;
}

export const REGIONS: Region[] = [
  { id: 'town', name: 'Dustwater Outskirts', start: 0 },
  { id: 'desert', name: 'Sunbaked Flats', start: 0.18 },
  { id: 'canyon', name: 'Rustrock Canyon', start: 0.4 },
  { id: 'frontier', name: 'Highline Frontier', start: 0.62 },
  { id: 'end', name: 'Lantern Rest', start: 0.84 },
];

/** Ground-layer pixels for the whole trail, at 1 internal pixel per unit. */
export const TRAIL_PX = 2700;

export function regionIndexAt(p: number): number {
  let idx = 0;
  for (let i = 0; i < REGIONS.length; i++) if (p >= REGIONS[i].start) idx = i;
  return idx;
}

export function regionAt(p: number): Region {
  return REGIONS[regionIndexAt(p)];
}

/** Region centres, used as colour keyframes so colours blend continuously along the trail. */
const CENTRES = REGIONS.map((r, i) => (i === 0 ? 0.04 : (r.start + (REGIONS[i + 1]?.start ?? 1.04)) / 2));

const parsed = REGION_PALETTES.map((pal) => ({
  skyTop: hex(pal.skyTop),
  skyMid: hex(pal.skyMid),
  skyLow: hex(pal.skyLow),
  far: hex(pal.far),
  mid: hex(pal.mid),
  midShade: hex(pal.midShade),
  ground: hex(pal.ground),
  road: hex(pal.road),
  strata0: hex(pal.strata[0]),
  strata1: hex(pal.strata[1]),
  strata2: hex(pal.strata[2]),
}));

export type PaletteKey = keyof (typeof parsed)[number];

export function colourAt(key: PaletteKey, p: number): RGB {
  if (p <= CENTRES[0]) return parsed[0][key];
  for (let i = 0; i < CENTRES.length - 1; i++) {
    if (p <= CENTRES[i + 1]) {
      const t = (p - CENTRES[i]) / (CENTRES[i + 1] - CENTRES[i]);
      return mix(parsed[i][key], parsed[i + 1][key], smooth(t));
    }
  }
  return parsed[parsed.length - 1][key];
}

export function smooth(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export function smoothstep(a: number, b: number, x: number): number {
  return smooth((x - a) / (b - a));
}

/** How much evening has fallen (0 = day, ~0.55 = night). Props are tinted by this. */
export function eveningAt(p: number): number {
  return smoothstep(0.64, 1, p) * 0.55;
}

/** Integer hash → [0,1). Deterministic so the world looks the same every visit. */
export function hash01(n: number, salt = 0): number {
  let h = (Math.imul(n | 0, 374761393) + Math.imul(salt | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1-D value noise in [0,1]. */
export function noise1(x: number, salt = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  return hash01(i, salt) + (hash01(i + 1, salt) - hash01(i, salt)) * smooth(f);
}

/** Small seeded generator for per-tile decisions. */
export function tileRandom(index: number, salt: number): () => number {
  let n = 0;
  return () => hash01(index * 31 + n++, salt);
}

/** Which two region palettes/profiles to blend at progress p, and how far between them. */
export function regionBlend(p: number): { a: number; b: number; t: number } {
  if (p <= CENTRES[0]) return { a: 0, b: 0, t: 0 };
  for (let i = 0; i < CENTRES.length - 1; i++) {
    if (p <= CENTRES[i + 1]) return { a: i, b: i + 1, t: smooth((p - CENTRES[i]) / (CENTRES[i + 1] - CENTRES[i])) };
  }
  const last = CENTRES.length - 1;
  return { a: last, b: last, t: 0 };
}
