import { GAME, MAX_SCORE, trailPercent } from '../config';
import { challengeNumber } from './daily';
import { score } from './session';
import type { Session } from './types';

/** Spoiler-free summary: no questions or answers. */
export function buildShareText(session: Session, url: string): string {
  const total = score(session);
  const marks = session.plan.map((_, i) => (session.answers[i]?.correct ? '✅' : '❌')).join('');
  const n = challengeNumber(session.dateKey);
  const lines = [
    `${GAME.name}${n >= 1 ? ` #${n}` : ''} · ${session.dateKey}`,
    `${total.toLocaleString('en-US')}/${MAX_SCORE.toLocaleString('en-US')} pts · Trail ${trailPercent(total)}%`,
    marks,
  ];
  if (url) lines.push(url);
  return lines.join('\n');
}

export function shareUrl(): string {
  if (GAME.shareUrl) return GAME.shareUrl;
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return origin.startsWith('http') ? origin + pathname : '';
}

/** Copy text; returns false if every method failed (the UI then shows the text to copy by hand). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
