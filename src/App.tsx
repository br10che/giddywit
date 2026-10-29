import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_SCORE, RIDE_DELAY_MS, rideDurationMs } from './config';
import { BANK } from './content/bank';
import { playClick, playCorrect, playFinish, playWrong, setSoundEnabled, unlockAudio } from './audio/sound';
import type { QuestionBank } from './game/bank';
import { utcDateKey } from './game/daily';
import { currentStreak, newDailySession, resolveDaily } from './game/flow';
import { buildPracticePlan } from './game/practice';
import { createSession, goToNext, isFinished, isPlayableWith, score, submitAnswer } from './game/session';
import { GameStorage, type Prefs } from './game/storage';
import type { Session } from './game/types';
import { GameScreen } from './components/GameScreen';
import { HowToPlay } from './components/HowToPlay';
import { ResultsScreen } from './components/ResultsScreen';
import { StartScreen } from './components/StartScreen';
import { TopBar } from './components/TopBar';
import { useNow, useReducedMotion, useViewport } from './hooks';
import { TrailScene, type SceneEvent } from './scene/TrailScene';

type Screen = { name: 'start' } | { name: 'play'; session: Session } | { name: 'results'; session: Session };

interface Props {
  storage?: GameStorage;
  bank?: QuestionBank;
  /** Clock override for tests. */
  clock?: () => number;
}

/** Where the road and rider sit on each screen, in CSS pixels. */
function sceneLayout(screen: Screen['name'], vw: number, vh: number) {
  const wide = vw >= 900;
  if (screen === 'start') {
    return wide
      ? { roadY: Math.round(vh * 0.7), riderX: Math.round(vw * 0.7) }
      : { roadY: Math.round(Math.min(Math.max(vh * 0.4, 230), 330)), riderX: Math.round(vw * 0.55) };
  }
  return wide
    ? { roadY: Math.round(vh * 0.64), riderX: Math.round(Math.min(vw * 0.25, vw - 560)) }
    : { roadY: Math.round(Math.min(Math.max(vh * 0.34, 226), 270)), riderX: Math.round(vw * 0.3) };
}

/** Dev only: `?trail=0.75` previews any point of the journey on the start screen. */
function devPreviewPoints(): number {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 0;
  const v = Number(new URLSearchParams(window.location.search).get('trail'));
  return Number.isFinite(v) && v > 0 ? Math.round(Math.min(1, v) * MAX_SCORE) : 0;
}

