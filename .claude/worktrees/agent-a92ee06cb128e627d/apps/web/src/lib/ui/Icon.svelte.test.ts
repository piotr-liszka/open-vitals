import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Icon from './Icon.svelte';
import { ICONS, ICON_NAMES, isIconName, type IconName } from './icons';

afterEach(cleanup);

function svg(container: HTMLElement): SVGSVGElement {
  const el = container.querySelector('svg');
  if (!el) throw new Error('no icon rendered');
  return el as unknown as SVGSVGElement;
}

describe('Icon', () => {
  it('draws every named glyph on the same grid with the same stroke construction', () => {
    for (const name of ICON_NAMES) {
      const { container } = render(Icon, { props: { name } });
      const el = svg(container);
      expect(el.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(el.getAttribute('fill')).toBe('none');
      expect(el.getAttribute('stroke')).toBe('currentColor');
      expect(el.getAttribute('stroke-width')).toBe('1.6');
      expect(el.getAttribute('stroke-linecap')).toBe('round');
      // Every glyph must actually draw something.
      expect(el.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it('is decorative by default and named when it carries meaning alone', () => {
    const { container } = render(Icon, { props: { name: 'trophy' } });
    expect(svg(container).getAttribute('aria-hidden')).toBe('true');
    expect(svg(container).getAttribute('role')).toBeNull();
    cleanup();

    const labelled = render(Icon, { props: { name: 'trophy', label: 'Rekord' } });
    const el = svg(labelled.container);
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Rekord');
    expect(el.getAttribute('aria-hidden')).toBeNull();
  });

  it('honours the requested size', () => {
    const { container } = render(Icon, { props: { name: 'moon', size: 32 } });
    expect(svg(container).getAttribute('width')).toBe('32');
    expect(svg(container).getAttribute('height')).toBe('32');
  });

  it('renders the exact path/circle/rect counts the glyph data declares', () => {
    const name: IconName = 'ride';
    const { container } = render(Icon, { props: { name } });
    const el = svg(container);
    expect(el.querySelectorAll('circle').length).toBe(ICONS[name].circles!.length);
    expect(el.querySelectorAll('path').length).toBe(ICONS[name].paths.length);
    expect(el.getAttribute('data-icon')).toBe('ride');
  });

  it('guards untrusted icon names', () => {
    expect(isIconName('moon')).toBe(true);
    expect(isIconName('definitely-not-an-icon')).toBe(false);
    expect(isIconName(42)).toBe(false);
  });
});
