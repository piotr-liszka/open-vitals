import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ConditionCard from './ConditionCard.svelte';
import type { ConditionMetric, ConditionSnapshot, GarminReadiness, IntradayPoint } from './insights.types';

afterEach(() => {
  cleanup();
  // The source switch remembers per device (spec 059); a leftover choice must not leak between tests.
  localStorage.clear();
});

function channel(over: Partial<ConditionMetric> & { key: string; label: string }): ConditionMetric {
  return {
    accent: 'green',
    unit: 'ms',
    format: 'int',
    goodWhen: 'up',
    day: '2026-08-07',
    latest: 60,
    baseline: 50,
    deltaPct: 20,
    direction: 'up',
    favourable: true,
    ...over
  };
}

/** Body Battery's intraday lattice: 15-minute slots climbing overnight. */
function batteryDay(values: Array<number | null> = [40, 55, 62, 74]): IntradayPoint[] {
  const start = Date.UTC(2026, 7, 7, 4, 0);
  return values.map((value, i) => ({ at: start + i * 15 * 60_000, value }));
}

function snapshot(over: Partial<ConditionSnapshot> = {}): ConditionSnapshot {
  return {
    day: '2026-08-07',
    readiness: {
      score: 74,
      band: 'high',
      drivers: [{ key: 'hrv', label: 'HRV', accent: 'green', z: 1.1, direction: 'up', contribution: 21 }],
      basisDays: 12
    },
    sleep: {
      day: '2026-08-07',
      totalS: 27_060,
      deepS: 4800,
      lightS: 15_060,
      remS: 6000,
      awakeS: 1200,
      score: 82,
      bedTime: '23:15',
      wakeTime: '07:05',
      efficiencyPct: 94
    },
    sleepTrend: channel({
      key: 'sleep',
      label: 'Sen',
      accent: 'indigo',
      unit: '',
      format: 'duration',
      latest: 27_060,
      baseline: 25_000
    }),
    channels: [
      channel({
        key: 'body_battery',
        label: 'Body Battery',
        accent: 'cyan',
        unit: '',
        latest: 74,
        baseline: 81,
        deltaPct: -8.6,
        direction: 'down',
        favourable: false
      }),
      channel({ key: 'hrv', label: 'HRV' }),
      channel({
        key: 'resting_heart_rate',
        label: 'Tętno spoczynkowe',
        accent: 'red',
        unit: 'bpm',
        goodWhen: 'down',
        latest: 56,
        baseline: 50,
        deltaPct: 12,
        direction: 'up',
        favourable: false
      })
    ],
    state: 'rested',
    summary: 'Jesteś wypoczęty — HRV powyżej bazy (60 ms), sen 7 h 31 min.',
    batteryDay: batteryDay(),
    // Spec 059: an account without Training Readiness is the default fixture, so every test above
    // exercises the fallback — our own composite leading, with no switch.
    garmin: null,
    recovery: null,
    ...over
  };
}

/** Garmin's own verdict for the same day, far below ours — the real-world case (spec 059). */
function garminReadiness(over: Partial<GarminReadiness> = {}): GarminReadiness {
  return {
    day: '2026-08-07',
    score: 12,
    level: 'poor',
    state: 'strained',
    factors: [
      { key: 'sleep', label: 'Sen', accent: 'indigo', percent: 74 },
      { key: 'recovery', label: 'Regeneracja', accent: 'cyan', percent: 10 }
    ],
    hrvWeeklyAvg: 61,
    acuteLoad: 300,
    summary: 'Garmin: gotowość bardzo niska — do pełnej regeneracji 1 dzień 10 h.',
    ...over
  };
}

