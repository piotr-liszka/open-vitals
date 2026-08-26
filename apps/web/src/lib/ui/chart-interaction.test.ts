import { describe, it, expect } from 'vitest';
import {
  activeIndex,
  bandIndex,
  clampIndex,
  clampZoomRange,
  edgeDefinedIndex,
  localX,
  nearestDefinedIndex,
  nearestPointIndex,
  stepDefinedIndex,
  stepIndex,
  tooltipAlign
} from './chart-interaction';

describe('clampIndex', () => {
  it('keeps an index inside the series', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(9, 5)).toBe(4);
  });

  it('reports "nothing to point at" for an empty series', () => {
    expect(clampIndex(0, 0)).toBe(-1);
  });

  it('falls back to the first index for a non-finite input', () => {
    expect(clampIndex(NaN, 4)).toBe(0);
  });
});

describe('localX', () => {
  it('rescales a client x into the chart coordinate system', () => {
    // A 300px-wide box rendering a 600-unit viewBox: the midpoint maps to 300.
    expect(localX(150, { left: 0, width: 300 }, 600)).toBe(300);
    expect(localX(120, { left: 20, width: 200 }, 200)).toBe(100);
  });

  it('returns 0 for a zero-width box (pre-measure / hidden)', () => {
    expect(localX(50, { left: 0, width: 0 }, 600)).toBe(0);
  });
});

describe('nearestPointIndex', () => {
  const axis = { n: 5, padX: 10, plotW: 100 }; // points at x = 10,35,60,85,110

  it('snaps to the nearest lattice point', () => {
    expect(nearestPointIndex(10, axis)).toBe(0);
    expect(nearestPointIndex(37, axis)).toBe(1);
    expect(nearestPointIndex(59, axis)).toBe(2);
    expect(nearestPointIndex(110, axis)).toBe(4);
  });

  it('clamps outside the plot band instead of going out of range', () => {
    expect(nearestPointIndex(-500, axis)).toBe(0);
    expect(nearestPointIndex(9999, axis)).toBe(4);
  });

  it('handles degenerate series', () => {
    expect(nearestPointIndex(42, { n: 0, padX: 10, plotW: 100 })).toBe(-1);
    expect(nearestPointIndex(42, { n: 1, padX: 10, plotW: 100 })).toBe(0);
    expect(nearestPointIndex(42, { n: 4, padX: 0, plotW: 0 })).toBe(0);
  });

  describe('with a zoomed range', () => {
    // Same 5-point lattice, but the plot now spans only indices 1..3 (a zoomed sub-window).
    const zoomed = { n: 5, padX: 10, plotW: 100, range: [1, 3] as [number, number] };

    it('maps the plot band to the range instead of the full lattice', () => {
      expect(nearestPointIndex(10, zoomed)).toBe(1); // left edge → range start
      expect(nearestPointIndex(60, zoomed)).toBe(2); // midpoint → range midpoint
      expect(nearestPointIndex(110, zoomed)).toBe(3); // right edge → range end
    });

    it('reduces to the unzoomed formula when range is omitted', () => {
      const axis = { n: 5, padX: 10, plotW: 100 };
      expect(nearestPointIndex(37, axis)).toBe(nearestPointIndex(37, { ...axis, range: undefined }));
    });

    it('clamps outside the zoomed band to its own edges', () => {
      expect(nearestPointIndex(-500, zoomed)).toBe(1);
      expect(nearestPointIndex(9999, zoomed)).toBe(3);
    });
  });
});

describe('clampZoomRange', () => {
  it('orders an out-of-order drag into an ascending range', () => {
    expect(clampZoomRange(3, 1, 10)).toEqual([1, 3]);
  });

  it('clamps both ends inside [0, n-1]', () => {
    expect(clampZoomRange(-5, 50, 10)).toEqual([0, 9]);
  });

  it('widens a zero-width (single-index) drag forward by one', () => {
    expect(clampZoomRange(4, 4, 10)).toEqual([4, 5]);
  });

  it('widens backward instead, at the very last index', () => {
    expect(clampZoomRange(9, 9, 10)).toEqual([8, 9]);
  });

  it('returns null when there is nothing to zoom into', () => {
    expect(clampZoomRange(0, 0, 1)).toBeNull();
    expect(clampZoomRange(0, 0, 0)).toBeNull();
  });
});

describe('bandIndex', () => {
  const axis = { n: 4, width: 400 }; // bands 0–100, 100–200, 200–300, 300–400

  it('picks the band under the pointer', () => {
    expect(bandIndex(0, axis)).toBe(0);
    expect(bandIndex(99, axis)).toBe(0);
    expect(bandIndex(100, axis)).toBe(1);
    expect(bandIndex(350, axis)).toBe(3);
  });

  it('clamps at both edges, including exactly the right edge', () => {
    expect(bandIndex(-20, axis)).toBe(0);
    expect(bandIndex(400, axis)).toBe(3);
    expect(bandIndex(4000, axis)).toBe(3);
  });

  it('handles degenerate series', () => {
    expect(bandIndex(10, { n: 0, width: 400 })).toBe(-1);
    expect(bandIndex(10, { n: 3, width: 0 })).toBe(0);
  });
});

