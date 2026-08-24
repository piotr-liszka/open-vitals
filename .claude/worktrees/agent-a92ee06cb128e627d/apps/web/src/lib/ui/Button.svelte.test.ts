import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Button from './Button.svelte';

afterEach(cleanup);

function getButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector('button');
  if (!el) throw new Error('button not rendered');
  return el;
}

describe('Button', () => {
  it('defaults to a non-submitting primary md button', () => {
    const { container } = render(Button);
    const btn = getButton(container);
    expect(btn.type).toBe('button');
    expect(btn.classList.contains('primary')).toBe(true);
    expect(btn.classList.contains('md')).toBe(true);
    expect(btn.disabled).toBe(false);
  });

  it('applies the requested variant and size classes', () => {
    const { container } = render(Button, { props: { variant: 'danger', size: 'sm' } });
    const btn = getButton(container);
    expect(btn.classList.contains('danger')).toBe(true);
    expect(btn.classList.contains('sm')).toBe(true);
  });

  it('is disabled and busy while loading, and shows a spinner', () => {
    const { container } = render(Button, { props: { loading: true } });
    const btn = getButton(container);
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.classList.contains('is-loading')).toBe(true);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('respects the disabled prop', () => {
    const { container } = render(Button, { props: { disabled: true } });
    expect(getButton(container).disabled).toBe(true);
  });
});