describe('ConditionCard', () => {
  it('answers "how am I right now" in one block: score, sentence, night and channels', () => {
    const { container } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true, enabled: true }
    });

    expect(container.textContent).toContain('74'); // readiness score, absorbed from ReadinessCard
    expect(container.textContent).toContain('Wypoczęty');
    expect(container.textContent).toContain('Jesteś wypoczęty — HRV powyżej bazy');
    expect(container.textContent).toContain('7 h 31 min');
    expect(container.textContent).toContain('Body Battery');
    expect(container.textContent).toContain('Tętno spoczynkowe');
  });

  it('renders the sleep stat cluster: score, efficiency, bedtime and wake time', () => {
    const { container } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true, enabled: true }
    });
    const labels = Array.from(container.querySelectorAll('.readout-label')).map((n) => n.textContent?.trim());
    expect(labels).toEqual(['Wynik snu', 'Efektywność', 'Zaśnięcie', 'Pobudka']);
    expect(container.textContent).toContain('23:15');
    expect(container.textContent).toContain('07:05');
    expect(container.textContent).toContain('94%');
  });

  it('breaks the night into its stages with an accessible summary', () => {
    const { getByRole } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true, enabled: true }
    });
    const name = getByRole('img', { name: /Fazy snu/ }).getAttribute('aria-label') ?? '';
    expect(name).toContain('Głęboki 1 h 20 min');
    expect(name).toContain('REM 1 h 40 min');
  });

  it('colours each channel by whether the move was healthy, not by its sign', () => {
    const { container } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true, enabled: true }
    });
    const deltas = Array.from(container.querySelectorAll('.channel-delta'));
    // Body Battery down = bad; HRV up = good; resting HR up = bad (lower is better).
    const tone = (el: Element): string =>
      ['good', 'bad', 'flat'].find((c) => el.classList.contains(c)) ?? 'none';
    expect(deltas.map(tone)).toEqual(['bad', 'good', 'bad']);
    expect(deltas[2]!.textContent).toContain('+12,0%');
  });

  it('omits sleep readouts the payload cannot support instead of printing dashes', () => {
    const bare = snapshot({
      sleep: {
        day: '2026-08-07',
        totalS: 21_600,
        deepS: null,
        lightS: null,
        remS: null,
        awakeS: null,
        score: null,
        bedTime: null,
        wakeTime: null,
        efficiencyPct: null
      }
    });
    const { container } = render(ConditionCard, {
      props: { condition: bare, connected: true, enabled: true }
    });
    expect(container.textContent).toContain('6 h 00 min');
    expect(container.querySelectorAll('.readout').length).toBe(0);
    expect(container.querySelector('.track')).toBeNull();
  });

  it('draws the last 24 h of Body Battery beside the gauge, on a clock axis', () => {
    const { container, getByRole } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true, enabled: true }
    });
    const chart = container.querySelector('.battery');
    expect(chart).not.toBeNull();
    // The aria summary proves the trace is the battery series, not another channel's.
    expect(getByRole('img', { name: /Body Battery trend/ })).toBeTruthy();
    expect(chart!.textContent).toContain('ostatnia doba');
    // 04:00 UTC is 06:00 in the app's timezone — the axis reads as wall clock, not as UTC.
    expect(chart!.textContent).toContain('06:00');
  });

  it('omits the battery block — rather than drawing an empty frame — without enough readings', () => {
    const thin = snapshot({ batteryDay: batteryDay([74]) });
    const { container } = render(ConditionCard, {
      props: { condition: thin, connected: true, enabled: true }
    });
    expect(container.querySelector('.battery')).toBeNull();
    expect(container.querySelector('.hero.with-chart')).toBeNull();
    expect(container.textContent).toContain('Body Battery'); // the channel readout stays
  });

  it('still renders without readiness, and says so honestly with nothing at all', () => {
    const noScore = render(ConditionCard, {
      props: { condition: snapshot({ readiness: null, state: 'unknown' }), connected: true, enabled: true }
    });
    expect(noScore.container.textContent).toContain('7 h 31 min');
    cleanup();

    const nothing = render(ConditionCard, { props: { condition: null, connected: true, enabled: true } });
    expect(nothing.container.textContent).toContain('Za mało danych');
  });

  it('has not-connected, consent-off and loading states', () => {
    const off = render(ConditionCard, { props: { condition: null, connected: false, enabled: true } });
    expect(off.container.textContent).toContain('Połącz konto Garmin');
    cleanup();

    const noConsent = render(ConditionCard, { props: { condition: null, connected: true, enabled: false } });
    expect(noConsent.container.textContent).toContain('Włącz tryb zaawansowany');
    cleanup();

    const loading = render(ConditionCard, {
      props: { condition: null, connected: true, enabled: true, loading: true }
    });
    expect(loading.container.querySelectorAll('.loading > *').length).toBeGreaterThan(0);
  });

  /* -------------------------------------------------------------- *
   * Spec 059 — Garmin's own score beside ours
   * -------------------------------------------------------------- */

  it('leads with Garmin when Garmin has a score, and labels the badge from it', () => {
    const { container } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true,
        enabled: true
      }
    });
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('Bardzo niska');
    expect(container.textContent).toContain('wynik Garmina, 0–100');
    expect(container.textContent).toContain('Garmin: gotowość bardzo niska');
    // The header badge follows the score on screen: Garmin says strained, not our "rested".
    expect(container.textContent).toContain('Obciążony');
    expect(container.textContent).not.toContain('Wypoczęty');
  });

  it('switches to our own composite and remembers the choice', async () => {
    const { container, getByRole } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true,
        enabled: true
      }
    });

    await getByRole('radio', { name: 'Twoja baza' }).click();

    expect(container.textContent).toContain('74'); // our score
    expect(container.textContent).toContain('na podstawie 12 dni');
    expect(container.textContent).toContain('Jesteś wypoczęty — HRV powyżej bazy');
    expect(container.textContent).toContain('Wypoczęty');
    expect(localStorage.getItem('vagus.condition.source')).toBe('own');
  });

  it('honours a remembered preference on the next render', () => {
    localStorage.setItem('vagus.condition.source', 'own');
    const { container } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true,
        enabled: true
      }
    });
    expect(container.textContent).toContain('na podstawie 12 dni');
  });

  it('shows Garmin recovery time whichever score leads, and says "gotowy" at zero', () => {
    const withTimer = render(ConditionCard, {
      props: {
        condition: snapshot({
          garmin: garminReadiness(),
          recovery: { day: '2026-08-07', hours: 34, change: 'krótszy niż wczoraj' }
        }),
        connected: true,
        enabled: true
      }
    });
    const timer = withTimer.container.querySelector('.recovery');
    expect(timer!.textContent).toContain('1 dzień 10 h');
    expect(timer!.textContent).toContain('do pełnej regeneracji wg Garmina');
    expect(timer!.textContent).toContain('krótszy niż wczoraj');
    cleanup();

    const ready = render(ConditionCard, {
      props: {
        condition: snapshot({ recovery: { day: '2026-08-07', hours: 0, change: null } }),
        connected: true,
        enabled: true
      }
    });
    // No Garmin score here — the timer is still shown, because it is Garmin's fact either way.
    expect(ready.container.querySelector('.recovery')!.textContent).toContain('gotowy');
  });

  it('falls back to our composite with a note, and no switch, when Garmin has nothing', () => {
    const { container, queryByRole } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true, enabled: true }
    });
    expect(queryByRole('radio', { name: 'Garmin' })).toBeNull();
    expect(container.textContent).toContain('Garmin nie przysłał dla tego konta swojego wyniku');
    expect(container.textContent).toContain('74');
    expect(container.querySelector('.recovery')).toBeNull();
  });

  it('explains the number on screen, per source', async () => {
    const { getByRole, container } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true,
        enabled: true
      }
    });

    const help = getByRole('button', { name: 'Jak liczymy ten wynik?' });
    expect(help.getAttribute('aria-expanded')).toBe('false');
    await help.click();
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Training Readiness Garmina');
    expect(container.textContent).toContain('ACWR');

    // Same affordance, different explanation, once the other source leads. (Switching counts as a
    // click outside, so the panel closes — reopening it is what a reader would do.)
    await getByRole('radio', { name: 'Twoja baza' }).click();
    expect(help.getAttribute('aria-expanded')).toBe('false');
    await help.click();
    expect(container.textContent).toContain('Body Battery — 30%');
    expect(container.textContent).toContain('tętno spoczynkowe — 15%');
    expect(container.textContent).toContain('nie diagnoza medyczna');
  });
});
