import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ScoreScale from './ScoreScale.svelte';

afterEach(cleanup);

const HINTS = { 1: 'bez śladu', 4: 'wyraźne zakwasy', 10: 'nie do ruszenia' };

/** Keys arrive on the focused radio, not the group — that is where the handler lives. */
function keyTarget(): HTMLElement {
  const radios = screen.getAllByRole('radio');
  return radios.find((r) => r.getAttribute('tabindex') === '0') ?? radios[0]!;
}

function setup(props: Partial<Record<string, unknown>> = {}) {
  const onchange = vi.fn();
  render(ScoreScale, {
    props: { label: 'Ból', value: null, hints: HINTS, onchange, ...props }
  });
  return { onchange };
}

describe('ScoreScale', () => {
  it('renders one radio per score in a labelled radiogroup', () => {
    setup({ ariaLabel: 'Ból w skali 1–10' });
    expect(screen.getByRole('radiogroup', { name: 'Ból w skali 1–10' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(10);
  });

  it('honours a non-default range', () => {
    setup({ min: 0, max: 4 });
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('marks the selected score and only that one', () => {
    setup({ value: 4 });
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]?.textContent?.trim()).toBe('4');
  });

  it('reports the picked score', async () => {
    const { onchange } = setup();
    await fireEvent.click(screen.getAllByRole('radio')[6]!);
    expect(onchange).toHaveBeenCalledWith(7);
  });

  it('clears when the selected score is picked again — the way back to "did not say"', async () => {
    const { onchange } = setup({ value: 7 });
    await fireEvent.click(screen.getAllByRole('radio')[6]!);
    expect(onchange).toHaveBeenCalledWith(null);
  });

  it('moves and selects with the arrow keys, and jumps with Home/End', async () => {
    const { onchange } = setup({ value: 5 });
    const key = keyTarget();
    await fireEvent.keyDown(key, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenLastCalledWith(6);
    await fireEvent.keyDown(key, { key: 'ArrowLeft' });
    expect(onchange).toHaveBeenLastCalledWith(4);
    await fireEvent.keyDown(key, { key: 'End' });
    expect(onchange).toHaveBeenLastCalledWith(10);
    await fireEvent.keyDown(key, { key: 'Home' });
    expect(onchange).toHaveBeenLastCalledWith(1);
  });

  it('stops dead at the ends: no wrap, and no accidental clear', async () => {
    const { onchange } = setup({ value: 10 });
    await fireEvent.keyDown(keyTarget(), { key: 'ArrowRight' });
    // Wrapping to 1 would be a silent data error, and re-picking 10 (the clear gesture) would wipe
    // the score for pressing a key that should do nothing.
    expect(onchange).not.toHaveBeenCalled();
  });

  it('commits the focused step on the first arrow when nothing is picked', async () => {
    const { onchange } = setup({ value: null });
    await fireEvent.keyDown(keyTarget(), { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith(1);
  });

  it('clears with Delete and Backspace, and stays quiet when nothing is picked', async () => {
    const { onchange } = setup({ value: 3 });
    await fireEvent.keyDown(keyTarget(), { key: 'Delete' });
    expect(onchange).toHaveBeenCalledWith(null);

    cleanup();
    const empty = setup({ value: null });
    await fireEvent.keyDown(keyTarget(), { key: 'Backspace' });
    expect(empty.onchange).not.toHaveBeenCalled();
  });

  it('is one tab stop: exactly one radio is reachable by Tab', () => {
    setup({ value: 4 });
    const reachable = screen.getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0');
    expect(reachable).toHaveLength(1);
    expect(reachable[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('says what the number means: the hint word, and both poles', () => {
    setup({ value: 4, lowLabel: 'bez śladu', highLabel: 'nie do ruszenia' });
    expect(screen.getByText('wyraźne zakwasy')).toBeTruthy();
    expect(screen.getByText('1 · bez śladu')).toBeTruthy();
    expect(screen.getByText('10 · nie do ruszenia')).toBeTruthy();
  });

  it('names each radio with its meaning for assistive tech', () => {
    setup({ value: null });
    expect(screen.getByRole('radio', { name: '4 — wyraźne zakwasy' })).toBeTruthy();
    // A score without a hint keeps the bare number.
    expect(screen.getByRole('radio', { name: '5' })).toBeTruthy();
  });

  it('shows the unset placeholder until something is picked', () => {
    setup({ value: null, unsetLabel: 'nie powiedziano' });
    expect(screen.getByText('nie powiedziano')).toBeTruthy();
  });

  it('takes the warning tone from the threshold up, not below it', () => {
    const { container } = render(ScoreScale, {
      props: { label: 'Ból', value: 4, warnFrom: 4, hints: HINTS, onchange: () => {} }
    });
    expect(container.querySelector('.track.warn')).toBeTruthy();

    cleanup();
    const under = render(ScoreScale, {
      props: { label: 'Ból', value: 3, warnFrom: 4, hints: HINTS, onchange: () => {} }
    });
    expect(under.container.querySelector('.track.warn')).toBeNull();
  });

  it('accepts nothing while disabled — click or key', async () => {
    const { onchange } = setup({ value: 3, disabled: true });
    await fireEvent.click(screen.getAllByRole('radio')[5]!);
    await fireEvent.keyDown(keyTarget(), { key: 'ArrowRight' });
    expect(onchange).not.toHaveBeenCalled();
  });
});
