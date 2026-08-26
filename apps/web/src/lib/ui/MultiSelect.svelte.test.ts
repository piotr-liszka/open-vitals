import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import MultiSelect from './MultiSelect.svelte';

afterEach(cleanup);

const options = [
  { value: 'hr', label: 'Heart rate', color: 'var(--lane-red)' },
  { value: 'battery', label: 'Body Battery', color: 'var(--lane-cyan)' },
  { value: 'stress', label: 'Stress', color: 'var(--lane-amber)' }
];

function setup(selected: string[] = []) {
  const view = render(MultiSelect, {
    props: { options, selected, label: 'Charts to overlay', placeholder: 'Select charts' }
  });
  // The trigger is the only button while the popover is closed.
  const trigger = view.getByRole('button') as HTMLButtonElement;
  return { ...view, trigger };
}

function rows(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('[role="option"]'));
}

describe('MultiSelect summary text', () => {
  it('shows the placeholder when nothing is selected', () => {
    const { trigger } = setup([]);
    expect(trigger.textContent).toContain('Select charts');
  });

  it('falls back to the label when nothing is selected and no placeholder is given', () => {
    const view = render(MultiSelect, { props: { options, selected: [], label: 'Charts to overlay' } });
    expect(view.getByRole('button').textContent).toContain('Charts to overlay');
  });

  it('shows the option label when exactly one is selected', () => {
    const { trigger } = setup(['battery']);
    expect(trigger.textContent).toContain('Body Battery');
  });

  it('shows a compact count when two or more are selected', () => {
    const { trigger } = setup(['hr', 'battery']);
    expect(trigger.textContent).toContain('2 selected');
  });

  it('lets the caller localize the 2+ summary via summaryFormatter', () => {
    const view = render(MultiSelect, {
      props: {
        options,
        selected: ['hr', 'battery'],
        label: 'Charts to overlay',
        summaryFormatter: (count: number, total: number) => `${count}/${total} wybrane`
      }
    });
    expect(view.getByRole('button').textContent).toContain('2/3 wybrane');
  });
});

describe('MultiSelect open/close', () => {
  it('starts closed with aria-expanded false and haspopup=listbox', () => {
    const { trigger, queryByRole } = setup([]);
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('listbox')).toBeNull();
  });

  it('opens the popover on click', async () => {
    const { trigger, getByRole } = setup([]);
    await fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const listbox = getByRole('listbox');
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
    expect(listbox.getAttribute('aria-label')).toBe('Charts to overlay');
  });

  it('opens on Enter from the trigger', async () => {
    const { trigger, getByRole } = setup([]);
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('listbox')).toBeTruthy();
  });

  it('opens on ArrowDown from the trigger', async () => {
    const { trigger, getByRole } = setup([]);
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('listbox')).toBeTruthy();
  });

  it('closes when the trigger is clicked again while open', async () => {
    const { trigger, queryByRole } = setup([]);
    await fireEvent.click(trigger);
    await fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { trigger, container } = setup([]);
    await fireEvent.click(trigger);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a click outside the component', async () => {
    const { trigger } = setup([]);
    await fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(document.body);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('MultiSelect row toggling', () => {
  it('toggling a row updates selected and does not close the popover', async () => {
    const { trigger, container, getByRole } = setup([]);
    await fireEvent.click(trigger);

    const battery = rows(container)[1];
    if (!battery) throw new Error('no row for battery');
    await fireEvent.click(battery);

    expect(battery.getAttribute('aria-selected')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('listbox')).toBeTruthy();
    expect(trigger.textContent).toContain('Body Battery');
  });

  it('toggling twice deselects and falls back to the placeholder', async () => {
    const { trigger, container } = setup([]);
    await fireEvent.click(trigger);

    const hr = rows(container)[0];
    if (!hr) throw new Error('no row for hr');
    await fireEvent.click(hr);
    expect(hr.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(hr);
    expect(hr.getAttribute('aria-selected')).toBe('false');
    expect(trigger.textContent).toContain('Select charts');
  });

  it('toggles a row via Space/Enter without closing', async () => {
    const { trigger, container } = setup([]);
    await fireEvent.click(trigger);
    const stress = rows(container)[2];
    if (!stress) throw new Error('no row for stress');
    stress.focus();

    await fireEvent.keyDown(stress, { key: ' ' });
    expect(stress.getAttribute('aria-selected')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await fireEvent.keyDown(stress, { key: 'Enter' });
    expect(stress.getAttribute('aria-selected')).toBe('false');
  });

  it('reflects pre-selected options with aria-selected=true on open', async () => {
    const { trigger, container } = setup(['stress']);
    await fireEvent.click(trigger);
    const list = rows(container);
    expect(list.map((r) => r.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });
});

describe('MultiSelect keyboard roving', () => {
  it('moves focus down and up between rows, clamped at the ends', async () => {
    const { trigger, container } = setup([]);
    await fireEvent.click(trigger);
    const list = rows(container);
    const [hr, battery, stress] = list;
    if (!hr || !battery || !stress) throw new Error('expected 3 rows');

    // Opening with nothing selected focuses the first row.
    expect(document.activeElement).toBe(hr);

    await fireEvent.keyDown(hr, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(battery);

    await fireEvent.keyDown(battery, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(stress);

    // Clamped: ArrowDown at the last row stays put.
    await fireEvent.keyDown(stress, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(stress);

    await fireEvent.keyDown(stress, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(battery);
  });

  it('jumps to the first/last row with Home/End', async () => {
    const { trigger, container } = setup([]);
    await fireEvent.click(trigger);
    const list = rows(container);
    const [hr, , stress] = list;
    if (!hr || !stress) throw new Error('expected first/last rows');

    await fireEvent.keyDown(hr, { key: 'End' });
    expect(document.activeElement).toBe(stress);

    await fireEvent.keyDown(stress, { key: 'Home' });
    expect(document.activeElement).toBe(hr);
  });

  it('opens with focus on the first already-selected row', async () => {
    const { trigger, container } = setup(['battery']);
    await fireEvent.click(trigger);
    const battery = rows(container)[1];
    expect(document.activeElement).toBe(battery);
  });

  it('roving tabindex keeps only the focused row in the tab order', async () => {
    const { trigger, container } = setup([]);
    await fireEvent.click(trigger);
    const list = rows(container);
    expect(list.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    const first = list[0];
    if (!first) throw new Error('no first row');
    await fireEvent.keyDown(first, { key: 'ArrowDown' });
    const after = rows(container);
    expect(after.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });
});
