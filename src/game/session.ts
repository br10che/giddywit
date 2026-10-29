import { DIFFICULTY_INFO } from '../config';
import type { QuestionBank } from './bank';
import type { Mode, PlannedQuestion, Question, Session } from './types';

/**
 * Pure game-state transitions. Every function returns a new Session, or the same
 * object when the action isn't allowed — so double taps, re-renders and animation
 * callbacks can never award points twice.
 */

export function createSession(opts: {
  mode: Mode;
  id: string;
  dateKey: string;
  contentVersion: string;
  plan: PlannedQuestion[];
  now: number;
}): Session {
  return {
    schema: 1,
    mode: opts.mode,
    id: opts.id,
    dateKey: opts.dateKey,
    contentVersion: opts.contentVersion,
    plan: opts.plan,
    answers: [],
    position: 0,
    startedAt: opts.now,
    completedAt: null,
  };
}

export function pointsFor(question: Question): number {
  return DIFFICULTY_INFO[question.difficulty].points;
}

export function score(session: Session): number {
  return session.answers.reduce((sum, a) => sum + a.points, 0);
}

export function correctCount(session: Session): number {
  return session.answers.filter((a) => a.correct).length;
}

/** True when the question on screen has already been answered (feedback is showing). */
export function isCurrentAnswered(session: Session): boolean {
  return session.answers.length > session.position;
}

export function allAnswered(session: Session): boolean {
  return session.answers.length >= session.plan.length;
}

/** The player has moved past the last question to the results. */
export function isFinished(session: Session): boolean {
  return session.position >= session.plan.length;
}

export function submitAnswer(session: Session, choiceId: string, bank: QuestionBank, now: number): Session {
  if (isFinished(session) || isCurrentAnswered(session)) return session;
  const planned = session.plan[session.position];
  if (!planned.choiceOrder.includes(choiceId)) return session;
  const question = bank.byId.get(planned.questionId);
  if (!question) return session;

  const correct = choiceId === question.answerId;
  const answers = [
    ...session.answers,
    { questionId: question.id, choiceId, correct, points: correct ? pointsFor(question) : 0, answeredAt: now },
  ];
  return {
    ...session,
    answers,
    completedAt: answers.length >= session.plan.length ? now : session.completedAt,
  };
}

export function goToNext(session: Session): Session {
  if (isFinished(session) || !isCurrentAnswered(session)) return session;
  return { ...session, position: session.position + 1 };
}

/** A saved game can only be resumed if every question (and its choices) still exists in the bank. */
export function isPlayableWith(session: Session, bank: QuestionBank): boolean {
  return session.plan.every((p) => {
    const q = bank.byId.get(p.questionId);
    if (!q || q.choices.length !== p.choiceOrder.length) return false;
    return p.choiceOrder.every((id) => q.choices.some((c) => c.id === id));
  });
}
