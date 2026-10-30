import { useEffect, useRef, useState } from 'react';

export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [reduced, setReduced] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export function useViewport(): { width: number; height: number } {
  const get = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState(get);
  useEffect(() => {
    const onResize = () => setSize(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/**
 * Counts down `totalMs` while `running`, restarting whenever `resetKey` changes.
 * Pauses while a dialog (e.g. How to play) is open. Calls `onExpire` once at zero.
 */
export function useCountdown(totalMs: number, running: boolean, resetKey: unknown, onExpire: () => void): number {
  const [left, setLeft] = useState(totalMs);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    if (!running || totalMs <= 0) return;
    let remaining = totalMs;
    let last = performance.now();
    setLeft(remaining);
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (document.querySelector('dialog[open]')) return;
      remaining = Math.max(0, remaining - dt);
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        expire.current();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [running, resetKey, totalMs]);
  return left;
}

/** Animates a displayed number toward `target` (no animation when `instant`). */
export function useCountUp(target: number, opts: { delay: number; duration: number; instant: boolean }): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (opts.instant || target <= from.current) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now() + opts.delay;
    const begin = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / opts.duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(begin + (target - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, opts.instant]);
  return value;
}

/** Re-renders every second; returns the current time. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
