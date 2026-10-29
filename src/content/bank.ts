import { createBank } from '../game/bank';
import type { Question } from '../game/types';
import easy from './questions/easy.json';
import medium from './questions/medium.json';
import challenging from './questions/challenging.json';
import hard from './questions/hard.json';
import expert from './questions/expert.json';

/**
 * Bump this whenever questions are added, removed or edited.
 * It seeds daily selection, so a new version reshuffles future days.
 * Games already in progress keep their own saved questions.
 */
export const CONTENT_VERSION = '2026-10-29.2';

export const ALL_QUESTIONS = [...easy, ...medium, ...challenging, ...hard, ...expert] as Question[];

export const BANK = createBank(CONTENT_VERSION, ALL_QUESTIONS);
