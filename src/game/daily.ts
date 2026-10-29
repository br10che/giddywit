import { DIFFICULTIES, GAME, QUESTION_SCHEDULE, type Difficulty } from '../config';
import type { QuestionBank } from './bank';
import { seededRandom, shuffled } from './rng';
import type { PlannedQuestion, Question } from './types';

const DAY_MS = 86_400_000;

/** YYYY-MM-DD in UTC. Everyone's challenge changes at midnight UTC. */
export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Whole days since 1970-01-01 (UTC). */
export function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);
}

export function challengeNumber(dateKey: string): number {
  return dayNumber(dateKey) - dayNumber(GAME.firstChallengeDate) + 1;
}

export function msUntilNextUtcMidnight(now: number = Date.now()): number {
  return (Math.floor(now / DAY_MS) + 1) * DAY_MS - now;
}

export function addDays(dateKey: string, days: number): string {
  return utcDateKey(new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS));
}

/** Deterministic choice order for one question in one game. Correct-answer ids are untouched. */
export function choiceOrderFor(question: Question, seedKey: string): string[] {
  return shuffled(
    question.choices.map((c) => c.id),
    seededRandom(`${seedKey}|choices|${question.id}`),
  );
}

/**
 * Pick the day's questions. For each difficulty the pool is shuffled once per "cycle"
 * (seeded by content version + cycle number) and each day takes the next slice,
 * so no question repeats until its whole pool has been used.
 */
export function buildDailyPlan(dateKey: string, bank: QuestionBank): PlannedQuestion[] {
  const day = dayNumber(dateKey);
  const perDay = countPerDifficulty();
  const picks = {} as Record<Difficulty, Question[]>;

  for (const difficulty of DIFFICULTIES) {
    const need = perDay[difficulty];
    if (need === 0) continue;
    const pool = bank.pools[difficulty];
    if (pool.length < need) {
      throw new Error(`Not enough verified ${difficulty} questions (need ${need}, have ${pool.length}).`);
    }
    const daysPerCycle = Math.floor(pool.length / need);
    const cycle = Math.floor(day / daysPerCycle);
    const slot = day - cycle * daysPerCycle;
    const order = shuffled(pool, seededRandom(`${bank.version}|${difficulty}|cycle${cycle}`));
    picks[difficulty] = order.slice(slot * need, slot * need + need);
  }

  const used = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
  return QUESTION_SCHEDULE.map((difficulty) => {
    const question = picks[difficulty][used[difficulty]++];
    return {
      questionId: question.id,
      choiceOrder: choiceOrderFor(question, `${bank.version}|${dateKey}`),
    };
  });
}

export function countPerDifficulty(): Record<Difficulty, number> {
  const counts = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
  for (const d of QUESTION_SCHEDULE) counts[d]++;
  return counts;
}
