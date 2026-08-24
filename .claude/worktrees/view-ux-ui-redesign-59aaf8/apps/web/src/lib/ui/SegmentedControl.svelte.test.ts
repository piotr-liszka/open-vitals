import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import SegmentedControl from './SegmentedControl.svelte';

afterEach(cleanup);

const options = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' }
];

function segments(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('[role="radio"]'));
}

function seg(container: HTMLElement, index: number): HTMLButtonElement {
  const el = segments(container)[index];
  if (!el) throw new Error(`no segment at index ${index}`);
  return el;
}

describe('SegmentedControl', () => {
  it('renders a labelled radiogroup with every option', () => {
    const { container, getByRole } = render(SegmentedControl, {
      props: { options, value: '7d', ariaLabel: 'Window range' }
    });

    const group = getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Window range');
    const radios = segments(container);
    expect(radios).toHaveLength(4);
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['7D', '30D', '90D', '1Y']);
  });

  it('marks the active option via aria-checked and roving tabindex', () => {
    const { container } = render(SegmentedControl, {
      props: { options, value: '30d', ariaLabel: 'Window range' }
    });

    const radios = segments(container);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    // Only the selected segment is in the tab order.
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
  });

  it('fires onChange and updates aria-checked when a segment is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(SegmentedControl, {
      props: { options, value: '7d', ariaLabel: 'Window range', onChange }
    });

    await fireEvent.click(seg(container, 2));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('90d');
    expect(seg(container, 2).getAttribute('aria-checked')).toBe('true');
    expect(seg(container, 0).getAttribute('aria-checked')).toBe('false');
  });

  it('does not fire onChange when the already-active segment is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(SegmentedControl, {
      props: { options, value: '7d', ariaLabel: 'Window range', onChange }
    });

    await fireEvent.click(seg(container, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves and selects with Arrow keys (wrapping)', async () => {
    const onChange = vi.fn();
    const { container } = render(SegmentedControl, {
      props: { options, value: '7d', ariaLabel: 'Window range', onChange }
    });

    await fireEvent.keyDown(seg(container, 0), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('30d');

    // Wrap from the first item backwards to the last.
    await fireEvent.keyDown(seg(container, 1), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('7d');
    await fireEvent.keyDown(seg(container, 0), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('1y');
  });

  it('jumps to first/last with Home and End', async () => {
    const onChange = vi.fn();
    const { container } = render(SegmentedControl, {
      props: { options, value: '30d', ariaLabel: 'Window range', onChange }
    });

    await fireEvent.keyDown(seg(container, 1), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('1y');

    await fireEvent.keyDown(seg(container, 3), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('7d');
  });
});
