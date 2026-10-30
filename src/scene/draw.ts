import { css, GLOW, hex, INK, mix, NIGHT_TINT, type RGB } from './palette';
import { drawPixelText, textWidth } from './pixelfont';
import {
  colourAt, eveningAt, hash01, noise1, regionAt, regionBlend, smoothstep, tileRandom, TRAIL_PX,
  type PaletteKey,
} from './world';

/** Everything is drawn in internal pixels; the canvas is scaled up with crisp edges. */
export interface Layout {
  W: number;
  H: number;
  /** y of the road surface (where hooves land). */
  roadY: number;
  /** x of the rider (centre of the horse). */
  riderX: number;
}

export interface RiderPose {
  /** Gallop cycle phase in radians. */
  phase: number;
  moving: boolean;
  /** Seconds since a correct answer (hat wave), or -1. */
  cheer: number;
  /** Seconds since a wrong answer (head shake + "?"), or -1. */
  oops: number;
  /** Seconds since a correct expert answer (horse rears up + "YEEHAW!"), or -1. */
  rear: number;
  /** Free-running clock for idle details. */
  clock: number;
  still: boolean;
}

const NIGHT = hex(NIGHT_TINT);

export class Painter {
  evening = 0;
  private tints = new Map<string, string>();
  private regionCache = new Map<string, string>();

  constructor(public ctx: CanvasRenderingContext2D) {}

  setEvening(value: number): void {
    const v = Math.round(value * 60) / 60;
    if (v !== this.evening) {
      this.evening = v;
      this.tints.clear();
    }
  }

  /** A prop colour with the current evening tint applied. */
  t(color: string): string {
    let v = this.tints.get(color);
    if (!v) {
      v = css(mix(hex(color), NIGHT, this.evening));
      this.tints.set(color, v);
    }
    return v;
  }

  /** A region colour at progress p (already evening-appropriate), cached. */
  reg(key: PaletteKey, p: number, darken = 0): string {
    const q = Math.round(p * 300);
    const id = `${key}|${q}|${darken}`;
    let v = this.regionCache.get(id);
    if (!v) {
      v = css(mix(colourAt(key, q / 300), [20, 14, 26], darken));
      if (this.regionCache.size > 4000) this.regionCache.clear();
      this.regionCache.set(id, v);
    }
    return v;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = this.t(color);
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  raw(x: number, y: number, w: number, h: number, cssColor: string): void {
    this.ctx.fillStyle = cssColor;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, width = 1): void {
    this.ctx.fillStyle = this.t(color);
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 400; guard++) {
      this.ctx.fillRect(ax, ay, width, 1);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ax += sx; }
      if (e2 <= dx) { err += dx; ay += sy; }
    }
  }

  disc(cx: number, cy: number, r: number, cssColor: string): void {
    this.ctx.fillStyle = cssColor;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  }

  glow(cx: number, cy: number, r: number, color: string, strength = 0.22): void {
    const rgb = hex(color);
    for (let i = 3; i >= 1; i--) this.disc(cx, cy, Math.round((r * i) / 3), css(rgb, strength * (1.2 - i * 0.3)));
  }
}

export interface Frame {
  P: Painter;
  L: Layout;
  /** Camera position in ground pixels (0 … TRAIL_PX). */
  cam: number;
  p: number;
  time: number;
  still: boolean;
}

const horizonOf = (L: Layout) => L.roadY - 7;

/* ───────────────────────────── sky ───────────────────────────── */

export function skyColourAt(f: Frame, y: number): RGB {
  const t = Math.max(0, Math.min(1, y / Math.max(1, horizonOf(f.L))));
  const top = colourAt('skyTop', f.p);
  const midC = colourAt('skyMid', f.p);
  const low = colourAt('skyLow', f.p);
  return t < 0.55 ? mix(top, midC, t / 0.55) : mix(midC, low, (t - 0.55) / 0.45);
}

export function drawSky(f: Frame): void {
  const { P, L } = f;
  const horizon = horizonOf(L);
  const bands = 12;
  const bandH = Math.ceil(horizon / bands) + 1;
  for (let i = 0; i < bands; i++) {
    P.raw(0, i * bandH, L.W, bandH, css(skyColourAt(f, i * bandH + bandH / 2)));
  }
  P.raw(0, bands * bandH, L.W, Math.max(0, L.roadY - bands * bandH), css(skyColourAt(f, horizon)));

  // stars
  const starAlpha = smoothstep(0.76, 0.95, f.p);
  if (starAlpha > 0) {
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash01(i, 11) * L.W);
      const y = Math.floor(hash01(i, 12) * horizon * 0.85);
      const tw = f.still ? 1 : 0.55 + 0.45 * Math.sin(f.time * (1.5 + hash01(i, 13) * 2) + i);
      P.raw(x, y, 1, 1, css(hex(GLOW.star), starAlpha * tw * (0.5 + hash01(i, 14) * 0.5)));
    }
  }

  // sun sinks towards the horizon as the day goes on
  const sunGone = smoothstep(0.8, 0.88, f.p);
  if (sunGone < 1) {
    const sx = Math.round(L.W * 0.8);
    const sy = Math.round(horizon * 0.2 + (horizon * 0.95 - horizon * 0.2) * smoothstep(0.08, 0.86, f.p));
    const sunC = mix(hex('#fff2c4'), hex('#ff8f4a'), smoothstep(0.45, 0.82, f.p));
    P.disc(sx, sy, 10, css(sunC, 0.18 * (1 - sunGone)));
    P.disc(sx, sy, 8, css(sunC, 0.25 * (1 - sunGone)));
    P.disc(sx, sy, 6, css(sunC, 1 - sunGone));
  }

  // moon rises at journey's end
  const moon = smoothstep(0.8, 0.92, f.p);
  if (moon > 0) {
    const mx = Math.round(L.W * 0.66);
    const my = Math.round(horizon * (0.62 - 0.38 * smoothstep(0.8, 1, f.p)));
    P.disc(mx, my, 8, css(hex('#f4ecd0'), 0.08 * moon));
    P.disc(mx, my, 5, css(hex('#f4ecd0'), moon));
    P.disc(mx + 2, my - 1, 4, css(skyColourAt(f, my)));
  }

  // drifting clouds, fading out after sunset
  const cloudA = 1 - smoothstep(0.82, 0.96, f.p);
  if (cloudA > 0) {
    const span = L.W + 120;
    for (let i = 0; i < 6; i++) {
      const base = i * 97 + hash01(i, 21) * 60;
      const drift = f.still ? 0 : f.time * (1.2 + hash01(i, 22));
      const x = ((((base - f.cam * 0.05 - drift) % span) + span) % span) - 60;
      const y = Math.round(horizon * (0.1 + hash01(i, 23) * 0.38));
      const w = 16 + Math.floor(hash01(i, 24) * 18);
      const pink = smoothstep(0.55, 0.78, f.p) * (1 - smoothstep(0.85, 0.95, f.p));
      const c = mix(mix(hex('#fff8ea'), hex('#f2a48e'), pink), skyColourAt(f, y), 0.25);
      const shade = mix(c, skyColourAt(f, y + 4), 0.45);
      P.raw(x, y, w, 3, css(c, cloudA));
      P.raw(x + 3, y - 2, Math.floor(w * 0.45), 2, css(c, cloudA));
      P.raw(x + Math.floor(w * 0.5), y - 3, Math.floor(w * 0.3), 3, css(c, cloudA));
      P.raw(x + 2, y + 3, w - 4, 1, css(shade, cloudA));
    }
  }
}

