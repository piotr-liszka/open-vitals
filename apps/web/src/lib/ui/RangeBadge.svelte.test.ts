import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import RangeBadge from './RangeBadge.svelte';
import Card from './Card.svelte';

afterEach(cleanup);

describe('RangeBadge', () => {
  it('shows the active range as visible text, not only on hover', () => {
    render(RangeBadge, { props: { label: '30 dni' } });
    expect(screen.getByText('30 dni')).toBeTruthy();
  });

  it('explains itself and points at the switch in the tooltip', () => {
    const { container } = render(RangeBadge, { props: { label: '1 rok' } });
    const title = container.querySelector('.range-badge')?.getAttribute('title') ?? '';
    expect(title).toContain('1 rok');
    expect(title).toContain('na górze strony');
  });

  it('says what one point covers once the series is bucketed', () => {
    const { container } = render(RangeBadge, {
      props: { label: 'cały czas (od 2021-03-04)', bucketNoun: 'miesiąc' }
    });
    expect(container.querySelector('.range-badge')?.getAttribute('title')).toContain(
      'Jeden punkt to miesiąc.'
    );
  });

  it('omits the bucket sentence for a day-by-day range', () => {
    const { container } = render(RangeBadge, { props: { label: '7 dni' } });
    expect(container.querySelector('.range-badge')?.getAttribute('title')).not.toContain('Jeden punkt');
  });
});

describe('Card range indicator', () => {
  it('marks a card that follows the range', () => {
    render(Card, { props: { title: 'Objętość', range: '30 dni' } });
    expect(screen.getByText('30 dni')).toBeTruthy();
  });

  it('leaves a card that ignores the range unmarked', () => {
    // Absence is meaningful: no badge means the number is not windowed.
    const { container } = render(Card, { props: { title: 'Dziś' } });
    expect(container.querySelector('.range-badge')).toBeNull();
  });

  it('renders a header for a range-only card (no title, no actions)', () => {
    const { container } = render(Card, { props: { range: '14 dni' } });
    expect(container.querySelector('.card-header')).not.toBeNull();
    expect(container.querySelector('.range-badge')).not.toBeNull();
  });
});
