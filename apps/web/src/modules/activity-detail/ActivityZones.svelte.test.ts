/**
 * Spec 086 — the "where do these zones come from" disclosure on the intensity card.
 *
 * The interesting behaviour is not that a popover opens; it is that the panel names the ONE source
 * on screen for THIS activity (Garmin's configured zones or our %-of-max estimate), and that it says
 * nothing about power when there is no donut to explain.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivityZones from './ActivityZones.svelte';
import type { ActivityStats, HrBlock, PowerBlock } from './activity-detail.types';
import type { ZoneBucket } from '$lib/server/analytics/activity-power';
import { createTranslator } from '$lib/i18n';

afterEach(cleanup);

/** Assert against the catalog, not against a second copy of the copy. */
const t = createTranslator('pl');

function emptyStats(over: Partial<ActivityStats> = {}): ActivityStats {
  return {
    calories: {},
    hydration: {},
    respiration: {},
    trainingEffect: {},
    stamina: {},
    hr: {},
    timing: {},
    power: {},
    elevation: {},
    pace: {},
    runningDynamics: {},
    temperature: {},
    intensityMinutes: {},
    bodyBattery: {},
    stress: {},
    selfEvaluation: {},
    runWalk: {},
    ...over
  };
}

const buckets = (seconds: readonly number[]): ZoneBucket[] =>
  seconds.map((s, i) => ({ zone: i + 1, label: `Z${i + 1}`, seconds: s, pct: s / 10 }));

/** The default: our own split, taken against this session's own peak (spec 090's fallback). */
const hrBlock: HrBlock = {
  avg: 140,
  max: 180,
  zoneMax: 180,
  zoneMaxConfigured: false,
  zones: buckets([300, 300, 200, 150, 50])
};

const powerBlock: PowerBlock = {
  avg: 200,
  max: 480,
  np: 215,
  if: 0.86,
  tss: 74,
  kj: 900,
  curve: [{ durationS: 1200, watts: 263 }],
  zones: buckets([120, 400, 300, 100, 50, 20, 10])
};

interface Overrides {
  hr?: HrBlock | null;
  stats?: ActivityStats;
  power?: PowerBlock | null;
  ftp?: number | null;
  ftpEstimated?: boolean;
}

/** Render the card and open the disclosure; returns the panel text. */
async function openPanel(over: Overrides = {}): Promise<{ text: string; label: string }> {
  const view = render(ActivityZones, {
    props: {
      hr: over.hr === undefined ? hrBlock : over.hr,
      stats: over.stats ?? emptyStats(),
      power: over.power === undefined ? powerBlock : over.power,
      weightKg: 72,
      ftp: over.ftp === undefined ? 250 : over.ftp,
      ftpEstimated: over.ftpEstimated ?? true
    }
  });
  const trigger = view.getByRole('button', { name: t('zones.explainLabel') });
  await trigger.click();
  const panel = view.getByRole('group', { name: t('zones.explainTitle') });
  return { text: panel.textContent ?? '', label: trigger.getAttribute('aria-label') ?? '' };
}

describe('ActivityZones — zone explanation', () => {
  it('offers the explanation as a question a screen reader can hear', async () => {
    const { label } = await openPanel();
    expect(label).toBe('Skąd się biorą te strefy?');
    expect(label.endsWith('?')).toBe(true);
  });

  it('names Garmin as the source when Garmin sent time-in-zone', async () => {
    const { text } = await openPanel({
      stats: emptyStats({ hr: { timeInZoneS: [600, 900, 400, 120, 30] } })
    });
    expect(text).toContain(t('zones.hrGarmin'));
    expect(text).not.toContain(t('zones.hrEstimatedIntro'));
    expect(text).not.toContain(t('zones.hrEstimatedMax'));
  });

  it('names our own estimate — and this session as the max — when Garmin sent none', async () => {
    const { text } = await openPanel();
    expect(text).toContain(t('zones.hrEstimatedIntro'));
    expect(text).toContain(t('zones.hrEstimatedMax'));
    expect(text).toContain(t('zones.hrSetInSettings'));
    expect(text).not.toContain(t('zones.hrGarmin'));
  });

  it('says the maximum came from the profile once one is saved (spec 090)', async () => {
    const { text } = await openPanel({
      hr: { ...hrBlock, zoneMax: 175, zoneMaxConfigured: true }
    });
    expect(text).toContain('175 bpm zapisane w Twoim profilu');
    // The two states are exclusive: no "we used this session's peak", no invitation to go set it.
    expect(text).not.toContain(t('zones.hrEstimatedMax'));
    expect(text).not.toContain(t('zones.hrSetInSettings'));
  });

  it('still credits Garmin when Garmin sent the zones, saved maximum or not', async () => {
    const { text } = await openPanel({
      hr: { ...hrBlock, zoneMax: 175, zoneMaxConfigured: true },
      stats: emptyStats({ hr: { timeInZoneS: [600, 900, 400, 120, 30] } })
    });
    // Our %-of-max reference is not what is on screen, so it must not be described as if it were.
    expect(text).toContain(t('zones.hrGarmin'));
    expect(text).not.toContain('175 bpm');
  });

  it('states the five %-of-max bands when the estimate is what is on screen', async () => {
    const { text } = await openPanel();
    expect(text).toContain('Strefa 1 — <60% tętna maksymalnego');
    expect(text).toContain('Strefa 2 — 60–69%');
    expect(text).toContain('Strefa 3 — 70–79%');
    expect(text).toContain('Strefa 4 — 80–89%');
    expect(text).toContain('Strefa 5 — ≥90%');
  });

  it('explains Coggan Z1–Z7 with the band, the name and what it is for', async () => {
    const { text } = await openPanel();
    expect(text).toContain(t('zones.powerIntro'));
    expect(text).toContain('Z1 aktywna regeneracja · <55% FTP');
    expect(text).toContain('Z4 próg · 91–105% FTP');
    expect(text).toContain(t('zones.power.z4.use'));
    expect(text).toContain('Z7 nerwowo-mięśniowa · ≥151% FTP');
  });

  it('says the FTP was estimated, and from what — and where to fix that', async () => {
    const { text } = await openPanel({ ftp: 250, ftpEstimated: true });
    expect(text).toContain('95% najlepszej 20-minutowej mocy tej sesji: 250 W');
    expect(text).toContain(t('zones.ftpSetInSettings'));
    expect(text).not.toContain('zapisanego w ustawieniach');
  });

  it('says the FTP was configured when it came from settings', async () => {
    const { text } = await openPanel({ ftp: 300, ftpEstimated: false });
    expect(text).toContain('FTP 300 W zapisanego w ustawieniach');
    expect(text).not.toContain(t('zones.ftpSetInSettings'));
  });

  it('leaves the power half out entirely when there is no power', async () => {
    const { text } = await openPanel({ power: null });
    expect(text).not.toContain(t('zones.powerIntro'));
    expect(text).not.toContain('Z4 próg');
    expect(text).not.toContain(t('zones.ftpSetInSettings'));
    // …while still explaining the heart-rate half that IS on screen.
    expect(text).toContain(t('zones.hrEstimatedIntro'));
  });

  it('leaves the power half out when a power block carries no zones (no FTP)', async () => {
    const { text } = await openPanel({ power: { ...powerBlock, zones: [] }, ftp: null });
    expect(text).not.toContain(t('zones.powerIntro'));
  });
});