/* ─────────────────────────── ridgelines ─────────────────────────── */

const q = (v: number, step: number) => Math.floor(v / step) * step;

type Profile = (wx: number) => number;

const FAR_PROFILES: Profile[] = [
  (x) => 6 + 9 * noise1(x / 40, 1) + 3 * noise1(x / 13, 2),
  (x) => 4 + q(Math.max(0, noise1(x / 46, 3) - 0.3) * 40, 3) + 2 * noise1(x / 9, 4),
  (x) => 8 + q(Math.pow(noise1(x / 30, 5), 1.4) * 38, 4),
  (x) => { const n = noise1(x / 26, 6); return 12 + 44 * n * n + 5 * noise1(x / 7, 7); },
  (x) => 8 + 12 * noise1(x / 44, 8),
];

const MID_PROFILES: Profile[] = [
  (x) => 3 + 5 * noise1(x / 34, 31),
  (x) => { const n = noise1(x / 38, 32); return n > 0.58 ? q(9 + (n - 0.58) * 70, 3) : 1 + 2 * noise1(x / 11, 33); },
  (x) => q(16 + 26 * noise1(x / 28, 34), 4),
  (x) => 9 + 14 * noise1(x / 33, 35),
  (x) => 4 + 6 * noise1(x / 40, 36),
];

function blendedHeight(profiles: Profile[], wx: number, p: number): number {
  const { a, b, t } = regionBlend(p);
  const ha = profiles[a](wx);
  return t <= 0 || a === b ? ha : ha + (profiles[b](wx) - ha) * t;
}

/** Distant mountains: slow parallax, hazy colours, snow on the high frontier peaks. */
export function drawFar(f: Frame): void {
  const { P, L } = f;
  const base = horizonOf(L) + 1;
  const k = Math.max(0.45, Math.min(1.35, base / 105));
  const factor = 0.07;
  for (let x = 0; x < L.W; x++) {
    const wx = x + f.cam * factor - L.riderX;
    const pc = clamp01(f.p + ((x - L.riderX) / L.W) * 0.14);
    const h = Math.round(blendedHeight(FAR_PROFILES, wx, pc) * k);
    const top = base - h;
    const haze = mix(colourAt('far', pc), colourAt('skyLow', f.p), 0.28);
    P.raw(x, top, 1, h, css(haze));
    const snowy = smoothstep(0.62, 0.7, pc) * (1 - smoothstep(0.82, 0.88, pc));
    if (snowy > 0.3 && h > 38 * k) P.raw(x, top, 1, Math.min(3, h - 38 * k + 1), P.t(INK.snow));
  }
}

/** Mesas, canyon cliffs and forested ridges. */
export function drawMid(f: Frame): void {
  const { P, L } = f;
  const base = horizonOf(L) + 2;
  const k = Math.max(0.5, Math.min(1.3, base / 105));
  const factor = 0.22;
  let prevH = 0;
  for (let x = -2; x < L.W; x++) {
    const wx = x + f.cam * factor - L.riderX;
    const pc = clamp01(f.p + ((x - L.riderX) / L.W) * 0.1);
    const h = Math.round(blendedHeight(MID_PROFILES, wx, pc) * k);
    if (x < 0) { prevH = h; continue; }
    const top = base - h;
    const shadow = h - prevH >= 2;
    P.raw(x, top, 1, h, shadow ? P.reg('midShade', pc) : P.reg('mid', pc));
    // rock strata stripes in desert + canyon
    const striped = smoothstep(0.16, 0.24, pc) * (1 - smoothstep(0.58, 0.66, pc));
    if (striped > 0.5 && h > 6) {
      for (let y = top + 3; y < base - 1; y += 5) P.raw(x, y, 1, 1, P.reg('midShade', pc));
    }
    // pine tips along frontier ridges
    const pines = smoothstep(0.6, 0.66, pc) * (1 - smoothstep(0.86, 0.9, pc));
    if (pines > 0.5) {
      const tip = Math.floor(Math.abs(wx)) % 5;
      const tall = 2 + Math.floor(hash01(Math.floor(wx / 5), 37) * 4);
      const hgt = tip === 2 ? tall : tip === 1 || tip === 3 ? Math.max(1, tall - 2) : 0;
      if (hgt) P.raw(x, top - hgt, 1, hgt, P.reg('midShade', pc));
    }
    prevH = h;
  }
}

