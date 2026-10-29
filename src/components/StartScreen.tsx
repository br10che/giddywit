import { GAME } from '../config';
import { utcDateKey } from '../game/daily';
import type { DailyEntry } from '../game/flow';
import { score } from '../game/session';
import { HowToSteps } from './HowToPlay';

interface Props {
  entry: DailyEntry;
  practiceInProgress: boolean;
  best: number;
  streak: number;
  persistent: boolean;
  now: number;
  onPlayDaily: () => void;
  onPractice: () => void;
  onHelp: () => void;
}

function prettyDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function StartScreen({ entry, practiceInProgress, best, streak, persistent, now, onPlayDaily, onPractice, onHelp }: Props) {
  const today = utcDateKey(new Date(now));
  let label = 'Play today';
  let note = `Today's ride · ${prettyDate(today)}`;
  if (entry.kind === 'resume') {
    const s = entry.session;
    label = s.dateKey === today ? 'Continue today’s ride' : `Finish your ${prettyDate(s.dateKey)} ride`;
    note = `${s.answers.length} of ${s.plan.length} answered · ${score(s)} pts`;
  } else if (entry.kind === 'results') {
    label = 'See today’s results';
    note = `Done for today · ${score(entry.session)} pts`;
  }

  return (
    <main className="start" aria-labelledby="game-title">
      <div className="start__hero">
        <h1 id="game-title" className="logo">{GAME.name}</h1>
        <p className="start__tagline">{GAME.tagline}</p>
      </div>
      <section className="start__panel panel" aria-label="Start">
        <HowToSteps />
        <div className="start__actions">
          <button type="button" className="btn btn--primary btn--big" onClick={onPlayDaily}>
            {label}
          </button>
          <p className="start__note">{note}</p>
          <button type="button" className="btn btn--secondary" onClick={onPractice}>
            {practiceInProgress ? 'Continue practice' : 'Practice'}
          </button>
          <button type="button" className="link-btn" onClick={onHelp}>
            How to play
          </button>
        </div>
        {(best > 0 || streak > 0) && (
          <p className="start__stats">
            Best daily <span className="pixel">{best.toLocaleString('en-US')}</span> · Streak <span className="pixel">{streak}</span>
          </p>
        )}
        {!persistent && (
          <p className="notice" role="note">
            This browser isn't letting {GAME.name} save, so progress will be lost if you close the page.
          </p>
        )}
      </section>
    </main>
  );
}
