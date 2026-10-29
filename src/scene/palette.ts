/**
 * Pixel-art colours. Each trail region has its own palette; the scene blends
 * between them as the rider travels, so regions never swap abruptly.
 */

export type RGB = [number, number, number];

export function hex(value: string): RGB {
  const v = value.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function css(c: RGB, alpha = 1): string {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

export interface RegionPalette {
  skyTop: string;
  skyMid: string;
  skyLow: string;
  far: string;
  mid: string;
  midShade: string;
  ground: string;
  road: string;
  strata: [string, string, string];
}

/** In trail order: town outskirts, open desert, red-rock canyon, high frontier, journey's end. */
export const REGION_PALETTES: RegionPalette[] = [
  {
    skyTop: '#86c9c6', skyMid: '#c9e0c4', skyLow: '#f3e1b6',
    far: '#b7b39b', mid: '#b98d64', midShade: '#9c7350',
    ground: '#c6a06a', road: '#e2c690',
    strata: ['#a9814f', '#8d6840', '#6f5034'],
  },
  {
    skyTop: '#68b6c0', skyMid: '#a9d3c6', skyLow: '#f6d9a0',
    far: '#d5a97c', mid: '#c97c4c', midShade: '#a6603a',
    ground: '#e0b878', road: '#f1d7a3',
    strata: ['#c99a5e', '#a97a48', '#865c36'],
  },
  {
    skyTop: '#5b9bb2', skyMid: '#e4b78c', skyLow: '#f3b27e',
    far: '#c4846a', mid: '#a8472f', midShade: '#7f3424',
    ground: '#c9744a', road: '#e09a6a',
    strata: ['#a95a38', '#88452c', '#683322'],
  },
  {
    skyTop: '#4a3e70', skyMid: '#c4645a', skyLow: '#f1a85e',
    far: '#7c6584', mid: '#5c4b6b', midShade: '#46395a',
    ground: '#9c7d5c', road: '#c4a37a',
    strata: ['#7f6248', '#644c39', '#4a382c'],
  },
  {
    skyTop: '#121532', skyMid: '#262450', skyLow: '#553a63',
    far: '#3a3458', mid: '#2d2a49', midShade: '#221f3a',
    ground: '#5d4c4c', road: '#7d6a62',
    strata: ['#4a3b3c', '#3a2e33', '#2a2229'],
  },
];

/** Fixed colours for props and the rider (these get the evening tint applied). */
export const INK = {
  outline: '#2a1a14',
  wood: '#9a6a44',
  woodLight: '#b98a5c',
  woodDark: '#6e4a30',
  plank: '#83593a',
  cream: '#efdfb8',
  signInk: '#3a2414',
  cactus: '#5e8a52',
  cactusLight: '#7aa564',
  cactusDark: '#456b3f',
  rock: '#a8927a',
  rockLight: '#c4ae94',
  rockDark: '#7f6b58',
  bone: '#efe6d2',
  pine: '#3f5e4c',
  pineDark: '#2f4a3c',
  snow: '#f1ece4',
  rail: '#4a3a34',
  metal: '#6d6a6e',
  brass: '#d9a441',
  gold: '#f2c14e',
  // horse + rider
  coat: '#8e5232',
  coatLight: '#a8673f',
  coatDark: '#6a3a24',
  mane: '#3a2219',
  hoof: '#2a1a14',
  skin: '#e2a77c',
  shirt: '#4f9a94',
  shirtDark: '#3c7b77',
  vest: '#7a4a2e',
  pants: '#4a4a6a',
  boot: '#3b2418',
  hat: '#b07a46',
  hatDark: '#80552f',
  hatBand: '#b5442e',
  scarf: '#d0603c',
  hair: '#4a2a1c',
  saddle: '#5a3220',
  blanket: '#2f7c7a',
};

/** Glowing colours are drawn after the evening tint so they stay bright. */
export const GLOW = {
  window: '#ffd27a',
  windowWarm: '#ffb85a',
  lantern: '#ffe08a',
  firefly: '#e9ff9a',
  star: '#fff4d6',
  gem: '#7ff0e0',
  sparkle: '#fff2b0',
};

export const NIGHT_TINT = '#211c40';