/* ───────────────────────────── ground ───────────────────────────── */

export function drawGround(f: Frame): void {
  const { P, L } = f;
  const horizon = horizonOf(L);
  for (let x = 0; x < L.W; x++) {
    const wx = Math.floor(x + f.cam - L.riderX);
    const pc = clamp01(wx / TRAIL_PX);
    const ground = P.reg('ground', pc);
    P.raw(x, horizon, 1, L.roadY - 2 - horizon, ground);
    // road with ruts and pebbles
    P.raw(x, L.roadY - 2, 1, 6, P.reg('road', pc));
    if (hash01(wx, 41) < 0.5) P.raw(x, L.roadY + 1, 1, 1, P.reg('road', pc, 0.12));
    if (hash01(wx, 42) < 0.1) P.raw(x, L.roadY - 1 + Math.floor(hash01(wx, 43) * 4), 1, 1, P.reg('ground', pc, 0.2));
    P.raw(x, L.roadY + 4, 1, 5, ground);
    if (hash01(wx, 44) < 0.15) P.raw(x, L.roadY + 4 + Math.floor(hash01(wx, 45) * 5), 1, 1, P.reg('ground', pc, 0.15));
    // strata under the trail, deepening into darkness
    const y1 = L.roadY + 9;
    const y2 = y1 + 4 + Math.round(3 * noise1(wx / 18, 46));
    const y3 = y2 + 8 + Math.round(4 * noise1(wx / 25, 47));
    P.raw(x, y1, 1, y2 - y1, P.reg('strata0', pc));
    P.raw(x, y2, 1, y3 - y2, P.reg('strata1', pc));
    let y = y3;
    let depth = 0;
    while (y < L.H) {
      const band = 9 + Math.round(4 * noise1(wx / 30, 48 + depth));
      P.raw(x, y, 1, band, P.reg('strata2', pc, Math.min(0.7, depth * 0.12)));
      y += band;
      depth++;
    }
  }
}

/* ───────────────────────────── props ───────────────────────────── */


const SIGNS = ['SALOON', 'HOTEL', 'BANK', 'STORE', 'INN', 'BARBER', 'TAILOR'];

/** Sign for the building on a given tile: steps through SIGNS so neighbouring buildings never share one. */
function signFor(worldX: number, tile: number): string {
  const n = SIGNS.length;
  return SIGNS[(((Math.floor(worldX / tile) * 3) % n) + n) % n];
}

function storefront(P: Painter, x: number, base: number, r: () => number, f: Frame, lit: boolean, sign: string): void {
  r(); // keeps the remaining building details the same as before
  const w = Math.max(20, textWidth(sign) + 8);
  const h = 16 + Math.floor(r() * 8);
  const left = Math.round(x - w / 2);
  const woods = [INK.wood, INK.woodLight, '#8a5f45', '#a77a52'];
  const body = woods[Math.floor(r() * woods.length)];
  P.rect(left, base - h, w, h, body);
  for (let y = base - h + 2; y < base; y += 3) P.rect(left, y, w, 1, INK.plank);
  // false front with stepped top
  P.rect(left - 1, base - h - 4, w + 2, 4, body);
  P.rect(left + 3, base - h - 6, w - 6, 2, body);
  P.rect(left - 1, base - h - 4, w + 2, 1, INK.woodDark);
  P.rect(left + 3, base - h - 6, w - 6, 1, INK.woodDark);
  // sign board
  const tw = textWidth(sign);
  P.rect(left + Math.floor((w - tw) / 2) - 2, base - h - 2, tw + 4, 7, INK.cream);
  drawPixelText(P.ctx, sign, left + Math.floor((w - tw) / 2), base - h - 1, P.t(INK.signInk));
  // windows + door
  const glowOn = lit || f.p > 0.7;
  const winC = glowOn ? GLOW.window : '#3e2c22';
  const wy = base - h + 8;
  const door = left + Math.floor(w / 2) - 2;
  for (const wxp of [left + 3, left + w - 7]) {
    if (glowOn) P.raw(wxp, wy, 4, 4, winC);
    else P.rect(wxp, wy, 4, 4, winC);
    P.rect(wxp, wy + 2, 4, 1, INK.woodDark);
  }
  P.rect(door, base - 8, 4, 8, '#3a2618');
  if (glowOn) P.raw(door + 1, base - 7, 2, 6, GLOW.windowWarm);
  // porch roof + posts
  P.rect(left - 2, base - 11, w + 4, 2, INK.woodDark);
  P.rect(left - 1, base - 9, 1, 9, INK.woodDark);
  P.rect(left + w, base - 9, 1, 9, INK.woodDark);
  if (glowOn && f.p > 0.8) {
    for (const wxp of [left + 5, left + w - 5]) P.glow(wxp, wy + 2, 6, GLOW.window, 0.18);
  }
}

function waterTower(P: Painter, x: number, base: number): void {
  const left = Math.round(x - 7);
  P.line(left + 1, base, left + 3, base - 14, INK.woodDark);
  P.line(left + 13, base, left + 11, base - 14, INK.woodDark);
  P.line(left + 3, base - 4, left + 11, base - 10, INK.woodDark);
  P.line(left + 11, base - 4, left + 3, base - 10, INK.woodDark);
  P.rect(left + 1, base - 24, 13, 10, INK.wood);
  for (let y = base - 22; y < base - 14; y += 3) P.rect(left + 1, y, 13, 1, INK.woodDark);
  P.rect(left + 4, base - 24, 1, 10, INK.woodLight);
  P.rect(left, base - 26, 15, 2, INK.woodDark);
  P.rect(left + 2, base - 28, 11, 2, INK.woodDark);
  P.rect(left + 5, base - 30, 5, 2, INK.woodDark);
}

