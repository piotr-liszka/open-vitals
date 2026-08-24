import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import Toggle from './Toggle.svelte';

afterEach(cleanup);

describe('Toggle', () => {
  it('renders a switch reflecting the checked state', () => {
    render(Toggle, { props: { checked: true, label: 'Advanced mode' } });
    const el = screen.getByRole('switch', { name: 'Advanced mode' });
    expect(el.getAttribute('aria-checked')).toBe('true');
  });

  it('requests the opposite value on click without flipping itself', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { checked: false, label: 'x', onchange } });
    const el = screen.getByRole('switch');
    await fireEvent.click(el);
    expect(onchange).toHaveBeenCalledWith(true);
    // Controlled: unchanged until the parent updates `checked`.
    expect(el.getAttribute('aria-checked')).toBe('false');
  });

  it('does not fire onchange when disabled or loading', async () => {
    const onchange = vi.fn();
    const { rerender } = render(Toggle, { props: { checked: false, label: 'x', disabled: true, onchange } });
    await fireEvent.click(screen.getByRole('switch'));
    expect(onchange).not.toHaveBeenCalled();

    await rerender({ checked: false, label: 'x', disabled: false, loading: true, onchange });
    await fireEvent.click(screen.getByRole('switch'));
    expect(onchange).not.toHaveBeenCalled();
  });
});
