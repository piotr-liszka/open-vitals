import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import Textarea from './Textarea.svelte';

afterEach(cleanup);

describe('Textarea', () => {
  it('renders a multi-line control with the passed-through attributes', () => {
    render(Textarea, { props: { value: 'coś', rows: 5, placeholder: 'notatka' } });
    const el = screen.getByPlaceholderText('notatka') as HTMLTextAreaElement;
    expect(el.tagName).toBe('TEXTAREA');
    expect(el.rows).toBe(5);
    expect(el.value).toBe('coś');
  });

  it('reflects typing', async () => {
    render(Textarea, { props: { value: '', placeholder: 'notatka' } });
    const el = screen.getByPlaceholderText('notatka') as HTMLTextAreaElement;
    await fireEvent.input(el, { target: { value: 'lewe kolano' } });
    expect(el.value).toBe('lewe kolano');
  });

  it('hides the counter until the limit is actually in reach', () => {
    const { container } = render(Textarea, {
      props: { value: 'x'.repeat(10), maxlength: 1000, counterFrom: 100 }
    });
    expect(container.querySelector('.counter')).toBeNull();
  });

  it('shows the counter inside the threshold', () => {
    render(Textarea, { props: { value: 'x'.repeat(950), maxlength: 1000, counterFrom: 100 } });
    expect(screen.getByText('950/1000')).toBeTruthy();
  });

  it('marks the tight state when there is nothing left', () => {
    const { container } = render(Textarea, {
      props: { value: 'x'.repeat(1000), maxlength: 1000, counterFrom: 100 }
    });
    expect(container.querySelector('.counter.tight')).toBeTruthy();
  });

  it('has no counter at all without a maxlength', () => {
    const { container } = render(Textarea, { props: { value: 'x'.repeat(500) } });
    expect(container.querySelector('.counter')).toBeNull();
  });

  it('sets aria-invalid only when invalid', () => {
    const { container, rerender } = render(Textarea, { props: { value: '', invalid: true } });
    expect(container.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
    return rerender({ value: '', invalid: false }).then(() => {
      expect(container.querySelector('textarea')?.getAttribute('aria-invalid')).toBeNull();
    });
  });
});
