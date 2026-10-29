import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no canvas; the scene simply skips drawing when there's no context.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

let reduced = false;
export function setReducedMotion(value: boolean): void {
  reduced = value;
}

window.matchMedia = ((query: string) => ({
  matches: query.includes('reduce') ? reduced : false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

beforeEach(() => {
  try {
    window.localStorage?.clear();
  } catch {
    /* not available in this environment */
  }
  reduced = false;
});

afterEach(() => cleanup());