function saguaro(P: Painter, x: number, base: number, r: () => number, scale = 1): void {
  const h = Math.round((12 + r() * 12) * scale);
  const left = Math.round(x - 1);
  const w = scale > 1 ? 4 : 3;
  P.rect(left, base - h, w, h, INK.cactus);
  P.rect(left + 1, base - h, 1, h, INK.cactusLight);
  P.rect(left + w - 1, base - h + 1, 1, h - 1, INK.cactusDark);
  P.rect(left, base - h, w, 1, INK.cactusLight);
  const armL = Math.round(h * (0.35 + r() * 0.2));
  P.rect(left - 3, base - armL, 3, 2, INK.cactus);
  P.rect(left - 3, base - armL - Math.round(h * 0.3), 2, Math.round(h * 0.3), INK.cactus);
  P.rect(left - 3, base - armL - Math.round(h * 0.3), 1, Math.round(h * 0.3), INK.cactusLight);
  if (r() > 0.35) {
    const armR = Math.round(h * (0.45 + r() * 0.2));
    P.rect(left + w, base - armR, 3, 2, INK.cactusDark);
    P.rect(left + w + 1, base - armR - Math.round(h * 0.25), 2, Math.round(h * 0.25), INK.cactus);
  }
}

function pricklyPear(P: Painter, x: number, base: number): void {
  P.rect(x - 2, base - 4, 4, 4, INK.cactus);
  P.rect(x - 4, base - 7, 3, 4, INK.cactusDark);
  P.rect(x + 1, base - 8, 3, 4, INK.cactus);
  P.rect(x + 2, base - 9, 1, 1, '#d8607a');
  P.rect(x - 3, base - 8, 1, 1, '#e8b34a');
}

function rock(P: Painter, x: number, base: number, r: () => number, big = false): void {
  const w = Math.round((big ? 9 : 4) + r() * (big ? 6 : 3));
  const h = Math.round(w * 0.55);
  const left = Math.round(x - w / 2);
  P.rect(left + 1, base - h, w - 2, h, INK.rock);
  P.rect(left, base - h + 1, w, h - 1, INK.rock);
  P.rect(left + 1, base - h, Math.max(1, w - 4), 1, INK.rockLight);
  P.rect(left, base - 1, w, 1, INK.rockDark);
  P.rect(left + w - 2, base - h + 1, 1, h - 1, INK.rockDark);
}

function skull(P: Painter, x: number, base: number): void {
  P.rect(x - 1, base - 3, 3, 3, INK.bone);
  P.rect(x - 3, base - 4, 2, 1, INK.bone);
  P.rect(x + 2, base - 4, 2, 1, INK.bone);
  P.rect(x - 1, base - 2, 1, 1, '#5a4636');
  P.rect(x + 1, base - 2, 1, 1, '#5a4636');
}

function fence(P: Painter, x: number, base: number): void {
  const left = Math.round(x - 8);
  for (let i = 0; i < 3; i++) P.rect(left + i * 7, base - 7, 2, 7, INK.wood);
  P.rect(left, base - 6, 16, 1, INK.woodLight);
  P.rect(left, base - 3, 16, 1, INK.woodLight);
}

function barrel(P: Painter, x: number, base: number): void {
  P.rect(x - 2, base - 6, 5, 6, INK.wood);
  P.rect(x - 2, base - 5, 5, 1, INK.metal);
  P.rect(x - 2, base - 2, 5, 1, INK.metal);
  P.rect(x - 1, base - 6, 1, 6, INK.woodLight);
}

function hoodoo(P: Painter, x: number, base: number, r: () => number, f: Frame): void {
  const h = Math.round(22 + r() * 22);
  const w = Math.round(7 + r() * 7);
  const left = Math.round(x - w / 2);
  const pc = clamp01(f.p);
  for (let i = 0; i < h; i++) {
    const narrow = i < 4 ? 1 : 0;
    const wobble = Math.round(1.5 * Math.sin(i * 0.5 + x));
    P.raw(left + narrow + wobble, base - i - 1, w - narrow * 2, 1, P.reg('mid', pc, (i % 6 === 0 ? 0.12 : 0)));
    P.raw(left + narrow + wobble, base - i - 1, 2, 1, P.reg('midShade', pc));
  }
  P.raw(left - 1, base - h - 2, w + 2, 3, P.reg('mid', pc, 0.06));
}

function pine(P: Painter, x: number, base: number, r: () => number, scale = 1): void {
  const h = Math.round((12 + r() * 10) * scale);
  P.rect(x, base - 3, 1, 3, INK.woodDark);
  for (let i = 0; i < h; i++) {
    const half = Math.round(((h - i) / h) * 4 * scale) + (i % 4 === 0 ? 1 : 0);
    P.rect(x - half, base - 3 - i, half * 2 + 1, 1, i % 4 === 0 ? INK.pineDark : INK.pine);
  }
}

function stump(P: Painter, x: number, base: number): void {
  P.rect(x - 2, base - 3, 5, 3, INK.woodDark);
  P.rect(x - 2, base - 3, 5, 1, INK.woodLight);
}

function lanternPost(P: Painter, x: number, base: number, f: Frame): void {
  P.rect(x, base - 14, 1, 14, INK.woodDark);
  P.rect(x, base - 14, 4, 1, INK.woodDark);
  P.rect(x + 3, base - 13, 1, 1, INK.metal);
  P.raw(x + 2, base - 12, 3, 3, GLOW.lantern);
  if (f.p > 0.7) P.glow(x + 3, base - 11, 8, GLOW.lantern, 0.2);
}

function telegraph(P: Painter, x: number, top: number): void {
  P.rect(x, top, 1, 20, INK.woodDark);
  P.rect(x - 3, top + 2, 7, 1, INK.woodDark);
}

/* ───────────────────────── prop layers ───────────────────────── */

function forTiles(
  f: Frame,
  factor: number,
  tile: number,
  salt: number,
  draw: (sx: number, worldX: number, p: number, r: () => number) => void,
  jitter = 0.6,
): void {
  const { L } = f;
  const camL = f.cam * factor;
  const first = Math.floor((camL - L.riderX - 60) / tile);
  const last = Math.ceil((camL - L.riderX + L.W + 60) / tile);
  for (let i = first; i <= last; i++) {
    const r = tileRandom(i, salt);
    const worldX = i * tile + Math.floor(r() * tile * jitter);
    const sx = worldX - camL + L.riderX;
    const p = worldX / factor / TRAIL_PX;
    draw(sx, worldX, p, r);
  }
}

