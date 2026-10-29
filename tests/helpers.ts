import { DIFFICULTIES, type Difficulty } from '../src/config';
import { createBank } from '../src/game/bank';
import type { Question } from '../src/game/types';

/** A small synthetic bank: `perLevel` verified questions per difficulty, answer is always choice "b". */
export function fakeBank(perLevel = 6, version = 'test-1') {
  const qs: Question[] = [];
  for (const d of DIFFICULTIES) {
    for (let i = 0; i < perLevel; i++) qs.push(fakeQuestion(d, i));
  }
  return createBank(version, qs);
}

export function fakeQuestion(d: Difficulty, i: number): Question {
  const id = `${d}-${String(i).padStart(3, '0')}`;
  return {
    id,
    category: 'Science',
    difficulty: d,
    question: `Question ${id}?`,
    choices: [
      { id: 'a', text: `${id} wrong A` },
      { id: 'b', text: `${id} right` },
      { id: 'c', text: `${id} wrong C` },
      { id: 'd', text: `${id} wrong D` },
    ],
    answerId: 'b',
    explanation: 'Because.',
    source: 'https://example.org/source',
    verification: { status: 'verified', checkedOn: '2026-10-29' },
  };
}
