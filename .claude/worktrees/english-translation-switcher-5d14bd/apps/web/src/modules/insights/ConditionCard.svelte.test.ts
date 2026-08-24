import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ConditionCard from './ConditionCard.svelte';
import type {
  ConditionMetric,
  ConditionSnapshot,
  GarminReadiness,
  IntradayPoint,
  RecoveryTime
} from './insights.types';

afterEach(() => {
  cleanup();
  // The source switch remembers per device (spec 059); a leftover choice must not leak between tests.
  localStorage.clear();
});

/**
 * Rendered text with every run of whitespace collapsed to one space.
 *
 * Markup wraps its lines for readability, so a sentence in the template arrives in `textContent`
 * with a newline and indentation dropped somewhere in the middle of it — where exactly depends on
 * the source's line length, which no reader ever sees. Assert against the sentence, not against
 * where the formatter happened to break it.
 */
function text(node: Element | null): string {
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

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
    staleDays: 0,
    readiness: {
      score: 74,
      band: 'high',
      drivers: [{ key: 'hrv', label: 'HRV', accent: 'green', z: 1.1, direction: 'up', contribution: 21 }],
      basisDays: 12,
      limitedBy: null
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
/**
 * A recovery timer with NO capture instant by default (spec 075) — the pre-075 shape, which is what
 * the spec 072 tests below are about: without an anchor the figure can only be repeated and dated.
 * Pass `capturedAt`/`endsAt` to get the countdown.
 */
function recoveryTime(over: Partial<RecoveryTime> = {}): RecoveryTime {
  return {
    day: '2026-08-07',
    minutes: 2040,
    changeKey: null,
    capturedAt: null,
    endsAt: null,
    superseded: false,
    ...over
  };
}

function garminReadiness(over: Partial<GarminReadiness> = {}): GarminReadiness {
  return {
    day: '2026-08-07',
    staleDays: 0,
    score: 12,
    level: 'poor',
    state: 'strained',
    factors: [
      { key: 'sleep', labelKey: 'garminReadiness.factor.sleep', accent: 'indigo', percent: 74 },
      { key: 'recovery', labelKey: 'garminReadiness.factor.sleep', accent: 'cyan', percent: 10 }
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
      props: { condition: snapshot(), connected: true }
    });

    expect(text(container)).toContain('74'); // readiness score, absorbed from ReadinessCard
    expect(text(container)).toContain('Wypoczęty');
    expect(text(container)).toContain('Jesteś wypoczęty — HRV powyżej bazy');
    expect(text(container)).toContain('7 h 31 min');
    expect(text(container)).toContain('Body Battery');
    expect(text(container)).toContain('Tętno spoczynkowe');
  });

  it('renders the sleep stat cluster: score, efficiency, bedtime and wake time', () => {
    const { container } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true }
    });
    const labels = Array.from(container.querySelectorAll('.readout-label')).map((n) => text(n));
    expect(labels).toEqual(['Wynik snu', 'Efektywność', 'Zaśnięcie', 'Pobudka']);
    expect(text(container)).toContain('23:15');
    expect(text(container)).toContain('07:05');
    expect(text(container)).toContain('94%');
  });

  it('breaks the night into its stages with an accessible summary', () => {
    const { getByRole } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true }
    });
    const name = getByRole('img', { name: /Fazy snu/ }).getAttribute('aria-label') ?? '';
    expect(name).toContain('Głęboki 1 h 20 min');
    expect(name).toContain('REM 1 h 40 min');
  });

  it('colours each channel by whether the move was healthy, not by its sign', () => {
    const { container } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true }
    });
    const deltas = Array.from(container.querySelectorAll('.channel-delta'));
    // Body Battery down = bad; HRV up = good; resting HR up = bad (lower is better).
    const tone = (el: Element): string =>
      ['good', 'bad', 'flat'].find((c) => el.classList.contains(c)) ?? 'none';
    expect(deltas.map(tone)).toEqual(['bad', 'good', 'bad']);
    expect(text(deltas[2]!)).toContain('+12,0%');
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
      props: { condition: bare, connected: true }
    });
    expect(text(container)).toContain('6 h 00 min');
    expect(container.querySelectorAll('.readout').length).toBe(0);
    expect(container.querySelector('.track')).toBeNull();
  });

  it('draws the last 24 h of Body Battery beside the gauge, on a clock axis', () => {
    const { container, getByRole } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true }
    });
    const chart = container.querySelector('.battery');
    expect(chart).not.toBeNull();
    // The aria summary proves the trace is the battery series, not another channel's.
    expect(getByRole('img', { name: /Body Battery trend/ })).toBeTruthy();
    expect(text(chart)).toContain('ostatnia doba');
    // 04:00 UTC is 06:00 in the app's timezone — the axis reads as wall clock, not as UTC.
    expect(text(chart)).toContain('06:00');
  });

  it('omits the battery block — rather than drawing an empty frame — without enough readings', () => {
    const thin = snapshot({ batteryDay: batteryDay([74]) });
    const { container } = render(ConditionCard, {
      props: { condition: thin, connected: true }
    });
    expect(container.querySelector('.battery')).toBeNull();
    expect(container.querySelector('.hero.with-chart')).toBeNull();
    expect(text(container)).toContain('Body Battery'); // the channel readout stays
  });

  it('still renders without readiness, and says so honestly with nothing at all', () => {
    const noScore = render(ConditionCard, {
      props: { condition: snapshot({ readiness: null, state: 'unknown' }), connected: true }
    });
    expect(text(noScore.container)).toContain('7 h 31 min');
    cleanup();

    const nothing = render(ConditionCard, { props: { condition: null, connected: true } });
    expect(text(nothing.container)).toContain('Za mało danych');
  });

  it('has not-connected and loading states', () => {
    const off = render(ConditionCard, { props: { condition: null, connected: false } });
    expect(text(off.container)).toContain('Połącz konto Garmin');
    cleanup();

    cleanup();

    const loading = render(ConditionCard, {
      props: { condition: null, connected: true, loading: true }
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
        connected: true
      }
    });
    expect(text(container)).toContain('12');
    expect(text(container)).toContain('Bardzo niska');
    expect(text(container)).toContain('wynik Garmina, 0–100');
    expect(text(container)).toContain('Garmin: gotowość bardzo niska');
    // The header badge follows the score on screen: Garmin says strained, not our "rested".
    expect(text(container)).toContain('Obciążony');
    expect(text(container)).not.toContain('Wypoczęty');
  });

  it('switches to our own composite and remembers the choice', async () => {
    const { container, getByRole } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true
      }
    });

    await getByRole('radio', { name: 'Twoja baza' }).click();

    expect(text(container)).toContain('74'); // our score
    expect(text(container)).toContain('na podstawie 12 dni');
    expect(text(container)).toContain('Jesteś wypoczęty — HRV powyżej bazy');
    expect(text(container)).toContain('Wypoczęty');
    expect(localStorage.getItem('openvitals.condition.source')).toBe('own');
  });

  it('honours a remembered preference on the next render', () => {
    localStorage.setItem('openvitals.condition.source', 'own');
    const { container } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true
      }
    });
    expect(text(container)).toContain('na podstawie 12 dni');
  });

  it('shows Garmin recovery time whichever score leads, and says "gotowy" at zero', () => {
    const withTimer = render(ConditionCard, {
      props: {
        condition: snapshot({
          garmin: garminReadiness(),
          recovery: recoveryTime({
            minutes: 2040,
            changeKey: 'garminReadiness.change.decreased'
          })
        }),
        connected: true
      }
    });
    const timer = withTimer.container.querySelector('.recovery');
    expect(text(timer)).toContain('1 dzień 10 h');
    expect(text(timer)).toContain('do pełnej regeneracji wg Garmina');
    expect(text(timer)).toContain('krótszy niż wczoraj');
    cleanup();

    const ready = render(ConditionCard, {
      props: {
        condition: snapshot({ recovery: recoveryTime({ minutes: 0 }) }),
        connected: true
      }
    });
    // No Garmin score here — the timer is still shown, because it is Garmin's fact either way.
    expect(text(ready.container.querySelector('.recovery'))).toContain('gotowy');
  });

  it('falls back to our composite with a note, and no switch, when Garmin has nothing', () => {
    const { container, queryByRole } = render(ConditionCard, {
      props: { condition: snapshot(), connected: true }
    });
    expect(queryByRole('radio', { name: 'Garmin' })).toBeNull();
    expect(text(container)).toContain('Garmin nie przysłał dla tego konta swojego wyniku');
    expect(text(container)).toContain('74');
    expect(container.querySelector('.recovery')).toBeNull();
  });

  it('explains the number on screen, per source', async () => {
    const { getByRole, container } = render(ConditionCard, {
      props: {
        condition: snapshot({ garmin: garminReadiness() }),
        connected: true
      }
    });

    const help = getByRole('button', { name: 'Jak liczymy ten wynik?' });
    expect(help.getAttribute('aria-expanded')).toBe('false');
    await help.click();
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(text(container)).toContain('Training Readiness Garmina');
    expect(text(container)).toContain('ACWR');

    // Same affordance, different explanation, once the other source leads. (Switching counts as a
    // click outside, so the panel closes — reopening it is what a reader would do.)
    await getByRole('radio', { name: 'Twoja baza' }).click();
    expect(help.getAttribute('aria-expanded')).toBe('false');
    await help.click();
    expect(text(container)).toContain('Body Battery — 30%');
    expect(text(container)).toContain('tętno spoczynkowe — 15%');
    expect(text(container)).toContain('nie diagnoza medyczna');
  });

  /*
   * Spec 072. The card reads off the newest day the store holds — which is today only while the
   * watch keeps uploading. When it stops, EVERY figure here (score, timer, sleep, channels) belongs
   * to that older day, and until now the card presented all of it as "right now".
   */
  describe('a snapshot that is not from today', () => {
    it('adds nothing at all while the data is current', () => {
      const { container } = render(ConditionCard, {
        props: { condition: snapshot({ garmin: garminReadiness() }), connected: true }
      });

      expect(text(container)).not.toContain('Garmin nie ma danych nowszych');
      expect(text(container)).not.toContain('stan na');
    });

    it('says which day it is showing, above everything it describes', () => {
      const { container } = render(ConditionCard, {
        props: {
          condition: snapshot({
            staleDays: 2,
            garmin: garminReadiness({ staleDays: 2 }),
            recovery: recoveryTime({ minutes: 3672 })
          }),
          connected: true
        }
      });

      expect(text(container)).toContain('Garmin nie ma danych nowszych niż 7 sie');
      // The actionable half: our sync already did its job, the watch has not.
      expect(text(container)).toContain('Garmin Connect');
      // And beside the score itself, for a reader who never reads the banner.
      expect(text(container)).toContain('stan na 7 sie');
    });

    it('stops presenting the recovery timer as a live countdown', () => {
      const { container } = render(ConditionCard, {
        props: {
          condition: snapshot({
            staleDays: 2,
            garmin: garminReadiness({ staleDays: 2 }),
            recovery: recoveryTime({ minutes: 3672 })
          }),
          connected: true
        }
      });

      const recovery = container.querySelector('.recovery');
      // The figure Garmin published stays; what changes is that it is dated rather than implied now.
      expect(text(recovery)).toContain('2 dni 13 h');
      expect(text(recovery)).toContain('stan na 7 sie');
    });
  });

  /**
   * Spec 075 — with Garmin's capture instant the timer stops being a frozen number. `now` is passed
   * explicitly here so the assertions describe a fixed moment rather than whenever CI happens to run.
   */
  describe('the recovery timer, anchored (spec 075)', () => {
    const CAPTURED = Date.UTC(2026, 7, 16, 15, 54, 57);
    const ENDS = Date.UTC(2026, 7, 17, 7, 43, 57);

    const anchored = (over: Partial<RecoveryTime> = {}) =>
      recoveryTime({ day: '2026-08-16', minutes: 949, capturedAt: CAPTURED, endsAt: ENDS, ...over });

    it('counts down without a sync, and names the moment recovery lands', () => {
      const { container } = render(ConditionCard, {
        props: {
          condition: snapshot({ garmin: garminReadiness(), recovery: anchored() }),
          connected: true,
          now: CAPTURED + 6 * 60 * 60_000
        }
      });

      const recovery = container.querySelector('.recovery');
      expect(text(recovery)).toContain('10 h'); // 949 − 360 minutes, not the captured 16 h
      expect(text(recovery)).toContain('do pełnej regeneracji wg Garmina');
      expect(text(recovery)).toContain('pełna regeneracja: jutro 09:43');
    });

    it('says you are recovered once the moment has passed, with no new data', () => {
      const { container } = render(ConditionCard, {
        props: {
          // Still dated two days back — the point is that the CARD no longer needs a sync to move on.
          condition: snapshot({ staleDays: 2, recovery: anchored() }),
          connected: true,
          now: ENDS + 60_000
        }
      });

      const recovery = container.querySelector('.recovery');
      expect(text(recovery)).toContain('wg Garmina jesteś zregenerowany');
      expect(text(recovery)).not.toContain('stan na');
    });

    it('drops the "as of that day" note for a stale reading whose timer is still derivable', () => {
      const { container } = render(ConditionCard, {
        props: {
          condition: snapshot({ staleDays: 2, recovery: anchored() }),
          connected: true,
          now: CAPTURED + 3 * 60 * 60_000
        }
      });

      const recovery = container.querySelector('.recovery');
      expect(text(recovery)).toContain('13 h');
      expect(text(recovery)).not.toContain('stan na');
    });

    it('freezes again — figure and date — once a later session superseded the reading', () => {
      const { container } = render(ConditionCard, {
        props: {
          condition: snapshot({ staleDays: 2, recovery: anchored({ superseded: true }) }),
          connected: true,
          now: CAPTURED + 6 * 60 * 60_000
        }
      });

      const recovery = container.querySelector('.recovery');
      expect(text(recovery)).toContain('16 h'); // the captured 949 minutes, not a countdown
      expect(text(recovery)).toContain('stan na 16 sie');
      expect(text(recovery)).not.toContain('pełna regeneracja:');
    });
  });
});
