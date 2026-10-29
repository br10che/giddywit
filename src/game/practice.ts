import { DIFFICULTIES, QUESTION_SCHEDULE, type Difficulty } from '../config';
import type { QuestionBank } from './bank';
import { choiceOrderFor, countPerDifficulty } from './daily';
import { mulberry32, shuffled } from './rng';
import type { PlannedQuestion, Question } from './types';

/**
 * A random ten-question practice game with the same difficulty ladder as the daily.
 * Questions in `avoid` (today's daily, recently practised) are used only if a pool runs short.
 */
export function buildPracticePlan(seed: number, bank: QuestionBank, avoid: ReadonlySet<string> = new Set()): PlannedQuestion[] {
  const rand = mulberry32(seed);
  const perDay = countPerDifficulty();
  const picks = {} as Record<Difficulty, Question[]>;

  for (const difficulty of DIFFICULTIES) {
    const need = perDay[difficulty];
    if (need === 0) continue;
    const order = shuffled(bank.pools[difficulty], rand);
    const fresh = order.filter((q) => !avoid.has(q.id));
    const stale = order.filter((q) => avoid.has(q.id));
    picks[difficulty] = [...fresh, ...stale].slice(0, need);
    if (picks[difficulty].length < need) throw new Error(`Not enough ${difficulty} questions for practice.`);
  }

  const used = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
  return QUESTION_SCHEDULE.map((difficulty) => {
    const question = picks[difficulty][used[difficulty]++];
    return { questionId: question.id, choiceOrder: choiceOrderFor(question, `practice|${seed}`) };
  });
}
