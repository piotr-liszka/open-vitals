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

/*
 * Spec 086 follow-up: the panel is 24rem wide and `align` is a PREFERENCE, not a guarantee. A
 * trigger sitting near the left edge with the default `align="end"` used to open the panel
 * leftwards, off the card and across the sidebar. jsdom reports every rect as zero, so these tests
 * stub the two measurements the flip actually reads.
 */
const realRect = HTMLDivElement.prototype.getBoundingClientRect;
afterEach(() => {
  // The stub below lands on a shared prototype; leaving it there would silently rewrite geometry
  // for every test that runs after this file.
  HTMLDivElement.prototype.getBoundingClientRect = realRect;
});

function openAt(align: 'start' | 'end', anchorLeft: number, panelWidth: number) {
  const view = render(InfoPopover, {
    props: { label: 'Jak to liczymy?', title: 'Skąd ta liczba', align, children: body }
  });
  const trigger = view.getByRole('button', { name: 'Jak to liczymy?' });

  const root = trigger.parentElement as HTMLElement;
  root.getBoundingClientRect = () => ({ left: anchorLeft, right: anchorLeft + 24 }) as DOMRect;
  Object.defineProperty(HTMLDivElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      return (this.getAttribute('role') === 'group' ? { width: panelWidth } : { width: 0 }) as DOMRect;
    }
  });

  return { ...view, trigger };
}

describe('InfoPopover placement', () => {
  it('flips an end-aligned panel to the right when there is no room on the left', async () => {
    // Trigger 100px from the left edge; a 384px panel cannot hang leftwards from it.
    const { trigger, getByRole } = openAt('end', 100, 384);
    await trigger.click();
    expect(getByRole('group', { name: 'Skąd ta liczba' }).className).toContain('start');
  });

  it('keeps the caller`s side when the panel fits there', async () => {
    const { trigger, getByRole } = openAt('end', 900, 384);
    await trigger.click();
    expect(getByRole('group', { name: 'Skąd ta liczba' }).className).toContain('end');
  });

  it('keeps the caller`s side when neither side fits — no pointless flip', async () => {
    const { trigger, getByRole } = openAt('end', 100, 5000);
    await trigger.click();
    expect(getByRole('group', { name: 'Skąd ta liczba' }).className).toContain('end');
  });
});
