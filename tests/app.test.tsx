import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { GameStorage, memoryKeyValue } from '../src/game/storage';
import { setReducedMotion } from './setup';
import { fakeBank } from './helpers';

const bank = fakeBank();
const DAY = Date.parse('2026-11-05T12:00:00Z');

function setup(store = new GameStorage(memoryKeyValue()), now = DAY) {
  store.savePrefs({ sound: false, seenHelp: true });
  const utils = render(<App storage={store} bank={bank} clock={() => now} />);
  return { store, ...utils };
}

const answerButtons = () => screen.getAllByRole('button').filter((b) => b.classList.contains('answer'));
const scoreText = () => document.querySelector('.hud .stat:nth-child(2) .stat__value')!.textContent;

describe('App', () => {
  it('plays with keys 1–4, marks the answer, and awards points once', () => {
    setReducedMotion(true);
    const { store } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play today' }));
    expect(screen.getByText('1', { selector: '.stat__value' })).toBeTruthy();

    // the correct choice ("… right") is somewhere in the shuffled list
    const idx = answerButtons().findIndex((b) => b.textContent!.includes('right'));
    fireEvent.keyDown(window, { key: String(idx + 1) });
    expect(screen.getByRole('status').textContent).toMatch(/Correct! Plus 50 points/);
    expect(answerButtons()[idx].getAttribute('data-state')).toBe('correct');
    expect(answerButtons()[idx].textContent).toMatch(/Your answer — correct/);

    // more key presses and clicks can't add points
    fireEvent.keyDown(window, { key: String(idx + 1) });
    fireEvent.click(answerButtons()[idx]);
    expect(scoreText()).toBe('50');
    expect(store.loadActiveDaily()!.answers).toHaveLength(1);
  });

  it('restores the same question, feedback and score after a refresh', () => {
    setReducedMotion(true);
    const store = new GameStorage(memoryKeyValue());
    const first = setup(store);
    fireEvent.click(screen.getByRole('button', { name: 'Play today' }));
    const question = screen.getByRole('heading', { level: 2 }).textContent;
    const order = answerButtons().map((b) => b.querySelector('.answer__text')!.textContent);
    const wrong = answerButtons().findIndex((b) => !b.textContent!.includes('right'));
    fireEvent.click(answerButtons()[wrong]);
    first.unmount();

    setup(store);
    fireEvent.click(screen.getByRole('button', { name: /Continue today/ }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(question);
    expect(answerButtons().map((b) => b.querySelector('.answer__text')!.textContent)).toEqual(order);
    expect(answerButtons()[wrong].getAttribute('data-state')).toBe('wrong');
    expect(screen.getByRole('button', { name: 'Next question' })).toBeTruthy();
    expect(scoreText()).toBe('0');
  });

  it('finishes after ten questions and shows results instead of a replay', () => {
    setReducedMotion(true);
    const store = new GameStorage(memoryKeyValue());
    const first = setup(store);
    fireEvent.click(screen.getByRole('button', { name: 'Play today' }));
    for (let i = 0; i < 10; i++) {
      const idx = answerButtons().findIndex((b) => b.textContent!.includes('right'));
      fireEvent.click(answerButtons()[idx]);
      fireEvent.click(screen.getByRole('button', { name: i === 9 ? 'See results' : 'Next question' }));
    }
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/1,500/);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('strip__cell'))).toHaveLength(10);
    first.unmount();

    setup(store);
    fireEvent.click(screen.getByRole('button', { name: /See today’s results/ }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/1,500/);
    expect(store.loadDailyResults()['2026-11-05'].answers).toHaveLength(10);
  });

  it('keeps practice separate from the daily game', () => {
    setReducedMotion(true);
    const { store } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play today' }));
    const idx = answerButtons().findIndex((b) => b.textContent!.includes('right'));
    fireEvent.click(answerButtons()[idx]);
    fireEvent.click(screen.getByRole('button', { name: 'Back to start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    fireEvent.click(answerButtons()[0]);
    expect(store.loadActiveDaily()!.answers).toHaveLength(1);
    expect(store.loadActivePractice()!.answers).toHaveLength(1);
    expect(store.loadActivePractice()!.id).not.toBe(store.loadActiveDaily()!.id);
  });

  it('counts the score up over time when motion is allowed', async () => {
    setReducedMotion(false);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play today' }));
    const idx = answerButtons().findIndex((b) => b.textContent!.includes('right'));
    fireEvent.click(answerButtons()[idx]);
    expect(scoreText()).toBe('0');
    await waitFor(() => expect(scoreText()).toBe('50'), { timeout: 4000 });
  });

  it('does not answer with number keys while the help dialog is open', () => {
    setReducedMotion(true);
    const { store } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play today' }));
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    fireEvent.keyDown(window, { key: '1' });
    expect(store.loadActiveDaily()!.answers).toHaveLength(0);
  });
});
