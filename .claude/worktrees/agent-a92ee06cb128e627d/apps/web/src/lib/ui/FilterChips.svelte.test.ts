import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import FilterChips from './FilterChips.svelte';

afterEach(cleanup);

const options = [
  { value: 'cycling', label: 'Rower' },
  { value: 'running', label: 'Bieg' },
  { value: 'walking', label: 'Marsz' },
  { value: 'hiking', label: 'Wędrówka' },
  { value: 'swimming', label: 'Pływanie' },
  { value: 'inline_skating', label: 'Rolki' },
  { value: 'indoor_cardio', label: 'Trening cardio' }
];

function chips(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

function labels(container: HTMLElement): string[] {
  return chips(container).map((c) => c.textContent?.trim() ?? '');
}

describe('FilterChips', () => {
  it('renders a labelled group with the all chip plus at most maxVisible options', () => {
    const { container, getByRole } = render(FilterChips, {
      props: { options, value: null, onSelect: vi.fn(), ariaLabel: 'Sport' }
    });

    expect(getByRole('group').getAttribute('aria-label')).toBe('Sport');
    expect(labels(container)).toEqual([
      'Wszystkie',
      'Rower',
      'Bieg',
      'Marsz',
      'Wędrówka',
      'Pływanie',
      '+ 2 więcej'
    ]);
  });

  it('marks the active chip with aria-pressed', () => {
    const { container } = render(FilterChips, {
      props: { options, value: 'running', onSelect: vi.fn(), ariaLabel: 'Sport' }
    });

    const pressed = chips(container).filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((c) => c.textContent?.trim())).toEqual(['Bieg']);
  });

  it('selects the all chip when nothing is filtered', () => {
    const { container } = render(FilterChips, {
      props: { options, value: null, onSelect: vi.fn(), ariaLabel: 'Sport' }
    });
    expect(chips(container)[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('fires onSelect with the value, and null for the all chip', async () => {
    const onSelect = vi.fn();
    const { container } = render(FilterChips, {
      props: { options, value: 'cycling', onSelect, ariaLabel: 'Sport' }
    });

    await fireEvent.click(chips(container)[2]!); // "Bieg"
    expect(onSelect).toHaveBeenLastCalledWith('running');

    await fireEvent.click(chips(container)[0]!); // "Wszystkie"
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('expands and collapses the tail via a real button with aria-expanded', async () => {
    const { container, getByRole } = render(FilterChips, {
      props: { options, value: null, onSelect: vi.fn(), ariaLabel: 'Sport' }
    });

    const more = getByRole('button', { name: '+ 2 więcej' });
    expect(more.tagName).toBe('BUTTON');
    expect(more.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.click(more);
    expect(labels(container)).toEqual([
      'Wszystkie',
      'Rower',
      'Bieg',
      'Marsz',
      'Wędrówka',
      'Pływanie',
      'Rolki',
      'Trening cardio',
      'Mniej'
    ]);
    expect(getByRole('button', { name: 'Mniej' }).getAttribute('aria-expanded')).toBe('true');

    await fireEvent.click(getByRole('button', { name: 'Mniej' }));
    expect(labels(container)).toEqual([
      'Wszystkie',
      'Rower',
      'Bieg',
      'Marsz',
      'Wędrówka',
      'Pływanie',
      '+ 2 więcej'
    ]);
  });

  it('keeps a selected option visible even when it sits outside the collapsed head', () => {
    const { container } = render(FilterChips, {
      props: { options, value: 'indoor_cardio', onSelect: vi.fn(), ariaLabel: 'Sport' }
    });

    expect(labels(container)).toEqual([
      'Wszystkie',
      'Rower',
      'Bieg',
      'Marsz',
      'Wędrówka',
      'Pływanie',
      'Trening cardio',
      '+ 1 więcej'
    ]);
    const pressed = chips(container).filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((c) => c.textContent?.trim())).toEqual(['Trening cardio']);
  });

  it('renders no expander when everything fits', () => {
    const { container } = render(FilterChips, {
      props: { options: options.slice(0, 3), value: null, onSelect: vi.fn(), ariaLabel: 'Sport' }
    });
    expect(labels(container)).toEqual(['Wszystkie', 'Rower', 'Bieg', 'Marsz']);
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('honours maxVisible, a custom all label and custom expander copy', () => {
    const { container } = render(FilterChips, {
      props: {
        options,
        value: null,
        onSelect: vi.fn(),
        ariaLabel: 'Sport',
        allLabel: 'Dowolny',
        maxVisible: 2,
        expandLabel: (n: number) => `więcej (${n})`
      }
    });
    expect(labels(container)).toEqual(['Dowolny', 'Rower', 'Bieg', 'więcej (5)']);
  });

  it('can hide the all chip', () => {
    const { container } = render(FilterChips, {
      props: {
        options: options.slice(0, 2),
        value: 'cycling',
        onSelect: vi.fn(),
        ariaLabel: 'Sport',
        allLabel: null
      }
    });
    expect(labels(container)).toEqual(['Rower', 'Bieg']);
  });
});
