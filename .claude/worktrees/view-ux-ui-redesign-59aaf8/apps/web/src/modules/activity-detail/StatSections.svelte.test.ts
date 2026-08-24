import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import StatSections from './StatSections.svelte';
import type { StatSection } from './activity-stat-groups';

afterEach(cleanup);

const sections: StatSection[] = [
  {
    key: 'timing',
    title: 'Czas i ruch',
    accent: 'var(--lane-cyan)',
    items: [
      { key: 'duration', label: 'Czas trwania', value: '1:00:00' },
      { key: 'run', label: 'Bieg', value: null, hint: 'Garmin nie przysłał typed splits.' }
    ]
  }
];

describe('StatSections', () => {
  it('renders each group with its readouts and units', () => {
    const { container } = render(StatSections, { props: { sections } });
    expect(container.querySelector('.group-title')?.textContent).toContain('Czas i ruch');
    const labels = [...container.querySelectorAll('.label')].map((el) => el.textContent);
    expect(labels).toContain('Czas trwania');
    expect(container.querySelector('.value')?.textContent).toContain('1:00:00');
  });

  it('renders a missing value as an explained dash, readable by assistive tech', () => {
    const { container } = render(StatSections, { props: { sections } });
    const dash = container.querySelector('.dash');
    expect(dash?.textContent).toBe('—');
    expect(dash?.getAttribute('title')).toContain('typed splits');
    expect(container.querySelector('.sr-only')?.textContent).toContain('Brak danych');
  });

  it('renders nothing at all when there are no groups', () => {
    const { container } = render(StatSections, { props: { sections: [] } });
    expect(container.querySelectorAll('.group')).toHaveLength(0);
  });
});
