import { describe, expect, it } from 'vitest';
// Plain JS validation script, shared with `npm run validate`.
import { validateQuestions } from '../scripts/validate-questions.mjs';
import { ALL_QUESTIONS, BANK } from '../src/content/bank';
import { DIFFICULTIES } from '../src/config';
import { fakeQuestion } from './helpers';

describe('question bank', () => {
  it('passes validation with at least 100 questions, balanced across levels', () => {
    const { errors } = validateQuestions(ALL_QUESTIONS);
    expect(errors).toEqual([]);
    expect(ALL_QUESTIONS.length).toBeGreaterThanOrEqual(100);
    for (const d of DIFFICULTIES) expect(BANK.pools[d].length).toBeGreaterThanOrEqual(20);
  });

  it('only plays verified questions', () => {
    for (const q of BANK.byId.values()) expect(q.verification.status).toBe('verified');
  });

  it('catches duplicate ids, duplicate choices, missing answers and bad difficulty', () => {
    const good = fakeQuestion('easy', 1);
    const dupChoice = { ...fakeQuestion('easy', 2), choices: [...good.choices.slice(0, 3), { id: 'd', text: good.choices[0].text }] };
    const noAnswer = { ...fakeQuestion('easy', 3), answerId: 'z' };
    const badLevel = { ...fakeQuestion('easy', 4), difficulty: 'impossible' };
    const { errors } = validateQuestions([good, { ...good }, dupChoice, noAnswer, badLevel]);
    const text = errors.join('\n');
    expect(text).toMatch(/duplicate id/);
    expect(text).toMatch(/duplicate choice text/);
    expect(text).toMatch(/answerId "z" is not one of the choices/);
    expect(text).toMatch(/invalid difficulty "impossible"/);
  });
});
