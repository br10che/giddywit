import { useEffect, useMemo, useRef, useState } from 'react';
import { DIFFICULTY_INFO, MAX_SCORE, QUESTIONS_PER_GAME, RIDE_DELAY_MS, rideDurationMs, trailPercent } from '../config';
import type { QuestionBank } from '../game/bank';
import { isCurrentAnswered, pointsFor, score } from '../game/session';
import type { Session } from '../game/types';
import { useCountUp } from '../hooks';
import type { SceneEvent } from '../scene/TrailScene';
import { REGIONS, regionIndexAt } from '../scene/world';
import { CheckIcon, CrossIcon } from './Icons';
import { TrailMap } from './TrailMap';

interface Props {
  session: Session;
  bank: QuestionBank;
  event: SceneEvent | null;
  reducedMotion: boolean;
  riderX: number;
  roadY: number;
  onAnswer: (choiceId: string) => void;
  onNext: () => void;
}

export function GameScreen({ session, bank, event, reducedMotion, riderX, roadY, onAnswer, onNext }: Props) {
  const planned = session.plan[session.position];
  const question = bank.byId.get(planned.questionId)!;
  const answered = isCurrentAnswered(session);
  const answer = answered ? session.answers[session.position] : null;
  const total = score(session);
  const lastGain = session.answers[session.answers.length - 1]?.points ?? 0;
  const shown = useCountUp(total, { delay: RIDE_DELAY_MS, duration: rideDurationMs(lastGain), instant: reducedMotion });
  const isLast = session.position === session.plan.length - 1;
  const points = pointsFor(question);
  const difficulty = DIFFICULTY_INFO[question.difficulty];
  const choices = useMemo(
    () => planned.choiceOrder.map((id) => question.choices.find((c) => c.id === id)!),
    [planned, question],
  );

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Focus follows the flow: new question → question text; answered → "Next".
  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
    else headingRef.current?.focus({ preventScroll: true });
  }, [answered, session.position]);

  // Keys 1–4 pick an answer.
  useEffect(() => {
    if (answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) {
        e.preventDefault();
        onAnswer(choices[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, choices, onAnswer]);

  // Announce the result for screen readers.
  const announcement = answer
    ? answer.correct
      ? `Correct! Plus ${answer.points} points. Score ${total} of ${MAX_SCORE}. Trail progress ${trailPercent(total)} percent.`
      : `Not quite. The answer is ${question.choices.find((c) => c.id === question.answerId)?.text}. Score stays at ${total}.`
    : '';

  // "Entering <region>" sign when the rider crosses into a new part of the trail.
  const region = regionIndexAt(total / MAX_SCORE);
  const prevRegion = useRef(region);
  const [banner, setBanner] = useState<{ name: string; key: number } | null>(null);
  useEffect(() => {
    if (region > prevRegion.current) setBanner({ name: REGIONS[region].name, key: Date.now() });
    prevRegion.current = region;
  }, [region]);

  const correctText = question.choices.find((c) => c.id === question.answerId)?.text ?? '';

  return (
    <main className="play" aria-labelledby="question-text">
      <section className="hud" aria-label="Progress">
        <div className="hud__stats">
          <div className="stat">
            <span className="stat__label">Question</span>
            <span className="stat__value pixel">
              {session.position + 1}<small> of {QUESTIONS_PER_GAME}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Score</span>
            <span className="stat__value pixel">{shown.toLocaleString('en-US')}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Trail</span>
            <span className="stat__value pixel">{trailPercent(shown)}%</span>
          </div>
        </div>
        <TrailMap points={shown} />
      </section>

      {event?.type === 'correct' && answer?.correct && (
        <span
          key={event.id}
          className={`float-points pixel${reducedMotion ? ' float-points--still' : ''}`}
          style={{ left: riderX, top: roadY }}
          aria-hidden="true"
        >
          +{answer.points}
        </span>
      )}
      {banner && (
        <div key={banner.key} className="region-banner" aria-hidden="true" onAnimationEnd={() => setBanner(null)}>
          <span className="region-banner__small">Entering</span>
          {banner.name}
        </div>
      )}

      <article className="card panel" data-state={answered ? 'answered' : 'asking'}>
        <header className="card__meta">
          <span className={`badge badge--${question.difficulty}`}>{difficulty.label}</span>
          <span className="card__points pixel">{points} pts</span>
          <span className="card__category">{question.category}</span>
        </header>

        <h2 id="question-text" className="card__question" ref={headingRef} tabIndex={-1}>
          {question.question}
        </h2>

        <ol className="answers" aria-label="Answers">
          {choices.map((c, i) => {
            const isPicked = answer?.choiceId === c.id;
            const isRight = c.id === question.answerId;
            const state = !answer ? 'open' : isRight ? 'correct' : isPicked ? 'wrong' : 'dim';
            const label = !answer ? '' : isRight && isPicked ? 'Your answer — correct' : isRight ? 'Correct answer' : isPicked ? 'Your answer' : '';
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="answer"
                  data-state={state}
                  disabled={!!answer}
                  onClick={() => onAnswer(c.id)}
                  aria-keyshortcuts={String(i + 1)}
                >
                  <span className="answer__key pixel" aria-hidden="true">{i + 1}</span>
                  <span className="answer__text">{c.text}</span>
                  {answer && (isRight || isPicked) && (
                    <span className="answer__mark">
                      {isRight ? <CheckIcon /> : <CrossIcon />}
                      <span className="answer__mark-text">{label}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {answer && (
          <div className={`feedback feedback--${answer.correct ? 'right' : 'wrong'}`}>
            <p className="feedback__title">
              {answer.correct ? (
                <>
                  <CheckIcon /> Correct! <span className="pixel feedback__gain">+{answer.points}</span>
                </>
              ) : (
                <>
                  <CrossIcon /> Not this time — it's <strong>{correctText}</strong>.
                </>
              )}
            </p>
            <p className="feedback__why">{question.explanation}</p>
            <p className="feedback__source">
              <a href={question.source} target="_blank" rel="noopener noreferrer">
                Source<span className="sr-only"> (opens in a new tab)</span> ↗
              </a>
            </p>
            <button type="button" ref={nextRef} className="btn btn--primary btn--block" onClick={onNext}>
              {isLast ? 'See results' : 'Next question'}
            </button>
          </div>
        )}
      </article>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </main>
  );
}
