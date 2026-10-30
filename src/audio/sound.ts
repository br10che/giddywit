/**
 * Tiny synthesised sound effects. The only audio file is the expert-answer
 * "Yee-haw!" (public/sounds/yeehaw.wav). The AudioContext is only created
 * inside a user gesture, and nothing plays while sound is off.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on && ctx?.state === 'running') void ctx.suspend();
}

/** Call from a click/key handler before playing anything. */
export function unlockAudio(): void {
  if (!enabled) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    void loadYeehaw(); // ready well before the first expert question
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, length: number, type: OscillatorType, volume: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

function clop(start: number, pitch: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitch, start);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, start + 0.05);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.1);
}

const ready = () => enabled && ctx && ctx.state !== 'closed';

export function playClick(): void {
  if (!ready()) return;
  tone(660, ctx!.currentTime, 0.05, 'square', 0.03);
}

/** A bright little twang, then hoofbeats for the length of the ride. */
export function playCorrect(rideMs: number, delayMs: number): void {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.22, 'square', 0.05));
  const start = t + delayMs / 1000;
  const beats = Math.floor(rideMs / 160);
  for (let i = 0; i < beats; i++) clop(start + i * 0.16, i % 2 ? 320 : 380);
}

const YEEHAW_URL = `${import.meta.env.BASE_URL}sounds/yeehaw.wav`;
const YEEHAW_VOLUME = 0.45;
let yeehaw: Promise<AudioBuffer | null> | null = null;

/** Fetches and decodes the yee-haw clip once; later calls reuse it. */
function loadYeehaw(): Promise<AudioBuffer | null> {
  if (!yeehaw && ctx) {
    const c = ctx;
    yeehaw = fetch(YEEHAW_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        yeehaw = null; // try again next time
        return null;
      });
  }
  return yeehaw ?? Promise.resolve(null);
}

/** The rider shouts "Yee-haw!" (a real recording), kept soft so it never startles. */
export function playYeehaw(): void {
  if (!ready()) return;
  void loadYeehaw().then((buffer) => {
    if (!buffer || !ready()) return;
    const src = ctx!.createBufferSource();
    const gain = ctx!.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(YEEHAW_VOLUME, ctx!.currentTime);
    src.connect(gain).connect(ctx!.destination);
    src.start();
  });
}

export function playWrong(): void {
  if (!ready()) return;
  const t = ctx!.currentTime;
  tone(330, t, 0.18, 'triangle', 0.07);
  tone(262, t + 0.14, 0.28, 'triangle', 0.06);
}

export function playFinish(): void {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.3, 'square', 0.045));
}
