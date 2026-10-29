import { GAME } from '../config';
import { isDateKey } from './daily';
import { allAnswered, score } from './session';
import type { Session } from './types';

/**
 * localStorage persistence with a memory fallback. Anything unreadable or malformed
 * is ignored rather than crashing the game. Local storage is a convenience, not
 * anti-cheat: anyone can edit it.
 */

export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryKeyValue(): KeyValue {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

function browserKeyValue(): KeyValue | null {
  try {
    const ls = window.localStorage;
    const probe = `${GAME.storagePrefix}probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => ls.setItem(k, v),
      remove: (k) => ls.removeItem(k),
    };
  } catch {
    return null;
  }
}

export interface Prefs {
  sound: boolean;
  seenHelp: boolean;
}

export interface Stats {
  bestDaily: number;
  bestPractice: number;
  /** Question ids from recent practice games, so practice doesn't repeat itself too soon. */
  recentPractice: string[];
}

const DEFAULT_PREFS: Prefs = { sound: true, seenHelp: false };
const MAX_SAVED_RESULTS = 400;
const MAX_RECENT_PRACTICE = 60;

export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    s.schema === 1 &&
    (s.mode === 'daily' || s.mode === 'practice') &&
    typeof s.id === 'string' &&
    isDateKey(s.dateKey) &&
    typeof s.contentVersion === 'string' &&
    Array.isArray(s.plan) &&
    s.plan.length > 0 &&
    s.plan.every(
      (p: unknown) =>
        !!p &&
        typeof (p as { questionId?: unknown }).questionId === 'string' &&
        Array.isArray((p as { choiceOrder?: unknown }).choiceOrder) &&
        (p as { choiceOrder: unknown[] }).choiceOrder.every((c) => typeof c === 'string'),
    ) &&
    Array.isArray(s.answers) &&
    s.answers.length <= s.plan.length &&
    s.answers.every(
      (a: unknown) =>
        !!a &&
        typeof (a as Record<string, unknown>).questionId === 'string' &&
        typeof (a as Record<string, unknown>).choiceId === 'string' &&
        typeof (a as Record<string, unknown>).correct === 'boolean' &&
        typeof (a as Record<string, unknown>).points === 'number' &&
        (a as { points: number }).points >= 0,
    ) &&
    typeof s.position === 'number' &&
    Number.isInteger(s.position) &&
    s.position >= 0 &&
    s.position <= s.answers.length &&
    s.position <= s.plan.length &&
    typeof s.startedAt === 'number'
  );
}

export class GameStorage {
  readonly persistent: boolean;
  private kv: KeyValue;
  private prefix: string;

  constructor(kv?: KeyValue | null, prefix: string = GAME.storagePrefix) {
    const real = kv === undefined ? browserKeyValue() : kv;
    this.persistent = !!real;
    this.kv = real ?? memoryKeyValue();
    this.prefix = prefix;
  }

  private read(key: string): unknown {
    try {
      const raw = this.kv.get(this.prefix + key);
      return raw == null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      this.kv.set(this.prefix + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  private remove(key: string): void {
    try {
      this.kv.remove(this.prefix + key);
    } catch {
      /* ignore */
    }
  }

  loadPrefs(): Prefs {
    const v = this.read('prefs') as Partial<Prefs> | null;
    return {
      sound: typeof v?.sound === 'boolean' ? v.sound : DEFAULT_PREFS.sound,
      seenHelp: typeof v?.seenHelp === 'boolean' ? v.seenHelp : DEFAULT_PREFS.seenHelp,
    };
  }

  savePrefs(prefs: Prefs): void {
    this.write('prefs', prefs);
  }

  loadStats(): Stats {
    const v = this.read('stats') as Partial<Stats> | null;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    return {
      bestDaily: num(v?.bestDaily),
      bestPractice: num(v?.bestPractice),
      recentPractice: Array.isArray(v?.recentPractice) ? v.recentPractice.filter((x) => typeof x === 'string') : [],
    };
  }

  private saveStats(stats: Stats): void {
    this.write('stats', stats);
  }

  loadActiveDaily(): Session | null {
    const v = this.read('daily:active');
    return isSession(v) && v.mode === 'daily' ? v : null;
  }

  loadActivePractice(): Session | null {
    const v = this.read('practice:active');
    return isSession(v) && v.mode === 'practice' ? v : null;
  }

  /** Completed daily games, keyed by UTC date. */
  loadDailyResults(): Record<string, Session> {
    const v = this.read('daily:results');
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, Session> = {};
    for (const [key, s] of Object.entries(v as Record<string, unknown>)) {
      if (isDateKey(key) && isSession(s) && s.mode === 'daily' && s.dateKey === key && allAnswered(s)) out[key] = s;
    }
    return out;
  }

  /**
   * Save a game. Call this *before* animating, so a reload mid-animation restores the
   * finished state. Daily and practice games use separate keys and never overwrite each other.
   */
  saveSession(session: Session): void {
    if (session.mode === 'daily') {
      this.write('daily:active', session);
      if (allAnswered(session)) {
        const results = this.loadDailyResults();
        results[session.dateKey] = session;
        const keys = Object.keys(results).sort();
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_SAVED_RESULTS))) delete results[old];
        this.write('daily:results', results);
        const stats = this.loadStats();
        if (score(session) > stats.bestDaily) this.saveStats({ ...stats, bestDaily: score(session) });
      }
    } else {
      this.write('practice:active', session);
      if (allAnswered(session)) {
        const stats = this.loadStats();
        const recent = [...session.plan.map((p) => p.questionId), ...stats.recentPractice];
        this.saveStats({
          ...stats,
          bestPractice: Math.max(stats.bestPractice, score(session)),
          recentPractice: [...new Set(recent)].slice(0, MAX_RECENT_PRACTICE),
        });
      }
    }
  }

  clearActivePractice(): void {
    this.remove('practice:active');
  }

  clearActiveDaily(): void {
    this.remove('daily:active');
  }
}
