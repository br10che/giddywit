import { useEffect, useRef } from 'react';
import { DIFFICULTIES, DIFFICULTY_INFO, GAME, MAX_SCORE, QUESTIONS_PER_GAME } from '../config';
import { CloseIcon } from './Icons';

export function HowToSteps() {
  return (
    <ol className="steps">
      <li>
        <span className="steps__num pixel">1</span>
        <span><strong>Answer</strong> ten general-knowledge questions, one at a time.</span>
      </li>
      <li>
        <span className="steps__num pixel">2</span>
        <span><strong>Earn more</strong> for harder questions — up to 250 points each.</span>
      </li>
      <li>
        <span className="steps__num pixel">3</span>
        <span><strong>Ride further</strong> along the trail with every point you earn.</span>
      </li>
    </ol>
  );
}

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="howto-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog__body panel">
        <button type="button" className="icon-btn dialog__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h2 id="howto-title" className="dialog__title">How to play</h2>
        <HowToSteps />
        <table className="points-table">
          <caption>Points per correct answer</caption>
          <tbody>
            {DIFFICULTIES.map((d, i) => (
              <tr key={d}>
                <th scope="row">Questions {i * 2 + 1}–{i * 2 + 2}</th>
                <td>{DIFFICULTY_INFO[d].label}</td>
                <td className="pixel">{DIFFICULTY_INFO[d].points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="fine-print">
          <li>One try per question. A wrong answer scores 0 but never costs you points.</li>
          <li>A perfect run of {QUESTIONS_PER_GAME} is {MAX_SCORE.toLocaleString('en-US')} points: the end of the trail.</li>
          <li>No timer — take as long as you like. Keys 1–4 pick an answer.</li>
          <li>Everyone gets the same daily ride. A new one starts at midnight UTC.</li>
          <li>Practice games are unlimited and don't affect your daily result.</li>
        </ul>
        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          Saddle up
        </button>
        <p className="fine-print fine-print--center">{GAME.name} keeps your progress in this browser only.</p>
      </div>
    </dialog>
  );
}
