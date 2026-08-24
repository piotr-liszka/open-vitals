import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import RankMedal from './RankMedal.svelte';

afterEach(cleanup);

describe('RankMedal', () => {
  it.each([
    [1, 'gold'],
    [2, 'silver'],
    [3, 'bronze'],
    [4, 'plain'],
    [12, 'plain']
  ])('maps rank %i to the %s tone', (rank, tone) => {
    const { container } = render(RankMedal, { props: { rank } });
    expect(container.querySelector('.medal')?.classList.contains(tone)).toBe(true);
  });

  it('prints the rank so the order survives greyscale and screen readers', () => {
    const { container } = render(RankMedal, { props: { rank: 2 } });
    expect(container.querySelector('.medal')?.textContent?.trim()).toBe('2');
    expect(container.querySelector('.medal')?.getAttribute('aria-label')).toBe('2. miejsce');
  });

  it('shows a label instead of the number when one is given', () => {
    const { container } = render(RankMedal, {
      props: { rank: 1, label: 'PR', ariaLabel: 'Rekord życiowy' }
    });
    const medal = container.querySelector('.medal');
    expect(medal?.textContent?.trim()).toBe('PR');
    expect(medal?.getAttribute('aria-label')).toBe('Rekord życiowy');
    // A two-character label gets the wider padding; a bare ordinal does not.
    expect(medal?.classList.contains('wide')).toBe(true);
  });

  it('keeps the bare ordinal narrow', () => {
    const { container } = render(RankMedal, { props: { rank: 3 } });
    expect(container.querySelector('.medal')?.classList.contains('wide')).toBe(false);
  });
});
