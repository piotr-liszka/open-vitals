import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import WorkoutEditor from './WorkoutEditor.svelte';
import type { WorkoutDraft } from './workouts.types';

/**
 * Spec 066's step builder had no component test at all, which was affordable only while a top-level
 * row and a row nested in a repeat block were two separate copies of the same markup: each half could
 * be read on its own. They are one snippet now, drawn twice with a single `child` argument, so what
 * needs proving is that the two callers still address the right LIST — a move or a delete that reached
 * the outer array from inside a block would silently rewrite the session.
 */

afterEach(cleanup);

interface Harness {
  container: HTMLElement;
  /** Drafts captured from `onsave`, newest last. */
  saved: WorkoutDraft[];
}

function mount(): Harness {
  const saved: WorkoutDraft[] = [];
  const { container } = render(WorkoutEditor, {
    props: {
      workout: null,
      day: '2026-08-15',
      saving: false,
      error: null,
      onsave: (draft: WorkoutDraft) => saved.push(draft),
      oncancel: () => {}
    }
  });
  return { container: container as HTMLElement, saved };
}

const rows = (c: HTMLElement): HTMLElement[] => Array.from(c.querySelectorAll('.step-bar'));
const childRows = (c: HTMLElement): HTMLElement[] => Array.from(c.querySelectorAll('.step-bar.child'));
const kindSelect = (row: HTMLElement): HTMLSelectElement =>
  row.querySelector('select[aria-label="Rodzaj kroku"]') as HTMLSelectElement;
const button = (root: HTMLElement, label: string): HTMLButtonElement =>
  Array.from(root.querySelectorAll('button')).find(
    (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label
  ) as HTMLButtonElement;

/** Fill the title (the only thing gating submit) and submit the form. */
async function submit(c: HTMLElement): Promise<void> {
  const title = c.querySelector('input[placeholder="np. Interwały 5×1 km"]') as HTMLInputElement;
  title.value = 'Test';
  title.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  (c.querySelector('form') as HTMLFormElement).requestSubmit();
  await tick();
}

describe('WorkoutEditor step rows (spec 066)', () => {
  it('opens a new session on three top-level rows and no nesting', () => {
    const { container } = mount();

    expect(rows(container)).toHaveLength(3);
    expect(childRows(container)).toHaveLength(0);
    expect(rows(container).map((r) => kindSelect(r).value)).toEqual(['warmup', 'work', 'cooldown']);
  });

  it('offers "repeat" at the top level and never inside a block', async () => {
    const { container } = mount();
    button(container, '+ Powtórzenie').click();
    await tick();

    const kinds = (row: HTMLElement): string[] => Array.from(kindSelect(row).options).map((o) => o.value);

    expect(kinds(rows(container)[0]!)).toContain('repeat');
    expect(childRows(container)).toHaveLength(2);
    for (const child of childRows(container)) expect(kinds(child)).not.toContain('repeat');
  });

  it('moves a step inside its block without touching the top-level order', async () => {
    const { container, saved } = mount();
    button(container, '+ Powtórzenie').click();
    await tick();

    // The block seeds work + recovery; swapping them must not disturb warmup/work/cooldown above.
    const second = childRows(container)[1]!;
    button(second, 'W górę').click();
    await tick();

    await submit(container);
    const steps = saved[0]!.steps;
    expect(steps.map((s) => s.kind)).toEqual(['warmup', 'work', 'cooldown', 'repeat']);
    expect((steps[3]!.steps ?? []).map((s) => s.kind)).toEqual(['recovery', 'work']);
  });

  it('deletes from the block it was pressed in, not from the session', async () => {
    const { container, saved } = mount();
    button(container, '+ Powtórzenie').click();
    await tick();

    button(childRows(container)[0]!, 'Usuń krok').click();
    await tick();

    await submit(container);
    const steps = saved[0]!.steps;
    expect(steps.map((s) => s.kind)).toEqual(['warmup', 'work', 'cooldown', 'repeat']);
    expect(steps[3]!.steps).toHaveLength(1);
  });

  it('builds the wire shape the validator expects for a repeat block', async () => {
    const { container, saved } = mount();
    button(container, '+ Powtórzenie').click();
    await tick();
    await submit(container);

    const block = saved[0]!.steps[3]!;
    // A repeat carries its children and its count, and nothing that belongs to a leaf step.
    expect(block.durationType).toBeNull();
    expect(block.durationValue).toBeNull();
    expect(block.target).toBeNull();
    expect(block.repeats).toBe(4);
    // Leaves are the mirror image: no children, no repeat count.
    expect(block.steps![0]!.steps).toBeNull();
    expect(block.steps![0]!.repeats).toBeNull();
  });
});
