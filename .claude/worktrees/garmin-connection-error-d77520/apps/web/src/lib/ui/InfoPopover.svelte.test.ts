/** Spec 059 — the shared "explain this number" disclosure. */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import InfoPopover from './InfoPopover.svelte';

afterEach(cleanup);

const body = createRawSnippet(() => ({
  render: () => '<p>Ważona średnia czterech kanałów.</p>'
}));

function open() {
  const view = render(InfoPopover, {
    props: { label: 'Jak to liczymy?', title: 'Skąd ta liczba', children: body }
  });
  return { ...view, trigger: view.getByRole('button', { name: 'Jak to liczymy?' }) };
}

describe('InfoPopover', () => {
  it('starts closed', () => {
    const { trigger, container } = open();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Ważona średnia');
  });

  it('opens on click, wiring the trigger to the panel it controls', async () => {
    const { trigger, container, getByRole } = open();
    await trigger.click();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Ważona średnia');

    const panel = getByRole('group', { name: 'Skąd ta liczba' });
    expect(panel.id).toBe(trigger.getAttribute('aria-controls'));
  });

  it('closes on a second click', async () => {
    const { trigger } = open();
    await trigger.click();
    await trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape', async () => {
    const { trigger } = open();
    await trigger.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on a click outside itself', async () => {
    const { trigger } = open();
    await trigger.click();
    document.body.click();
    await Promise.resolve();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('falls back to the trigger label as the panel heading', async () => {
    const view = render(InfoPopover, { props: { label: 'Skąd to', children: body } });
    await view.getByRole('button', { name: 'Skąd to' }).click();
    expect(view.getByRole('group', { name: 'Skąd to' })).toBeTruthy();
  });
});