/** Buildings, big cacti, hoodoos, pines, the railway and the end-of-trail town. */
export function drawNearBack(f: Frame): void {
  const { P, L } = f;
  const base = L.roadY - 6;
  const factor = 0.5;

  // railway with telegraph poles across the high frontier
  const camL = f.cam * factor;
  for (let x = 0; x < L.W; x++) {
    const wx = x + camL - L.riderX;
    const pc = wx / factor / TRAIL_PX;
    if (pc < 0.61 || pc > 0.86) continue;
    P.raw(x, base - 3, 1, 3, P.reg('ground', clamp01(pc), 0.18));
    if (Math.floor(wx) % 3 === 0) P.rect(x, base - 4, 1, 1, INK.woodDark);
    P.rect(x, base - 5, 1, 1, INK.rail);
    const pole = ((Math.floor(wx) % 36) + 36) % 36;
    if (pole === 0) telegraph(P, x, base - 26);
    if (pole > 0) {
      const sag = Math.round(Math.sin((pole / 36) * Math.PI) * 3);
      P.rect(x, base - 23 + sag, 1, 1, INK.rail);
    }
  }

  forTiles(f, factor, 44, 101, (sx, worldX, p, r) => {
    const region = regionAt(p + (r() - 0.5) * 0.05).id;
    const roll = r();
    if (p < -0.06 || region === 'town') {
      if (p < 0.13) {
        if (roll < 0.14) waterTower(P, sx, base);
        else if (roll < 0.9) storefront(P, sx, base, r, f, false, signFor(worldX, 44));
      } else if (roll < 0.4) fence(P, sx, base);
    } else if (region === 'desert') {
      if (roll < 0.45) saguaro(P, sx, base, r, 1.5);
      else if (roll < 0.62) rock(P, sx, base, r, true);
    } else if (region === 'canyon') {
      if (roll < 0.55) hoodoo(P, sx, base, r, f);
      else if (roll < 0.75) rock(P, sx, base, r, true);
    } else if (region === 'frontier') {
      if (roll < 0.6) pine(P, sx, base - 2, r, 1.3);
      if (roll > 0.5 && roll < 0.7) pine(P, sx + 7, base - 1, r, 1);
    } else if (region === 'end') {
      if (p > 0.93 && p < 1.25) {
        if (roll < 0.78) storefront(P, sx, base, r, f, true, signFor(worldX, 44));
        else lanternPost(P, sx, base, f);
      } else if (roll < 0.45) pine(P, sx, base - 2, r, 1.1);
    }
  }, 0.25);
}

/** Small roadside props, progress signposts and the finish arch. */
export function drawRoadside(f: Frame): void {
  const { P, L } = f;
  const base = L.roadY - 2;

  forTiles(f, 1, 18, 202, (sx, worldX, p, r) => {
    if (nearMarker(worldX)) return;
    const region = regionAt(p + (r() - 0.5) * 0.04).id;
    const roll = r();
    if (p < 0 || region === 'town') {
      if (roll < 0.35) fence(P, sx, base);
      else if (roll < 0.5) barrel(P, sx, base);
    } else if (region === 'desert') {
      if (roll < 0.22) saguaro(P, sx, base, r, 0.75);
      else if (roll < 0.36) pricklyPear(P, sx, base);
      else if (roll < 0.5) rock(P, sx, base, r);
      else if (roll < 0.56) skull(P, sx, base);
    } else if (region === 'canyon') {
      if (roll < 0.3) rock(P, sx, base, r, roll < 0.12);
      else if (roll < 0.4) saguaro(P, sx, base, r, 0.6);
      else if (roll < 0.45) skull(P, sx, base);
    } else if (region === 'frontier') {
      if (roll < 0.15) stump(P, sx, base);
      else if (roll < 0.35) rock(P, sx, base, r);
      else if (roll < 0.47) pine(P, sx, base, r, 0.7);
    } else if (region === 'end') {
      if (p > 0.9 && roll < 0.22) lanternPost(P, sx, base, f);
      else if (roll < 0.42) fence(P, sx, base);
      else if (roll < 0.5) barrel(P, sx, base);
    }
  });

  // signposts every 10% of the trail
  for (let k = 1; k <= 9; k++) {
    const sx = markerX(k) - f.cam + L.riderX;
    if (sx < -20 || sx > L.W + 20) continue;
    const label = `${k * 10}%`;
    const tw = textWidth(label);
    P.rect(sx, base - 12, 2, 12, INK.woodDark);
    P.rect(sx - Math.floor(tw / 2) - 2, base - 13, tw + 5, 7, INK.wood);
    P.rect(sx - Math.floor(tw / 2) - 2, base - 7, tw + 5, 1, INK.woodDark);
    drawPixelText(P.ctx, label, sx - Math.floor(tw / 2) + 1, base - 12, P.t(INK.cream));
  }

  // trail's end arch
  const ax = TRAIL_PX + ARCH_OFFSET - f.cam + L.riderX;
  if (ax > -60 && ax < L.W + 60) {
    const label = "TRAIL'S END";
    const tw = textWidth(label);
    const half = Math.floor(tw / 2) + 5;
    P.rect(ax - half, base - 26, 2, 26, INK.woodDark);
    P.rect(ax + half - 1, base - 26, 2, 26, INK.woodDark);
    P.rect(ax - half - 2, base - 28, half * 2 + 4, 2, INK.woodDark);
    P.rect(ax - Math.floor(tw / 2) - 2, base - 26, tw + 4, 8, INK.cream);
    P.rect(ax - Math.floor(tw / 2) - 2, base - 19, tw + 4, 1, INK.woodDark);
    drawPixelText(P.ctx, label, ax - Math.floor(tw / 2), base - 25, P.t(INK.signInk));
    for (const lx of [ax - half - 3, ax + half + 2]) {
      P.raw(lx - 1, base - 25, 3, 3, GLOW.lantern);
      P.glow(lx, base - 24, 9, GLOW.lantern, 0.22);
    }
  }
}

