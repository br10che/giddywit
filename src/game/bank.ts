import { DIFFICULTIES, type Difficulty } from '../config';
import type { Question } from './types';

export interface QuestionBank {
  version: string;
  /** Verified questions only, keyed by id. */
  byId: Map<string, Question>;
  /** Verified questions per difficulty, sorted by id so selection never depends on file order. */
  pools: Record<Difficulty, Question[]>;
}

export function createBank(version: string, questions: Question[]): QuestionBank {
  const playable = questions.filter((q) => q.verification?.status === 'verified');
  const byId = new Map(playable.map((q) => [q.id, q]));
  const pools = Object.fromEntries(DIFFICULTIES.map((d) => [d, [] as Question[]])) as Record<Difficulty, Question[]>;
  for (const q of playable) pools[q.difficulty]?.push(q);
  for (const d of DIFFICULTIES) pools[d].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version, byId, pools };
}
