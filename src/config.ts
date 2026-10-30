/**
 * Game configuration — the one place to rename the game or retune scoring.
 * Colours live in src/styles/theme.css (UI) and src/scene/palette.ts (pixel art).
 */

export const GAME = {
  name: 'Giddywit',
  tagline: 'Ten questions. How far can you ride?',
  /** Public URL added to shared results. Leave empty to use the page's own address. */
  shareUrl: '',
  /** Prefix for every localStorage key. Change it only if you want to reset everyone's saves. */
  storagePrefix: 'giddywit:v1:',
  /** Challenge #1 — used only for the "#12" number shown on results and share text. */
  firstChallengeDate: '2026-11-01',
};

export type Difficulty = 'easy' | 'medium' | 'challenging' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'challenging', 'hard', 'expert'];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; points: number }> = {
  easy: { label: 'Easy', points: 50 },
  medium: { label: 'Medium', points: 100 },
  challenging: { label: 'Challenging', points: 150 },
  hard: { label: 'Hard', points: 200 },
  expert: { label: 'Expert', points: 250 },
};

/** Difficulty of each question slot, in order. Its length is the number of questions per game. */
export const QUESTION_SCHEDULE: Difficulty[] = [
  'easy', 'easy',
  'medium', 'medium',
  'challenging', 'challenging',
  'hard', 'hard',
  'expert', 'expert',
];

export const QUESTIONS_PER_GAME = QUESTION_SCHEDULE.length;

export const MAX_SCORE = QUESTION_SCHEDULE.reduce((sum, d) => sum + DIFFICULTY_INFO[d].points, 0);

/** Trail progress is points as a share of the maximum. Points stay the source of truth. */
export function trailPercent(score: number): number {
  return Math.round((Math.max(0, Math.min(score, MAX_SCORE)) / MAX_SCORE) * 100);
}

/** Ride animation timing (ms). Bigger rewards ride for longer. */
export const RIDE_DELAY_MS = 250;
/** Extra wait before the ride after an expert answer, while the horse rears up. */
export const REAR_MS = 1100;
export function rideDurationMs(pointsGained: number): number {
  return Math.round(Math.min(1500, Math.max(1000, 900 + pointsGained * 2)));
}
