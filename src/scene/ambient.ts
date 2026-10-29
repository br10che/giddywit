import { GLOW, INK } from './palette';
import { ARCH_OFFSET, type Frame } from './draw';

/** Small living details: birds, a circling vulture, tumbleweeds, a passing train, bats, fireflies, dust. */

type Kind = 'bird' | 'vulture' | 'tumbleweed' | 'train' | 'bat' | 'firefly' | 'sparkle' | 'dust' | 'smoke';

interface Thing {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Parallax factor: how much it shifts when the camera moves. */
  factor: number;
  seed: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambient {
  private things: Thing[] = [];
  private timers: Record<string, number> = { bird: 1.5, tumbleweed: 2.5, bat: 1, train: 3, firefly: 0, sparkle: 0 };

  reset(): void {
    this.things = [];
  }

  update(dt: number, f: Frame, camDelta: number, galloping: boolean): void {
    const { L, p } = f;
    const horizon = L.roadY - 7;

    for (const t of this.things) {
      t.x += t.vx * dt - camDelta * t.factor;
      t.y += t.vy * dt;
      t.age += dt;
    }
    this.things = this.things.filter((t) => t.age < t.life && t.x > -80 && t.x < L.W + 80);

    const count = (k: Kind) => this.things.reduce((n, t) => n + (t.kind === k ? 1 : 0), 0);
    const tick = (k: string, min: number, max: number) => {
      this.timers[k] -= dt;
      if (this.timers[k] > 0) return false;
      this.timers[k] = rand(min, max);
      return true;
    };
    const add = (t: Omit<Thing, 'age' | 'seed'>) => this.things.push({ ...t, age: 0, seed: Math.random() * 100 });

    if (p < 0.72 && tick('bird', 6, 11)) {
      const n = 2 + Math.floor(Math.random() * 3);
      const y = horizon * rand(0.15, 0.5);
      const vx = -rand(9, 15);
      for (let i = 0; i < n; i++) add({ kind: 'bird', x: L.W + 4 + i * 6, y: y + (i % 2) * 3, vx, vy: 0, life: 60, factor: 0.1 });
    }
    if (p > 0.16 && p < 0.64 && count('vulture') === 0) {
      add({ kind: 'vulture', x: L.W * rand(0.55, 0.9), y: horizon * rand(0.22, 0.4), vx: 0, vy: 0, life: 40, factor: 0.22 });
    }
    if (p > 0.2 && p < 0.6 && tick('tumbleweed', 5, 10)) {
      add({ kind: 'tumbleweed', x: L.W + 6, y: L.roadY - 3, vx: -rand(20, 30), vy: 0, life: 30, factor: 1 });
    }
    if (p > 0.63 && p < 0.83 && count('train') === 0 && tick('train', 3, 9)) {
      add({ kind: 'train', x: L.W + 10, y: L.roadY - 11, vx: -rand(12, 16), vy: 0, life: 60, factor: 0.5 });
    }
    for (const train of this.things.filter((t) => t.kind === 'train')) {
      if (Math.random() < dt * 5) add({ kind: 'smoke', x: train.x + 3, y: train.y - 9, vx: rand(2, 6), vy: -rand(4, 7), life: 1.6, factor: 0.5 });
    }
    if (p > 0.8 && tick('bat', 2, 4.5)) {
      const fromLeft = Math.random() < 0.5;
      add({ kind: 'bat', x: fromLeft ? -4 : L.W + 4, y: horizon * rand(0.25, 0.7), vx: fromLeft ? rand(14, 20) : -rand(14, 20), vy: 0, life: 30, factor: 0.3 });
    }
    if (p > 0.85 && count('firefly') < 12 && tick('firefly', 0.3, 0.8)) {
      add({ kind: 'firefly', x: rand(0, L.W), y: L.roadY - rand(3, 18), vx: rand(-2, 2), vy: rand(-1, 1), life: rand(5, 9), factor: 0.8 });
    }
    if (p > 0.995 && tick('sparkle', 0.15, 0.4)) {
      const ax = L.riderX + ARCH_OFFSET;
      add({ kind: 'sparkle', x: ax + rand(-30, 30), y: L.roadY - rand(8, 34), vx: 0, vy: -2, life: 0.8, factor: 1 });
    }
    if (galloping) {
      for (let i = 0; i < 2; i++) {
        add({ kind: 'dust', x: L.riderX - 6 + rand(-2, 6), y: L.roadY + rand(-1, 1), vx: -rand(4, 14), vy: -rand(5, 12), life: rand(0.35, 0.6), factor: 1 });
      }
    }
  }

  /** Creatures in the sky, drawn behind the mountains' foreground layers. */
  drawSky(f: Frame): void {
    const { P } = f;
    for (const t of this.things) {
      const flap = Math.sin(t.age * 9 + t.seed) > 0;
      if (t.kind === 'bird') {
        P.rect(t.x - 1, t.y + (flap ? -1 : 1), 1, 1, '#4a3a44');
        P.rect(t.x, t.y, 1, 1, '#4a3a44');
        P.rect(t.x + 1, t.y + (flap ? -1 : 1), 1, 1, '#4a3a44');
      } else if (t.kind === 'vulture') {
        const a = t.age * 0.7 + t.seed;
        const x = t.x + Math.cos(a) * 10;
        const y = t.y + Math.sin(a) * 4;
        const up = Math.sin(t.age * 3) > 0.6;
        P.rect(x - 3, y + (up ? -1 : 0), 3, 1, '#3a2a2e');
        P.rect(x + 1, y + (up ? -1 : 0), 3, 1, '#3a2a2e');
        P.rect(x, y, 1, 1, '#3a2a2e');
      } else if (t.kind === 'bat') {
        const y = t.y + Math.sin(t.age * 7 + t.seed) * 2;
        P.raw(t.x, y, 1, 1, '#141024');
        P.raw(t.x - 1, y + (flap ? -1 : 0), 1, 1, '#141024');
        P.raw(t.x + 1, y + (flap ? -1 : 0), 1, 1, '#141024');
      }
    }
  }

  /** The frontier train runs on the railway in the near-back layer. */
  drawTrain(f: Frame): void {
    const { P } = f;
    for (const t of this.things) {
      if (t.kind === 'smoke') {
        const a = Math.max(0, 1 - t.age / t.life) * 0.7;
        P.raw(t.x, t.y, 2 + Math.floor(t.age * 2), 2, `rgba(220,214,220,${a.toFixed(2)})`);
      }
      if (t.kind !== 'train') continue;
      const x = Math.round(t.x);
      const y = Math.round(t.y);
      // locomotive (heading left)
      P.rect(x, y - 4, 12, 5, '#3a3240');
      P.rect(x + 8, y - 8, 5, 9, '#3a3240');
      P.rect(x + 2, y - 7, 2, 3, '#3a3240');
      P.rect(x - 1, y, 3, 1, INK.brass);
      P.raw(x + 9, y - 7, 2, 2, GLOW.window);
      // carriages
      for (let c = 0; c < 2; c++) {
        const cx = x + 15 + c * 14;
        P.rect(cx, y - 6, 12, 7, c === 0 ? '#7a3a2e' : '#5b4a6a');
        P.rect(cx, y - 7, 12, 1, '#2e2632');
        P.raw(cx + 2, y - 4, 2, 2, GLOW.window);
        P.raw(cx + 7, y - 4, 2, 2, GLOW.window);
      }
      const spin = Math.floor(t.age * 10) % 2;
      for (let wx = x + 1; wx < x + 42; wx += 4) P.rect(wx, y + 1, 2, 1, spin ? '#1e1820' : '#4a4048');
    }
  }

  /** Tumbleweeds and hoof dust on the road (behind the rider). */
  drawGround(f: Frame): void {
    const { P } = f;
    for (const t of this.things) {
      if (t.kind === 'tumbleweed') {
        const hop = Math.abs(Math.sin(t.age * 5)) * 4;
        const x = Math.round(t.x);
        const y = Math.round(t.y - hop);
        const frame = Math.floor(t.age * 8) % 2;
        const c = '#9c7a4a';
        P.rect(x - 2, y - 4, 5, 5, frame ? c : '#b08c58');
        P.rect(x - 3, y - 3, 7, 3, '#8a6a3e');
        P.rect(x - 1 + frame, y - 3, 1, 1, '#e3c89a');
        P.rect(x + 1 - frame, y - 1, 1, 1, '#e3c89a');
      } else if (t.kind === 'dust') {
        const a = Math.max(0, 1 - t.age / t.life) * 0.65;
        P.raw(t.x, t.y, 2, 2, `rgba(236,214,170,${a.toFixed(2)})`);
      }
    }
  }

  /** Fireflies and end-of-trail sparkles glow on top of everything. */
  drawGlow(f: Frame): void {
    const { P } = f;
    for (const t of this.things) {
      if (t.kind === 'firefly') {
        const on = Math.sin(t.age * 3 + t.seed) > 0.2;
        const fade = Math.min(1, t.age, t.life - t.age);
        if (on) {
          P.raw(t.x, t.y, 1, 1, GLOW.firefly);
          P.glow(t.x, t.y, 3, GLOW.firefly, 0.2 * fade);
        }
      } else if (t.kind === 'sparkle') {
        const a = Math.max(0, 1 - t.age / t.life);
        const big = t.age < t.life / 2;
        P.raw(t.x, t.y, 1, 1, `rgba(255,242,176,${a.toFixed(2)})`);
        if (big) {
          P.raw(t.x - 1, t.y, 3, 1, `rgba(255,242,176,${(a * 0.6).toFixed(2)})`);
          P.raw(t.x, t.y - 1, 1, 3, `rgba(255,242,176,${(a * 0.6).toFixed(2)})`);
        }
      }
    }
  }
}
