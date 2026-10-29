import type { Difficulty } from '../config';

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  choices: Choice[];
  answerId: string;
  explanation: string;
  source: string;
  verification: {
    status: 'verified' | 'unverified';
    checkedOn?: string;
    evidence?: string;
    note?: string;
  };
}

export type Mode = 'daily' | 'practice';

/** A question as it appears in one game: which question, and the order its choices are shown in. */
export interface PlannedQuestion {
  questionId: string;
  choiceOrder: string[];
}

export interface AnswerRecord {
  questionId: string;
  choiceId: string;
  correct: boolean;
  points: number;
  answeredAt: number;
}

/**
 * Everything needed to restore a game exactly. Score is never stored on its own —
 * it is always the sum of `answers`, so an answer can only ever count once.
 */
export interface Session {
  schema: 1;
  mode: Mode;
  id: string;
  /** UTC date of the daily challenge (or the day a practice game started). */
  dateKey: string;
  contentVersion: string;
  plan: PlannedQuestion[];
  answers: AnswerRecord[];
  /** Index of the question on screen. Equal to plan.length once results have been opened. */
  position: number;
  startedAt: number;
  completedAt: number | null;
}
