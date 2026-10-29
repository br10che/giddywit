import { useEffect, useRef } from 'react';
import { MAX_SCORE, RIDE_DELAY_MS, rideDurationMs } from '../config';
import { Ambient } from './ambient';
import {
  drawFar, drawForeground, drawGround, drawHaze, drawMid, drawNearBack, drawRiderOutlined, drawRoadside, drawSky, drawUnderground,
  eveningAt, Painter, type Frame, type Layout, type RiderPose,
} from './draw';
import { TRAIL_PX } from './world';

export interface SceneEvent {
  type: 'correct' | 'wrong';
  id: number;
}

interface Props {
  /** Points earned so far — the only source of truth for how far the rider has travelled. */
  points: number;
  event: SceneEvent | null;
  /** Where the road and rider sit, in CSS pixels from the top-left of the viewport. */
  roadY: number;
  riderX: number;
  reducedMotion: boolean;
  /** Changing this jumps straight to `points` without riding (new screen, resumed game). */
  snapKey: string;
}

interface Ride {
  from: number;
  to: number;
  start: number;
  duration: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Full-page pixel-art world. Correct answers make the rider gallop forward by an
 * amount proportional to the points earned; the landscape scrolls with parallax.
 * The scene only *displays* points — it never awards them.
 */
export function TrailScene({ points, event, roadY, riderX, reducedMotion, snapKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    cam: points,
    ride: null as Ride | null,
    initialised: false,
    cheerAt: -1,
    oopsAt: -1,
    phase: 0,
    clock: 0,
    layout: null as (Layout & { scale: number }) | null,
    lastEventId: -1,
    snapKey,
  });
  const ambient = useRef(new Ambient());
  const propsRef = useRef({ roadY, riderX, reducedMotion });
  propsRef.current = { roadY, riderX, reducedMotion };
  const drawRef = useRef<(now: number) => void>(() => {});

  // React to score changes: ride forward, or snap (first paint, reduced motion, new game).
  useEffect(() => {
    const s = state.current;
    const now = performance.now();
    const snap = s.snapKey !== snapKey;
    s.snapKey = snapKey;
    if (!s.initialised || snap || reducedMotion || points <= s.cam) {
      if (points < s.cam) ambient.current.reset();
      s.cam = points;
      s.ride = null;
      s.initialised = true;
    } else if (points !== (s.ride?.to ?? s.cam)) {
      s.ride = { from: s.cam, to: points, start: now + RIDE_DELAY_MS, duration: rideDurationMs(points - s.cam) };
    }
    drawRef.current(now);
  }, [points, reducedMotion, snapKey]);

  useEffect(() => {
    if (!event || event.id === state.current.lastEventId) return;
    state.current.lastEventId = event.id;
    const now = performance.now();
    if (event.type === 'correct') state.current.cheerAt = now + RIDE_DELAY_MS * 0.4;
    else state.current.oopsAt = now;
    drawRef.current(now);
    if (reducedMotion) {
      const timer = window.setTimeout(() => drawRef.current(performance.now()), 1500);
      return () => window.clearTimeout(timer);
    }
  }, [event, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const painter = new Painter(ctx);
    const s = state.current;

    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.max(3, Math.min(5, Math.round(Math.min(vw, vh * 1.3) / 320)));
      const W = Math.ceil(vw / scale);
      const H = Math.ceil(vh / scale) + 1;
      const { roadY: ry, riderX: rx } = propsRef.current;
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      ctx.imageSmoothingEnabled = false;
      s.layout = { W, H, roadY: Math.round(ry / scale), riderX: Math.round(rx / scale), scale };
    };

    let last = performance.now();
    const render = (now: number) => {
      if (!s.layout) measure();
      const L = s.layout!;
      const still = propsRef.current.reducedMotion;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const before = s.cam;
      let moving = false;
      if (s.ride) {
        const t = (now - s.ride.start) / s.ride.duration;
        if (t >= 1) {
          s.cam = s.ride.to;
          s.ride = null;
        } else if (t > 0) {
          s.cam = s.ride.from + (s.ride.to - s.ride.from) * easeInOut(t);
          moving = true;
        }
      }
      if (!still) {
        s.clock += dt;
        if (moving) s.phase += dt * 15;
      }

      const p = s.cam / MAX_SCORE;
      const frame: Frame = { P: painter, L, cam: p * TRAIL_PX, p, time: still ? 0 : s.clock, still };
      painter.setEvening(eveningAt(p));
      const camDelta = ((s.cam - before) / MAX_SCORE) * TRAIL_PX;
      if (!still) ambient.current.update(dt, frame, camDelta, moving);

      const pose: RiderPose = {
        phase: s.phase,
        moving,
        cheer: s.cheerAt >= 0 && now >= s.cheerAt ? (now - s.cheerAt) / 1000 : -1,
        oops: s.oopsAt >= 0 ? (now - s.oopsAt) / 1000 : -1,
        clock: s.clock,
        still,
      };
      if (pose.cheer > 2) s.cheerAt = -1;
      if (pose.oops > 2) s.oopsAt = -1;

      drawSky(frame);
      if (!still) ambient.current.drawSky(frame);
      drawFar(frame);
      drawMid(frame);
      drawNearBack(frame);
      if (!still) ambient.current.drawTrain(frame);
      drawHaze(frame);
      drawGround(frame);
      drawRoadside(frame);
      drawUnderground(frame);
      if (!still) ambient.current.drawGround(frame);
      drawRiderOutlined(frame, pose);
      drawForeground(frame);
      if (!still) ambient.current.drawGlow(frame);
    };
    drawRef.current = render;

    let raf = 0;
    const loop = (now: number) => {
      render(now);
      if (!propsRef.current.reducedMotion && !document.hidden) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const start = () => {
      if (!raf && !propsRef.current.reducedMotion && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const onResize = () => {
      measure();
      render(performance.now());
    };
    const onVisibility = () => start();

    measure();
    render(performance.now());
    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reducedMotion]);

  // Layout changes (e.g. switching screens) re-measure without restarting the loop.
  useEffect(() => {
    state.current.layout = null;
    drawRef.current(performance.now());
  }, [roadY, riderX]);

  return (
    <div className={`scene${reducedMotion ? ' scene--still' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className="scene__canvas" />
    </div>
  );
}