/** The finish arch sits just ahead of the rider at 100%. */
export const ARCH_OFFSET = 46;

function markerX(k: number): number {
  return Math.round((k / 10) * TRAIL_PX) + 14;
}

function nearMarker(worldX: number): boolean {
  for (let k = 1; k <= 9; k++) if (Math.abs(worldX - markerX(k)) < 14) return true;
  return Math.abs(worldX - (TRAIL_PX + ARCH_OFFSET)) < 34;
}

/** Things buried under the trail — slightly mysterious, richer the further you ride. */
export function drawUnderground(f: Frame): void {
  const { P, L } = f;
  const top = L.roadY + 13;
  if (top >= L.H - 4) return;
  forTiles(f, 1, 24, 303, (sx, worldX, p, r) => {
    const y = Math.round(top + r() * Math.max(4, Math.min(L.H - top - 6, 60)));
    const roll = r();
    if (roll < 0.28) {
      P.rect(sx, y, 3, 2, INK.rockDark);
      P.rect(sx + 4, y + 1, 2, 2, INK.rockDark);
    } else if (roll < 0.33) {
      // old bone
      P.rect(sx, y, 7, 1, INK.bone);
      P.rect(sx - 1, y - 1, 2, 3, INK.bone);
      P.rect(sx + 6, y - 1, 2, 3, INK.bone);
    } else if (roll < 0.36) {
      // fossil spiral
      P.rect(sx, y, 5, 5, '#c9b393');
      P.rect(sx + 1, y + 1, 3, 3, '#a48d6d');
      P.rect(sx + 2, y + 2, 1, 1, '#c9b393');
    } else if (roll < 0.39) {
      // lost horseshoe
      P.rect(sx, y, 1, 4, INK.metal);
      P.rect(sx + 4, y, 1, 4, INK.metal);
      P.rect(sx, y + 4, 5, 1, INK.metal);
    } else if (roll < 0.39 + 0.03 + p * 0.12) {
      P.raw(sx, y, 2, 2, GLOW.window);
      P.raw(sx, y, 1, 1, GLOW.sparkle);
    } else if (p > 0.84 && roll < 0.62) {
      P.raw(sx, y, 2, 3, GLOW.gem);
      P.glow(sx + 1, y + 1, 4, GLOW.gem, 0.16);
    }
    void worldX;
  });

  // the buried strongbox at the end of the trail
  const cx = TRAIL_PX + ARCH_OFFSET - f.cam + L.riderX;
  const cy = Math.min(L.H - 12, top + 14);
  if (cx > -20 && cx < L.W + 20) {
    P.rect(cx - 6, cy, 12, 8, INK.woodDark);
    P.rect(cx - 6, cy, 12, 3, INK.wood);
    P.rect(cx - 6, cy + 3, 12, 1, INK.brass);
    P.raw(cx - 1, cy + 3, 2, 2, GLOW.lantern);
    if (f.p > 0.98) P.glow(cx, cy + 3, 10, GLOW.lantern, 0.2);
  }
}

/** Grass and pebbles in front of the road (fastest parallax). */
export function drawForeground(f: Frame): void {
  const { P, L } = f;
  forTiles(f, 1.3, 9, 404, (sx, _worldX, p, r) => {
    const y = L.roadY + 5 + Math.floor(r() * 3);
    const roll = r();
    const grass = mix(colourAt('ground', clamp01(p)), hex('#4f6a3a'), 0.55);
    if (p < 0.2 || (p > 0.6 && p < 0.86)) {
      if (roll < 0.5) {
        const c = css(mix(grass, NIGHT, P.evening));
        P.raw(sx, y - 2, 1, 2, c);
        P.raw(sx + 1, y - 3, 1, 3, c);
        P.raw(sx + 2, y - 1, 1, 1, c);
      }
    } else if (roll < 0.3) {
      P.raw(sx, y, 2, 1, P.reg('ground', clamp01(p), 0.3));
    }
  });
}

/* ───────────────────────────── rider ───────────────────────────── */

function leg(P: Painter, hipX: number, hipY: number, a1: number, bend: number, color: string): void {
  const kx = hipX + Math.sin(a1) * 4;
  const ky = hipY + Math.cos(a1) * 4;
  const a2 = a1 + bend;
  const fx = kx + Math.sin(a2) * 5;
  const fy = ky + Math.cos(a2) * 5;
  P.line(hipX, hipY, kx, ky, color, 2);
  P.line(kx, ky, fx, fy, color, 2);
  P.rect(fx, fy, 2, 1, INK.hoof);
}

