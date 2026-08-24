import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Banner from './Banner.svelte';
import { createRawSnippet } from 'svelte';

afterEach(cleanup);

const message = createRawSnippet(() => ({
  render: () => '<span>Something to say</span>'
}));

describe('Banner', () => {
  it('defaults to the info tone with a polite status role', () => {
    const { container } = render(Banner);
    const el = container.querySelector('.banner');
    expect(el?.classList.contains('info')).toBe(true);
    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });

  it.each(['success', 'warning', 'danger'] as const)('maps tone "%s" to its class', (tone) => {
    const { container } = render(Banner, { props: { tone } });
    expect(container.querySelector('.banner')?.classList.contains(tone)).toBe(true);
  });

  it('announces danger and warning assertively via role=alert', () => {
    const danger = render(Banner, { props: { tone: 'danger' } });
    expect(danger.container.querySelector('.banner')?.getAttribute('role')).toBe('alert');
    expect(danger.container.querySelector('.banner')?.getAttribute('aria-live')).toBe('assertive');
    cleanup();

    const warning = render(Banner, { props: { tone: 'warning' } });
    expect(warning.container.querySelector('.banner')?.getAttribute('role')).toBe('alert');
  });

  it('renders a title and message body', () => {
    const { container } = render(Banner, {
      props: { title: 'Heads up', children: message }
    });
    expect(container.querySelector('.title')?.textContent).toContain('Heads up');
    expect(container.querySelector('.message')?.textContent).toContain('Something to say');
  });
});
