import { describe, expect, it } from 'vitest';
import { QUESTION_SCHEDULE } from '../src/config';
import { BANK } from '../src/content/bank';
import { addDays, buildDailyPlan, msUntilNextUtcMidnight, utcDateKey } from '../src/game/daily';
import { buildPracticePlan } from '../src/game/practice';
import { fakeBank } from './helpers';

describe('daily selection', () => {
  it('is deterministic for a date (questions and choice order)', () => {
    expect(buildDailyPlan('2026-11-05', BANK)).toEqual(buildDailyPlan('2026-11-05', BANK));
  });

  it('differs between days', () => {
    expect(buildDailyPlan('2026-11-05', BANK)).not.toEqual(buildDailyPlan('2026-11-06', BANK));
  });

  it('follows the difficulty schedule with no repeated question', () => {
    const plan = buildDailyPlan('2027-03-14', BANK);
    expect(plan.map((p) => BANK.byId.get(p.questionId)!.difficulty)).toEqual(QUESTION_SCHEDULE);
    expect(new Set(plan.map((p) => p.questionId)).size).toBe(10);
  });

  it('keeps correct-answer ids intact after shuffling choices', () => {
    for (let d = 0; d < 60; d++) {
      const plan = buildDailyPlan(addDays('2026-11-01', d), BANK);
      for (const p of plan) {
        const q = BANK.byId.get(p.questionId)!;
        expect([...p.choiceOrder].sort()).toEqual(q.choices.map((c) => c.id).sort());
        expect(p.choiceOrder).toContain(q.answerId);
      }
    }
  });

  it('actually shuffles answer positions', () => {
    const positions = new Set<number>();
    for (let d = 0; d < 20; d++) {
      for (const p of buildDailyPlan(addDays('2026-11-01', d), BANK)) {
        positions.add(p.choiceOrder.indexOf(BANK.byId.get(p.questionId)!.answerId));
      }
    }
    expect(positions.size).toBe(4);
  });

  it('does not repeat a question until its pool has been used up', () => {
    const bank = fakeBank(10);
    // 10 per level, 2 per day → 5-day cycles. Check a full aligned cycle.
    const start = '2026-11-01';
    const day0 = Math.floor(Date.parse(`${start}T00:00:00Z`) / 86_400_000);
    const cycleStart = addDays(start, 5 - (day0 % 5)) ;
    const seen = new Set<string>();
    for (let d = 0; d < 5; d++) {
      for (const p of buildDailyPlan(addDays(cycleStart, d), bank)) {
        expect(seen.has(p.questionId)).toBe(false);
        seen.add(p.questionId);
      }
    }
    expect(seen.size).toBe(50);
  });

  it('uses the UTC date and counts down to midnight UTC', () => {
    expect(utcDateKey(new Date('2026-11-05T23:59:59Z'))).toBe('2026-11-05');
    expect(utcDateKey(new Date('2026-11-06T00:00:00Z'))).toBe('2026-11-06');
    expect(utcDateKey(new Date('2026-11-05T22:30:00-05:00'))).toBe('2026-11-06');
    expect(msUntilNextUtcMidnight(Date.parse('2026-11-05T23:00:00Z'))).toBe(3_600_000);
  });
});

describe('practice selection', () => {
  it('builds ten distinct questions on the same ladder', () => {
    const plan = buildPracticePlan(12345, BANK);
    expect(plan.map((p) => BANK.byId.get(p.questionId)!.difficulty)).toEqual(QUESTION_SCHEDULE);
    expect(new Set(plan.map((p) => p.questionId)).size).toBe(10);
  });

  it('avoids questions it is told to avoid when it can', () => {
    const daily = buildDailyPlan('2026-11-05', BANK).map((p) => p.questionId);
    const plan = buildPracticePlan(999, BANK, new Set(daily));
    expect(plan.some((p) => daily.includes(p.questionId))).toBe(false);
  });
});
