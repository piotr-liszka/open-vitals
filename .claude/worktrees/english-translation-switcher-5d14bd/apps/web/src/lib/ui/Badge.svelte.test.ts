import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Badge from './Badge.svelte';

afterEach(cleanup);

describe('Badge', () => {
  it('defaults to the neutral tone', () => {
    const { container } = render(Badge);
    const badge = container.querySelector('.badge');
    expect(badge?.classList.contains('neutral')).toBe(true);
  });

  it.each(['success', 'warning', 'danger', 'info'] as const)('maps tone "%s" to its class', (tone) => {
    const { container } = render(Badge, { props: { tone } });
    const badge = container.querySelector('.badge');
    expect(badge?.classList.contains(tone)).toBe(true);
  });
});