export function drawRider(f: Frame, pose: RiderPose): void {
  const { P, L } = f;
  const x0 = L.riderX;
  const y0 = L.roadY + 1;
  const φ = pose.phase;
  const gallop = pose.moving;
  const bob = gallop ? Math.round(-Math.sin(φ * 2) * 0.9) : !pose.still && Math.sin(pose.clock * 2.2) > 0.75 ? -1 : 0;

  const shaking = pose.oops >= 0 && pose.oops < 0.7;
  const grazing = !gallop && !pose.still && pose.oops < 0 && pose.clock % 11 > 8.6;
  const hdx = shaking ? Math.round(Math.sin(pose.oops * 30)) : 0;
  const hdy = grazing ? 3 : 0;

  const rearing = pose.rear >= 0;
  const legAngles = (offset: number, front: boolean) => {
    if (rearing && front) return { a: 0.9 + 0.35 * Math.sin(pose.rear * 22 + offset), b: -1.6 };
    if (!gallop) return { a: front ? 0.05 : -0.05, b: 0 };
    const s = Math.sin(φ + offset);
    const c = Math.cos(φ + offset);
    return front
      ? { a: 0.6 * s, b: -Math.max(0, -c) * 1.2 }
      : { a: -0.6 * s, b: Math.max(0, c) * 1.0 };
  };
  const hipBack = { x: x0 - 6, y: y0 - 10 + bob };
  const hipFront = { x: x0 + 4, y: y0 - 10 + bob };

  // far-side legs
  let la = legAngles(0, false);
  leg(P, hipBack.x, hipBack.y, la.a, la.b, INK.coatDark);
  la = legAngles(2.4, true);
  leg(P, hipFront.x, hipFront.y, la.a, la.b, INK.coatDark);

  // tail
  const tailY = y0 - 15 + bob;
  if (gallop) {
    const w = Math.round(Math.sin(φ * 2));
    P.rect(x0 - 12, tailY, 3, 1, INK.mane);
    P.rect(x0 - 15, tailY + 1 + w, 4, 1, INK.mane);
    P.rect(x0 - 16, tailY + 2 + w, 2, 1, INK.mane);
  } else {
    const swish = !pose.still && pose.clock % 4.6 < 0.6 ? Math.round(Math.sin(pose.clock * 14)) : 0;
    P.rect(x0 - 10, tailY, 1, 2, INK.mane);
    P.rect(x0 - 11 + swish, tailY + 2, 1, 5, INK.mane);
    P.rect(x0 - 12 + swish, tailY + 5, 1, 3, INK.mane);
  }

  // body
  P.rect(x0 - 8, y0 - 15 + bob, 15, 6, INK.coat);
  P.rect(x0 - 7, y0 - 16 + bob, 13, 1, INK.coat);
  P.rect(x0 - 9, y0 - 14 + bob, 1, 4, INK.coat);
  P.rect(x0 - 6, y0 - 15 + bob, 9, 1, INK.coatLight);
  P.rect(x0 - 7, y0 - 9 + bob, 12, 1, INK.coatDark);
  P.rect(x0 + 7, y0 - 14 + bob, 2, 4, INK.coat);

  // neck rises forward, head angles down towards the muzzle
  for (let i = 0; i < 7; i++) {
    const dip = i >= 4 ? Math.min(hdy, i - 3) : 0;
    P.rect(x0 + 5 + Math.floor(i / 2), y0 - 15 - i + bob + dip, 4, 1, INK.coat);
    P.rect(x0 + 5 + Math.floor(i / 2), y0 - 15 - i + bob + dip, 1, 1, INK.mane);
  }
  const hx = x0 + 8 + hdx;
  const hy = y0 - 24 + bob + hdy;
  P.rect(hx, hy, 3, 1, INK.coat);
  P.rect(hx, hy + 1, 4, 1, INK.coat);
  P.rect(hx + 1, hy + 2, 5, 1, INK.coat);
  P.rect(hx + 2, hy + 3, 5, 1, INK.coat);
  P.rect(hx + 3, hy + 4, 4, 1, INK.coatDark);
  P.rect(hx + 6, hy + 3, 1, 1, INK.coatDark);
  P.rect(hx + 1, hy + 1, 1, 1, INK.coatLight);
  P.rect(hx + 2, hy + 1, 1, 1, INK.outline);
  P.rect(hx, hy - 2, 1, 2, INK.coatDark);
  P.rect(hx + 1, hy - 1, 1, 1, INK.coatDark);
  P.rect(hx - 1, hy, 1, 2, INK.mane);

  // blanket + saddle
  P.rect(x0 - 4, y0 - 16 + bob, 7, 4, INK.blanket);
  P.rect(x0 - 4, y0 - 13 + bob, 7, 1, INK.shirtDark);
  P.rect(x0 - 3, y0 - 17 + bob, 5, 1, INK.saddle);
  P.rect(x0 + 2, y0 - 18 + bob, 1, 2, INK.saddle);

  // near-side legs
  la = legAngles(0.6, false);
  leg(P, hipBack.x + 1, hipBack.y, la.a, la.b, INK.coat);
  la = legAngles(3.0, true);
  leg(P, hipFront.x + 1, hipFront.y, la.a, la.b, INK.coat);

  // rider
  const b = bob;
  const cheering = pose.cheer >= 0 && pose.cheer < 0.9;
  P.rect(x0 - 2, y0 - 18 + b, 4, 2, INK.pants);
  P.rect(x0 + 1, y0 - 16 + b, 2, 3, INK.pants);
  P.rect(x0 + 1, y0 - 13 + b, 3, 2, INK.boot);
  P.rect(x0 - 3, y0 - 24 + b, 2, 6, INK.vest);
  P.rect(x0 - 1, y0 - 24 + b, 2, 6, INK.shirt);
  P.rect(x0 - 3, y0 - 19 + b, 4, 1, INK.outline);
  // scarf, flapping in the wind while riding
  P.rect(x0 - 2, y0 - 24 + b, 4, 1, INK.scarf);
  if (gallop) {
    const w1 = Math.round(Math.sin(pose.clock * 18));
    P.rect(x0 - 3, y0 - 24 + b, 1, 1, INK.scarf);
    P.rect(x0 - 4, y0 - 24 + b + (w1 > 0 ? 0 : -1), 1, 1, INK.scarf);
    P.rect(x0 - 5, y0 - 24 + b + w1, 1, 1, INK.scarf);
  } else {
    P.rect(x0 - 3, y0 - 23 + b, 1, 2, INK.scarf);
  }
  // head + braid
  P.rect(x0 - 2, y0 - 28 + b, 4, 4, INK.skin);
  P.rect(x0 + 1, y0 - 27 + b, 1, 1, INK.outline);
  P.rect(x0 - 3, y0 - 28 + b, 1, 4, INK.hair);
  P.rect(x0 - 4, y0 - 25 + b, 1, 2, INK.hair);

  // arm, reins and hat (raised in a wave after a correct answer)
  const mouthX = hx + 5;
  const mouthY = hy + 4;
  if (cheering) {
    const wave = Math.round(Math.sin(pose.cheer * 16));
    P.rect(x0, y0 - 30 + b, 1, 7, INK.shirtDark);
    P.rect(x0 - 3 + wave, y0 - 35 + b, 7, 1, INK.hatDark);
    P.rect(x0 - 1 + wave, y0 - 38 + b, 3, 3, INK.hat);
    P.rect(x0 - 1 + wave, y0 - 36 + b, 3, 1, INK.hatBand);
    P.rect(x0 - 2, y0 - 29 + b, 4, 1, INK.hair);
    P.line(x0 + 2, y0 - 21 + b, mouthX, mouthY, INK.outline);
  } else {
    P.rect(x0, y0 - 23 + b, 1, 3, INK.shirtDark);
    P.rect(x0 + 1, y0 - 21 + b, 2, 1, INK.shirtDark);
    P.rect(x0 + 3, y0 - 21 + b, 1, 1, INK.skin);
    P.line(x0 + 4, y0 - 21 + b, mouthX, mouthY, INK.outline);
    P.rect(x0 - 4, y0 - 29 + b, 8, 1, INK.hatDark);
    P.rect(x0 - 2, y0 - 32 + b, 4, 3, INK.hat);
    P.rect(x0 - 2, y0 - 30 + b, 4, 1, INK.hatBand);
    P.rect(x0 - 1, y0 - 32 + b, 2, 1, INK.hatDark);
  }

  // gentle "?" after a wrong answer
  if (pose.oops >= 0 && pose.oops < 1.4) {
    const rise = Math.min(3, Math.floor(pose.oops * 6));
    const bx = x0 + 10;
    const by = y0 - 36 - rise + b;
    P.rect(bx - 1, by - 1, 7, 9, INK.outline);
    P.rect(bx, by, 5, 7, INK.cream);
    drawPixelText(P.ctx, '?', bx + 1, by + 1, P.t(INK.signInk));
  }
}

