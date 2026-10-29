import type { QuestionBank } from './bank';
import { addDays, buildDailyPlan } from './daily';
import { createSession, isFinished, isPlayableWith } from './session';
import type { Session } from './types';

export type DailyEntry =
  | { kind: 'resume'; session: Session }
  | { kind: 'results'; session: Session }
  | { kind: 'new'; dateKey: string };

/**
 * What "Play today" should do.
 * - An unfinished daily game is always resumed, even if midnight UTC has passed since it started.
 * - A finished game for today opens its results instead of starting again.
 * - Otherwise a fresh challenge for today.
 */
export function resolveDaily(
  today: string,
  active: Session | null,
  results: Record<string, Session>,
  bank: QuestionBank,
): DailyEntry {
  if (active && !isFinished(active) && isPlayableWith(active, bank)) {
    return { kind: 'resume', session: active };
  }
  if (results[today]) return { kind: 'results', session: results[today] };
  return { kind: 'new', dateKey: today };
}

export function newDailySession(dateKey: string, bank: QuestionBank, now: number): Session {
  return createSession({
    mode: 'daily',
    id: `daily:${dateKey}:${bank.version}`,
    dateKey,
    contentVersion: bank.version,
    plan: buildDailyPlan(dateKey, bank),
    now,
  });
}

/** Consecutive days with a finished daily, counting back from today (or yesterday if today isn't played yet). */
export function currentStreak(today: string, results: Record<string, Session>): number {
  let day = results[today] ? today : addDays(today, -1);
  let streak = 0;
  while (results[day]) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
