import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../src/game/daily';
import { newDailySession, resolveDaily } from '../src/game/flow';
import { buildPracticePlan } from '../src/game/practice';
import { createSession, goToNext, score, submitAnswer } from '../src/game/session';
import { GameStorage, memoryKeyValue, type KeyValue } from '../src/game/storage';
import type { Session } from '../src/game/types';
import { fakeBank } from './helpers';

const bank = fakeBank();

function playAll(s: Session, correct = true): Session {
  let cur = s;
  while (cur.position < cur.plan.length) {
    cur = submitAnswer(cur, correct ? 'b' : 'a', bank, 1);
    cur = goToNext(cur);
  }
  return cur;
}

describe('storage', () => {
  it('round-trips a daily session after every answer', () => {
    const store = new GameStorage(memoryKeyValue());
    let s = newDailySession('2026-11-05', bank, 0);
    s = submitAnswer(s, 'b', bank, 1);
    store.saveSession(s);
    const restored = store.loadActiveDaily()!;
    expect(restored).toEqual(s);
    expect(score(restored)).toBe(50);
    // restoring and "answering again" can't add points
    expect(submitAnswer(restored, 'b', bank, 2)).toBe(restored);
  });

  it('ignores corrupted data instead of crashing', () => {
    const kv = memoryKeyValue();
    const store = new GameStorage(kv, 'x:');
    kv.set('x:daily:active', '{not json');
    kv.set('x:daily:results', JSON.stringify({ '2026-11-05': { schema: 1, mode: 'daily', answers: 'nope' } }));
    kv.set('x:prefs', '"weird"');
    kv.set('x:stats', JSON.stringify({ bestDaily: -5, recentPractice: [1, 'q'] }));
    expect(store.loadActiveDaily()).toBeNull();
    expect(store.loadDailyResults()).toEqual({});
    expect(store.loadPrefs()).toEqual({ sound: true, seenHelp: false });
    expect(store.loadStats()).toEqual({ bestDaily: 0, bestPractice: 0, recentPractice: ['q'] });
  });

  it('rejects a tampered session that claims more answers than questions', () => {
    const kv = memoryKeyValue();
    const store = new GameStorage(kv, 'x:');
    const s = newDailySession('2026-11-05', bank, 0);
    kv.set('x:daily:active', JSON.stringify({ ...s, position: 4 }));
    expect(store.loadActiveDaily()).toBeNull();
  });

  it('keeps working when storage throws', () => {
    const broken: KeyValue = {
      get: () => { throw new Error('denied'); },
      set: () => { throw new Error('quota'); },
      remove: () => { throw new Error('denied'); },
    };
    const store = new GameStorage(broken);
    expect(store.loadActiveDaily()).toBeNull();
    expect(() => store.saveSession(newDailySession('2026-11-05', bank, 0))).not.toThrow();
    expect(store.loadPrefs().sound).toBe(true);
  });

  it('falls back to memory when there is no storage at all', () => {
    const store = new GameStorage(null);
    expect(store.persistent).toBe(false);
    const s = newDailySession('2026-11-05', bank, 0);
    store.saveSession(s);
    expect(store.loadActiveDaily()).toEqual(s);
  });

  it('records completed dailies, best score, and never lets practice overwrite them', () => {
    const store = new GameStorage(memoryKeyValue());
    const daily = playAll(newDailySession('2026-11-05', bank, 0));
    store.saveSession(daily);
    const practice = playAll(
      createSession({ mode: 'practice', id: 'p1', dateKey: '2026-11-05', contentVersion: bank.version, plan: buildPracticePlan(1, bank), now: 0 }),
      false,
    );
    store.saveSession(practice);
    expect(store.loadActiveDaily()).toEqual(daily);
    expect(store.loadDailyResults()['2026-11-05']).toEqual(daily);
    expect(store.loadStats().bestDaily).toBe(1500);
    expect(store.loadStats().bestPractice).toBe(0);
    expect(store.loadActivePractice()).toEqual(practice);
  });
});

describe('daily flow', () => {
  it('opens results for a finished daily instead of a fresh attempt', () => {
    const store = new GameStorage(memoryKeyValue());
    store.saveSession(playAll(newDailySession('2026-11-05', bank, 0)));
    const entry = resolveDaily('2026-11-05', store.loadActiveDaily(), store.loadDailyResults(), bank);
    expect(entry.kind).toBe('results');
  });

  it('resumes an unfinished daily with the same questions and choice order', () => {
    const store = new GameStorage(memoryKeyValue());
    let s = newDailySession('2026-11-05', bank, 0);
    s = submitAnswer(s, 'a', bank, 1);
    store.saveSession(s);
    const entry = resolveDaily('2026-11-05', store.loadActiveDaily(), {}, bank);
    expect(entry).toEqual({ kind: 'resume', session: s });
  });

  it('lets a player finish a challenge after midnight UTC instead of replacing it', () => {
    let s = newDailySession('2026-11-05', bank, 0);
    s = goToNext(submitAnswer(s, 'b', bank, 1));
    const entry = resolveDaily('2026-11-06', s, {}, bank);
    expect(entry.kind).toBe('resume');
    if (entry.kind === 'resume') {
      expect(entry.session.dateKey).toBe('2026-11-05');
      expect(entry.session.plan).toEqual(buildDailyPlan('2026-11-05', bank));
    }
    // once finished, the new day's challenge is offered
    const done = playAll(s);
    expect(resolveDaily('2026-11-06', done, { '2026-11-05': done }, bank)).toEqual({ kind: 'new', dateKey: '2026-11-06' });
  });

  it('drops a saved game whose questions no longer exist', () => {
    const s = newDailySession('2026-11-05', bank, 0);
    const other = fakeBank(6, 'v2');
    const broken = { ...s, plan: s.plan.map((p) => ({ ...p, questionId: `gone-${p.questionId}` })) };
    expect(resolveDaily('2026-11-05', broken, {}, other).kind).toBe('new');
  });
});