export default function App({ storage: injected, bank = BANK, clock = Date.now }: Props) {
  const storage = useMemo(() => injected ?? new GameStorage(), [injected]);
  const [prefs, setPrefs] = useState<Prefs>(() => storage.loadPrefs());
  const [helpOpen, setHelpOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [event, setEvent] = useState<SceneEvent | null>(null);
  const [, setVersion] = useState(0);
  const reducedMotion = useReducedMotion();
  const { width, height } = useViewport();
  const now = useNow(15_000);
  const eventId = useRef(0);

  useEffect(() => setSoundEnabled(prefs.sound), [prefs.sound]);

  // First visit: explain the game once.
  useEffect(() => {
    if (!prefs.seenHelp) setHelpOpen(true);
  }, []);

  // Re-read storage whenever we need fresh stats (cheap: small JSON).
  const today = utcDateKey(new Date(clock()));
  const results = storage.loadDailyResults();
  const stats = storage.loadStats();
  const entry = resolveDaily(today, storage.loadActiveDaily(), results, bank);
  const activePractice = storage.loadActivePractice();
  const practiceInProgress = !!activePractice && !isFinished(activePractice) && isPlayableWith(activePractice, bank);
  const streak = currentStreak(today, results);
  void now;

  const updatePrefs = (next: Prefs) => {
    setPrefs(next);
    storage.savePrefs(next);
  };

  const openHelp = () => {
    setHelpOpen(true);
  };
  const closeHelp = () => {
    setHelpOpen(false);
    if (!prefs.seenHelp) updatePrefs({ ...prefs, seenHelp: true });
  };

  const show = (s: Session) => {
    setEvent(null);
    setScreen(isFinished(s) ? { name: 'results', session: s } : { name: 'play', session: s });
  };

  const playDaily = () => {
    unlockAudio();
    playClick();
    const fresh = resolveDaily(utcDateKey(new Date(clock())), storage.loadActiveDaily(), storage.loadDailyResults(), bank);
    if (fresh.kind === 'new') {
      const s = newDailySession(fresh.dateKey, bank, clock());
      storage.saveSession(s);
      show(s);
    } else if (fresh.kind === 'results') {
      setEvent(null);
      setScreen({ name: 'results', session: fresh.session });
    } else {
      show(fresh.session);
    }
  };

  const playPractice = () => {
    unlockAudio();
    playClick();
    const active = storage.loadActivePractice();
    if (active && !isFinished(active) && isPlayableWith(active, bank)) {
      show(active);
      return;
    }
    const day = utcDateKey(new Date(clock()));
    const todays = storage.loadActiveDaily();
    const avoid = new Set([...storage.loadStats().recentPractice, ...(todays?.dateKey === day ? todays.plan.map((p) => p.questionId) : [])]);
    const seed = (clock() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const s = createSession({
      mode: 'practice',
      id: `practice:${seed}`,
      dateKey: day,
      contentVersion: bank.version,
      plan: buildPracticePlan(seed, bank, avoid),
      now: clock(),
    });
    storage.saveSession(s);
    show(s);
  };

  const current = screen.name === 'play' ? screen.session : null;

  const answer = useCallback(
    (choiceId: string) => {
      if (!current) return;
      const next = submitAnswer(current, choiceId, bank, clock());
      if (next === current) return; // already answered — nothing can be awarded twice
      storage.saveSession(next); // persist before any animation starts
      setScreen({ name: 'play', session: next });
      const record = next.answers[next.answers.length - 1];
      unlockAudio();
      if (record.correct) playCorrect(rideDurationMs(record.points), RIDE_DELAY_MS);
      else playWrong();
      setEvent({ type: record.correct ? 'correct' : 'wrong', id: ++eventId.current });
    },
    [current, bank, clock, storage],
  );

  const goNext = () => {
    if (!current) return;
    const next = goToNext(current);
    if (next === current) return;
    storage.saveSession(next);
    playClick();
    if (isFinished(next)) {
      if (next.mode === 'practice') storage.clearActivePractice();
      playFinish();
      setScreen({ name: 'results', session: next });
    } else {
      setScreen({ name: 'play', session: next });
    }
    setVersion((v) => v + 1);
  };

  const goHome = () => {
    setEvent(null);
    setScreen({ name: 'start' });
  };

  const layout = sceneLayout(screen.name, width, height);
  const scenePoints = screen.name === 'start' ? devPreviewPoints() : score(screen.session);
  const snapKey = screen.name === 'start' ? 'start' : `${screen.name}:${screen.session.id}`;

  return (
    <div className={`app app--${screen.name}`}>
      <TrailScene
        points={scenePoints}
        event={event}
        roadY={layout.roadY}
        riderX={layout.riderX}
        reducedMotion={reducedMotion}
        snapKey={snapKey}
      />
      <div className="app__ui" style={{ ['--road-y' as string]: `${layout.roadY}px` }}>
        <TopBar
          sound={prefs.sound}
          onToggleSound={() => {
            const sound = !prefs.sound;
            setSoundEnabled(sound);
            updatePrefs({ ...prefs, sound });
            if (sound) {
              unlockAudio();
              playClick();
            }
          }}
          onHelp={openHelp}
          onHome={screen.name === 'start' ? undefined : goHome}
          showLogo={screen.name !== 'start'}
        />
        {screen.name === 'start' && (
          <StartScreen
            entry={entry}
            practiceInProgress={practiceInProgress}
            best={stats.bestDaily}
            streak={streak}
            persistent={storage.persistent}
            now={clock()}
            onPlayDaily={playDaily}
            onPractice={playPractice}
            onHelp={openHelp}
          />
        )}
        {screen.name === 'play' && (
          <GameScreen
            key={screen.session.id}
            session={screen.session}
            bank={bank}
            event={event}
            reducedMotion={reducedMotion}
            riderX={layout.riderX}
            roadY={layout.roadY}
            onAnswer={answer}
            onNext={goNext}
          />
        )}
        {screen.name === 'results' && (
          <ResultsScreen
            session={screen.session}
            bank={bank}
            best={screen.session.mode === 'daily' ? stats.bestDaily : stats.bestPractice}
            streak={streak}
            todayPlayed={!!results[today]}
            onPractice={playPractice}
            onPlayToday={playDaily}
            onHome={goHome}
          />
        )}
      </div>
      <HowToPlay open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