let riderCanvas: HTMLCanvasElement | null = null;
let maskCanvas: HTMLCanvasElement | null = null;
let riderPainter: Painter | null = null;
const RIDER_W = 64;
const RIDER_H = 64;
const RIDER_OX = 30;
const RIDER_OY = 52;

const REAR_PEAK = 0.6; // radians the horse tips back when rearing

/** How far the horse is reared up: rises fast, holds with a wobble, settles back down. */
function rearAngle(t: number): number {
  if (t < 0) return 0;
  if (t < 0.25) return REAR_PEAK * Math.sin((t / 0.25) * (Math.PI / 2));
  if (t < 0.8) return REAR_PEAK + 0.05 * Math.sin((t - 0.25) * 18);
  if (t < 1.1) return REAR_PEAK * (1 - (t - 0.8) / 0.3);
  return 0;
}

/** Draws the rider with a crisp dark outline so it reads against any scenery. */
export function drawRiderOutlined(f: Frame, pose: RiderPose): void {
  if (!riderCanvas) {
    riderCanvas = document.createElement('canvas');
    maskCanvas = document.createElement('canvas');
    riderCanvas.width = maskCanvas.width = RIDER_W;
    riderCanvas.height = maskCanvas.height = RIDER_H;
  }
  const rc = riderCanvas.getContext('2d');
  const mc = maskCanvas!.getContext('2d');
  if (!rc || !mc) {
    drawRider(f, pose);
    return;
  }
  if (!riderPainter) riderPainter = new Painter(rc);
  riderPainter.setEvening(f.P.evening);
  rc.clearRect(0, 0, RIDER_W, RIDER_H);
  drawRider({ ...f, P: riderPainter, L: { ...f.L, riderX: RIDER_OX, roadY: RIDER_OY - 1 } }, pose);

  mc.globalCompositeOperation = 'source-over';
  mc.clearRect(0, 0, RIDER_W, RIDER_H);
  mc.drawImage(riderCanvas, 0, 0);
  mc.globalCompositeOperation = 'source-in';
  mc.fillStyle = 'rgba(34,20,16,0.9)';
  mc.fillRect(0, 0, RIDER_W, RIDER_H);
  mc.globalCompositeOperation = 'source-over';

  const ctx = f.P.ctx;
  const ox = f.L.riderX - RIDER_OX;
  const oy = f.L.roadY + 1 - RIDER_OY;
  ctx.fillStyle = 'rgba(30,18,24,0.25)';
  ctx.fillRect(f.L.riderX - 10, f.L.roadY + 1, 22, 1);
  // rearing pivots the whole horse and rider on the hind hooves
  const angle = rearAngle(pose.rear);
  ctx.save();
  if (angle > 0) {
    const px = f.L.riderX - 6;
    const py = f.L.roadY + 1;
    ctx.translate(px, py);
    ctx.rotate(-angle);
    ctx.translate(-px, -py);
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(maskCanvas!, ox + dx, oy + dy);
  ctx.drawImage(riderCanvas, ox, oy);
  ctx.restore();
  if (pose.rear >= 0.1 && pose.rear < 1.1) yeehaw(f, pose.rear);
}

/** "YEEHAW!" speech bubble that pops up above the rearing horse. */
function yeehaw(f: Frame, t: number): void {
  const { P, L } = f;
  const text = 'YEEHAW!';
  const tw = textWidth(text);
  const rise = Math.min(4, Math.floor((t - 0.1) * 20));
  const bx = L.riderX + 6;
  const by = L.roadY - 44 - rise;
  P.rect(bx - 2, by - 2, tw + 4, 9, INK.outline);
  P.rect(bx - 1, by - 1, tw + 2, 7, INK.cream);
  P.rect(bx, by + 6, 2, 2, INK.outline);
  drawPixelText(P.ctx, text, bx, by, P.t(INK.signInk));
}

/** A light veil of sky colour over the background layers: atmospheric distance. */
export function drawHaze(f: Frame): void {
  f.P.raw(0, 0, f.L.W, f.L.roadY - 6, css(colourAt('skyLow', f.p), 0.16));
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export { eveningAt };