describe('stepIndex', () => {
  it('starts at the newest point when nothing is active', () => {
    expect(stepIndex(null, 1, 7)).toBe(6);
    expect(stepIndex(null, -1, 7)).toBe(6);
  });

  it('steps and clamps at the ends', () => {
    expect(stepIndex(3, 1, 7)).toBe(4);
    expect(stepIndex(3, -1, 7)).toBe(2);
    expect(stepIndex(0, -1, 7)).toBe(0);
    expect(stepIndex(6, 1, 7)).toBe(6);
  });

  it('reports "nothing to point at" for an empty series', () => {
    expect(stepIndex(null, 1, 0)).toBe(-1);
  });
});

describe('nearestDefinedIndex', () => {
  // A gap day at index 2 and a run of gaps at the end.
  const defined = [true, true, false, true, false, false];

  it('keeps an index that already has data', () => {
    expect(nearestDefinedIndex(3, defined)).toBe(3);
  });

  it('searches outward from a gap, preferring the earlier day on a tie', () => {
    expect(nearestDefinedIndex(2, defined)).toBe(1);
    expect(nearestDefinedIndex(4, defined)).toBe(3);
    expect(nearestDefinedIndex(5, defined)).toBe(3);
  });

  it('clamps out-of-range inputs into the series', () => {
    expect(nearestDefinedIndex(-9, defined)).toBe(0);
    expect(nearestDefinedIndex(99, defined)).toBe(3);
  });

  it('reports "nothing to point at" for empty or all-gap series', () => {
    expect(nearestDefinedIndex(0, [])).toBe(-1);
    expect(nearestDefinedIndex(0, [false, false])).toBe(-1);
  });
});

describe('stepDefinedIndex', () => {
  const defined = [true, false, true, true, false, true];

  it('starts at the newest day with data when nothing is active', () => {
    expect(stepDefinedIndex(null, 1, defined)).toBe(5);
    expect(stepDefinedIndex(null, -1, defined)).toBe(5);
  });

  it('hops over gaps instead of landing on them', () => {
    expect(stepDefinedIndex(0, 1, defined)).toBe(2);
    expect(stepDefinedIndex(3, 1, defined)).toBe(5);
    expect(stepDefinedIndex(5, -1, defined)).toBe(3);
  });

  it('stays put at either end rather than wrapping', () => {
    expect(stepDefinedIndex(0, -1, defined)).toBe(0);
    expect(stepDefinedIndex(5, 1, defined)).toBe(5);
  });

  it('reports "nothing to point at" for empty or all-gap series', () => {
    expect(stepDefinedIndex(null, 1, [])).toBe(-1);
    expect(stepDefinedIndex(null, 1, [false])).toBe(-1);
  });
});

describe('edgeDefinedIndex', () => {
  it('finds the first and last day carrying data', () => {
    const defined = [false, true, false, true, false];
    expect(edgeDefinedIndex(defined, 'first')).toBe(1);
    expect(edgeDefinedIndex(defined, 'last')).toBe(3);
  });

  it('reports "nothing to point at" for empty or all-gap series', () => {
    expect(edgeDefinedIndex([], 'first')).toBe(-1);
    expect(edgeDefinedIndex([false, false], 'last')).toBe(-1);
  });
});

describe('activeIndex', () => {
  it('lets a live hover win over the pinned selection', () => {
    expect(activeIndex(2, 5, 7)).toBe(2);
  });

  it('falls back to the pinned selection once the hover ends', () => {
    expect(activeIndex(null, 5, 7)).toBe(5);
  });

  it('is null with neither', () => {
    expect(activeIndex(null, null, 7)).toBeNull();
    expect(activeIndex(null, undefined, 7)).toBeNull();
  });

  it('ignores a selection left over from a longer series', () => {
    expect(activeIndex(null, 9, 7)).toBeNull();
    expect(activeIndex(null, -1, 7)).toBeNull();
    expect(activeIndex(9, 3, 7)).toBe(3);
  });
});

describe('tooltipAlign', () => {
  it('centres in the middle band and pins near the edges', () => {
    expect(tooltipAlign(10, 400)).toBe('start');
    expect(tooltipAlign(200, 400)).toBe('middle');
    expect(tooltipAlign(390, 400)).toBe('end');
  });

  it('degrades to centred without a measured width', () => {
    expect(tooltipAlign(0, 0)).toBe('middle');
  });
});
