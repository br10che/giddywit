import { GAME } from '../config';
import { HelpIcon, HomeIcon, SoundIcon } from './Icons';

interface Props {
  sound: boolean;
  onToggleSound: () => void;
  onHelp: () => void;
  onHome?: () => void;
  showLogo: boolean;
}

export function TopBar({ sound, onToggleSound, onHelp, onHome, showLogo }: Props) {
  return (
    <header className="topbar">
      {showLogo ? (
        <button type="button" className="topbar__logo" onClick={onHome} aria-label={`${GAME.name} — back to start`}>
          {GAME.name}
        </button>
      ) : (
        <span />
      )}
      <nav className="topbar__actions" aria-label="Game controls">
        {onHome && (
          <button type="button" className="icon-btn" onClick={onHome} aria-label="Back to start">
            <HomeIcon />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onHelp} aria-label="How to play">
          <HelpIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleSound}
          aria-pressed={sound}
          aria-label={sound ? 'Sound on — turn off' : 'Sound off — turn on'}
        >
          <SoundIcon on={sound} />
        </button>
      </nav>
    </header>
  );
}
