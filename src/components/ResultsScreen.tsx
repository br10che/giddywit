import { useRef, useState } from 'react';
import { DIFFICULTY_INFO, GAME, MAX_SCORE, QUESTIONS_PER_GAME, trailPercent } from '../config';
import type { QuestionBank } from '../game/bank';
import { challengeNumber, msUntilNextUtcMidnight, utcDateKey } from '../game/daily';
import { correctCount, score } from '../game/session';
import { buildShareText, copyText, shareUrl } from '../game/share';
import type { Session } from '../game/types';
import { useNow } from '../hooks';
import { regionAt } from '../scene/world';
import { CheckIcon, CrossIcon } from './Icons';

interface Props {
  session: Session;
  bank: QuestionBank;
  best: number;
  streak: number;
  todayPlayed: boolean;
  onPractice: () => void;
  onPlayToday: () => void;
  onHome: () => void;
}

export function messageFor(points: number): string {
  if (points >= MAX_SCORE) return "A perfect ride! You reached Trail's End with every answer right.";
  if (points >= 1200) return 'Sharpshooter! Barely a wrong turn all day.';
  if (points >= 800) return 'Fine riding, partner — the frontier opened right up.';
  if (points >= 400) return 'A solid day on the trail. The canyon is calling.';
  if (points > 0) return 'Every step on the trail counts. Saddle up again tomorrow.';
  return 'The horse needed a rest today. Tomorrow is a fresh trail.';
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function ResultsScreen({ session, bank, best, streak, todayPlayed, onPractice, onPlayToday, onHome }: Props) {
  const now = useNow(1000);
  const total = score(session);
  const correct = correctCount(session);
  const daily = session.mode === 'daily';
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const shareText = buildShareText(session, shareUrl());
  const today = utcDateKey(new Date(now));
  const newDayReady = daily && session.dateKey !== today && !todayPlayed;

  const onShare = async () => {
    const ok = await copyText(shareText);
    setShareState(ok ? 'copied' : 'manual');
    if (ok) window.setTimeout(() => setShareState('idle'), 2500);
    else window.setTimeout(() => manualRef.current?.select(), 0);
  };

  return (
    <main className="results" aria-labelledby="results-title">
      <article className="card panel results__card">
        <p className="results__kicker">
          {daily
            ? `Daily ride${challengeNumber(session.dateKey) >= 1 ? ` #${challengeNumber(session.dateKey)}` : ''} · ${session.dateKey}`
            : 'Practice ride'}
        </p>
        <h1 id="results-title" className="results__score">
          <span className="pixel">{total.toLocaleString('en-US')}</span>
          <small> / {MAX_SCORE.toLocaleString('en-US')}</small>
        </h1>
        <p className="results__message">{messageFor(total)}</p>

        <dl className="results__stats">
          <div>
            <dt>Trail</dt>
            <dd className="pixel">{trailPercent(total)}%</dd>
          </div>
          <div>
            <dt>Correct</dt>
            <dd className="pixel">{correct}/{QUESTIONS_PER_GAME}</dd>
          </div>
          <div>
            <dt>{daily ? 'Best daily' : 'Best practice'}</dt>
            <dd className="pixel">{best.toLocaleString('en-US')}</dd>
          </div>
          {daily && (
            <div>
              <dt>Streak</dt>
              <dd className="pixel">{streak}</dd>
            </div>
          )}
        </dl>
        <p className="results__place">Reached: <strong>{regionAt(Math.min(1, total / MAX_SCORE)).name}</strong></p>

        <ol className="strip" aria-label="Your ten answers">
          {session.plan.map((p, i) => {
            const a = session.answers[i];
            const q = bank.byId.get(p.questionId);
            const d = q ? DIFFICULTY_INFO[q.difficulty].label : '';
            return (
              <li
                key={p.questionId}
                className={`strip__cell ${a?.correct ? 'is-right' : 'is-wrong'}`}
                aria-label={`Question ${i + 1}, ${d}: ${a?.correct ? 'correct' : 'incorrect'}`}
              >
                {a?.correct ? <CheckIcon /> : <CrossIcon />}
              </li>
            );
          })}
        </ol>

        <div className="results__actions">
          {daily && (
            <button type="button" className="btn btn--primary" onClick={onShare}>
              {shareState === 'copied' ? 'Copied!' : 'Share result'}
            </button>
          )}
          {newDayReady && (
            <button type="button" className="btn btn--primary" onClick={onPlayToday}>
              Play today's ride
            </button>
          )}
          <button type="button" className={`btn ${daily ? 'btn--secondary' : 'btn--primary'}`} onClick={onPractice}>
            {daily ? 'Practice' : 'Practice again'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onHome}>
            Home
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {shareState === 'copied' ? 'Result copied to clipboard.' : shareState === 'manual' ? 'Copy the result text below.' : ''}
        </p>

        {shareState === 'manual' && (
          <div className="share-fallback">
            <label htmlFor="share-text">Copying isn't available here — select and copy this:</label>
            <textarea id="share-text" ref={manualRef} readOnly value={shareText} rows={4} onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}

        {daily && (
          <p className="results__next">
            Next daily ride in <span className="pixel">{formatCountdown(msUntilNextUtcMidnight(now))}</span>
            <span className="results__next-note"> · resets at midnight UTC</span>
          </p>
        )}

        <details className="review">
          <summary>Review answers</summary>
          <ol className="review__list">
            {session.plan.map((p, i) => {
              const q = bank.byId.get(p.questionId);
              const a = session.answers[i];
              if (!q || !a) return null;
              const picked = q.choices.find((c) => c.id === a.choiceId)?.text;
              const right = q.choices.find((c) => c.id === q.answerId)?.text;
              return (
                <li key={q.id} className={`review__item ${a.correct ? 'is-right' : 'is-wrong'}`}>
                  <p className="review__q">
                    <span className="review__n pixel">{i + 1}</span> {q.question}
                  </p>
                  <p className="review__a">
                    {a.correct ? <CheckIcon /> : <CrossIcon />}
                    {a.correct ? (
                      <span><strong>{right}</strong> — correct, +{a.points}</span>
                    ) : (
                      <span>
                        {a.timedOut ? 'Time ran out.' : `You said ${picked}.`} Answer: <strong>{right}</strong>
                      </span>
                    )}
                  </p>
                  <p className="review__why">
                    {q.explanation}{' '}
                    <a href={q.source} target="_blank" rel="noopener noreferrer">
                      Source<span className="sr-only"> (opens in a new tab)</span> ↗
                    </a>
                  </p>
                </li>
              );
            })}
          </ol>
        </details>
        <p className="fine-print fine-print--center">Scores live only in this browser — {GAME.name} has no accounts or leaderboard.</p>
      </article>
    </main>
  );
}
