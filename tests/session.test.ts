import { describe, expect, it } from 'vitest';
import { MAX_SCORE, QUESTION_SCHEDULE, trailPercent, DIFFICULTY_INFO } from '../src/config';
import { buildDailyPlan } from '../src/game/daily';
import { allAnswered, correctCount, createSession, goToNext, isFinished, score, submitAnswer, submitTimeout } from '../src/game/session';
import { fakeBank } from './helpers';

const bank = fakeBank();
const newGame = () =>
  createSession({ mode: 'daily', id: 'd', dateKey: '2026-11-03', contentVersion: bank.version, plan: buildDailyPlan('2026-11-03', bank), now: 0 });
const rightId = (qid: string) => bank.byId.get(qid)!.answerId;

describe('scoring', () => {
  it('awards the configured points for a correct answer exactly once', () => {
    const s0 = newGame();
    const qid = s0.plan[0].questionId;
    const s1 = submitAnswer(s0, rightId(qid), bank, 1);
    expect(score(s1)).toBe(DIFFICULTY_INFO[QUESTION_SCHEDULE[0]].points);
    // double tap / re-render / animation callback
    const s2 = submitAnswer(s1, rightId(qid), bank, 2);
    const s3 = submitAnswer(s1, 'a', bank, 3);
    expect(s2).toBe(s1);
    expect(s3).toBe(s1);
    expect(score(s2)).toBe(50);
  });

  it('awards zero for a wrong answer and never deducts', () => {
    let s = newGame();
    s = submitAnswer(s, rightId(s.plan[0].questionId), bank, 1);
    s = goToNext(s);
    const before = score(s);
    s = submitAnswer(s, 'a', bank, 2);
    expect(s.answers[1]).toMatchObject({ correct: false, points: 0 });
    expect(score(s)).toBe(before);
  });

  it('a time-out scores zero, keeps the score and can then move on', () => {
    let s = newGame();
    s = submitAnswer(s, rightId(s.plan[0].questionId), bank, 1);
    s = goToNext(s);
    const before = score(s);
    s = submitTimeout(s, bank, 2);
    expect(s.answers[1]).toMatchObject({ questionId: s.plan[1].questionId, choiceId: '', correct: false, points: 0, timedOut: true });
    expect(score(s)).toBe(before);
    expect(goToNext(s).position).toBe(2);
  });

  it('a late time-out never overrides an answer already given', () => {
    const s0 = newGame();
    const s1 = submitAnswer(s0, rightId(s0.plan[0].questionId), bank, 1);
    expect(submitTimeout(s1, bank, 2)).toBe(s1);
    expect(score(s1)).toBe(50);
  });

  it('ignores choices that are not part of the question', () => {
    const s = newGame();
    expect(submitAnswer(s, 'zzz', bank, 1)).toBe(s);
  });

  it('a perfect run totals 1,500 points and reaches 100% of the trail', () => {
    let s = newGame();
    for (let i = 0; i < s.plan.length; i++) {
      s = submitAnswer(s, rightId(s.plan[i].questionId), bank, i);
      s = goToNext(s);
    }
    expect(score(s)).toBe(1500);
    expect(MAX_SCORE).toBe(1500);
    expect(trailPercent(score(s))).toBe(100);
    expect(correctCount(s)).toBe(10);
  });

  it('ends after exactly ten questions', () => {
    let s = newGame();
    expect(s.plan).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(isFinished(s)).toBe(false);
      s = goToNext(s); // can't skip an unanswered question
      expect(s.position).toBe(i);
      s = submitAnswer(s, 'a', bank, i);
      s = goToNext(s);
    }
    expect(allAnswered(s)).toBe(true);
    expect(isFinished(s)).toBe(true);
    expect(submitAnswer(s, 'b', bank, 99)).toBe(s);
    expect(goToNext(s)).toBe(s);
    expect(s.answers).toHaveLength(10);
  });

  it('uses the difficulty ladder 50/100/150/200/250', () => {
    const s = newGame();
    const pts = s.plan.map((p) => DIFFICULTY_INFO[bank.byId.get(p.questionId)!.difficulty].points);
    expect(pts).toEqual([50, 50, 100, 100, 150, 150, 200, 200, 250, 250]);
  });
});

describe('share text', () => {
  it('is spoiler-free: name, date, score, trail and ten marks only', async () => {
    const { buildShareText } = await import('../src/game/share');
    let s = newGame();
    for (let i = 0; i < 10; i++) s = goToNext(submitAnswer(s, i % 2 ? 'a' : rightId(s.plan[i].questionId), bank, i));
    const text = buildShareText(s, 'https://example.org/');
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^Giddywit( #\d+)? · 2026-11-03$/);
    expect(lines[1]).toBe(`${score(s).toLocaleString('en-US')}/1,500 pts · Trail ${trailPercent(score(s))}%`);
    expect(lines[2]).toBe('✅❌✅❌✅❌✅❌✅❌');
    expect(lines[3]).toBe('https://example.org/');
    for (const p of s.plan) {
      const q = bank.byId.get(p.questionId)!;
      expect(text).not.toContain(q.question);
      for (const c of q.choices) expect(text).not.toContain(c.text);
    }
  });
});
