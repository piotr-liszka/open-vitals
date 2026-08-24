<script lang="ts">
  /**
   * Intensity distribution: time in heart-rate zones and, for power meters, the Coggan power-zone
   * donut plus the mean-max ("best power") table (spec 026 — re-homed from the old page tail so all
   * three live in one section instead of three appended cards).
   *
   * HR zones prefer Garmin's own `hrTimeInZone_*` (the athlete's configured zones) and fall back to
   * our %-of-max estimate, saying which one is on screen.
   *
   * Spec 086 adds the "where do these come from" disclosure in the card header. It names the ONE HR
   * source actually on screen for this activity instead of describing both, and its bands come from
   * the shared table in `$lib/analytics/zones` — the same table the bucketing functions use — so the
   * prose cannot drift away from the maths.
   */
  import Card from '$lib/ui/Card.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import Table from '$lib/ui/Table.svelte';
  import { formatInteger, getI18n } from '$lib/i18n';
  import { formatZoneBand, HR_ZONE_BANDS, POWER_ZONE_COPY } from '$lib/analytics/zones';
  import { buildHrZones } from './activity-stat-groups';
  import { fmtDuration, fmtNum } from './activity-format';
  import type { ActivityStats, HrBlock, PowerBlock } from './activity-detail.types';
  import type { ZoneBucket } from '$lib/server/analytics/activity-power';

  interface Props {
    hr: HrBlock | null;
    stats: ActivityStats;
    power: PowerBlock | null;
    weightKg: number | null;
    /** FTP the power percentages are taken from; `null` when there is none to take them from. */
    ftp: number | null;
    /** True when `ftp` was estimated from this session's curve rather than read from settings. */
    ftpEstimated: boolean;
  }

  let { hr, stats, power, weightKg, ftp, ftpEstimated }: Props = $props();

  const i18n = getI18n();

  const zones = $derived(buildHrZones(stats.hr.timeInZoneS, hr?.zones ?? []));

  /* ---- power-zone donut: one arc per zone, sized by its share of the time ---- */
  const ZONE_COLORS = [
    'var(--lane-cyan)',
    'var(--lane-green)',
    'var(--lane-lime)',
    'var(--lane-amber)',
    'var(--lane-orange)',
    'var(--lane-red)',
    'var(--lane-violet)'
  ];
  const R = 60;
  const CIRC = 2 * Math.PI * R;

  function arcs(buckets: ZoneBucket[]): Array<{ zone: number; color: string; dash: number; offset: number }> {
    const total = buckets.reduce((s, z) => s + z.seconds, 0);
    if (total <= 0) return [];
    let acc = 0;
    return buckets
      .filter((z) => z.seconds > 0)
      .map((z) => {
        const frac = z.seconds / total;
        const seg = {
          zone: z.zone,
          color: ZONE_COLORS[z.zone - 1] ?? 'var(--color-accent)',
          dash: frac * CIRC,
          offset: -acc * CIRC
        };
        acc += frac;
        return seg;
      });
  }

  const powerArcs = $derived(power ? arcs(power.zones) : []);
  /** The power half of the explanation exists only when there is a donut on screen to explain. */
  const showPower = $derived(power !== null && powerArcs.length > 0);
  const topZone = $derived(
    power && power.zones.length > 0
      ? power.zones.reduce((m, z) => (z.seconds > m.seconds ? z : m), power.zones[0]!)
      : null
  );

  // Hover / tap a segment (or its legend row) to read that zone; the centre falls back to the
  // dominant one so it is never empty (spec 016).
  let activeZone = $state<number | null>(null);
  const hoveredZone = $derived(
    activeZone === null ? null : (power?.zones.find((z) => z.zone === activeZone) ?? null)
  );
  const centreZone = $derived(hoveredZone ?? topZone);
  const zoneReadout = $derived(
    hoveredZone ? `${hoveredZone.label}: ${hoveredZone.pct}%, ${fmtDuration(hoveredZone.seconds)}` : ''
  );

  /** Best-power table label per duration. */
  function durLabel(s: number): string {
    if (s < 60) return `${s} s`;
    if (s % 60 === 0 && s < 3600) return `${s / 60} min`;
    if (s % 3600 === 0) return `${s / 3600} h`;
    return `${Math.round(s / 60)} min`;
  }
</script>

{#if zones || powerArcs.length > 0}
  <Card
    title="Strefy intensywności"
    subtitle={zones?.source === 'estimated'
      ? 'Strefy tętna oszacowane z tętna maksymalnego tej aktywności'
      : 'Czas spędzony w strefach'}
    overflowVisible
  >
    {#snippet actions()}
      <InfoPopover label={i18n.t('zones.explainLabel')} title={i18n.t('zones.explainTitle')} align="end">
        {#if zones?.source === 'garmin'}
          <p>{i18n.t('zones.hrGarmin')}</p>
        {:else if zones}
          <p>{i18n.t('zones.hrEstimatedIntro')}</p>
          <ul>
            {#each HR_ZONE_BANDS as band (band.zone)}
              <li>{i18n.t('zones.hrBand', { zone: band.zone, range: formatZoneBand(band) })}</li>
            {/each}
          </ul>
          <p>{i18n.t('zones.hrEstimatedMax')}</p>
        {/if}

        {#if showPower}
          <p>{i18n.t('zones.powerIntro')}</p>
          <ul>
            {#each POWER_ZONE_COPY as z (z.zone)}
              <li>
                {i18n.t('zones.powerBand', {
                  name: i18n.t(z.nameKey),
                  range: z.range,
                  use: i18n.t(z.useKey)
                })}
              </li>
            {/each}
          </ul>
          {#if ftp !== null}
            <p>
              {i18n.t(ftpEstimated ? 'zones.ftpEstimated' : 'zones.ftpConfigured', {
                ftp: formatInteger(i18n.locale, ftp)
              })}
            </p>
          {/if}
          {#if ftpEstimated}
            <p>{i18n.t('zones.ftpNoSettings')}</p>
          {/if}
        {/if}
      </InfoPopover>
    {/snippet}

    <div class="cols">
      {#if zones}
        <div class="block">
          <h4 class="block-title">Tętno</h4>
          <ul class="bars">
            {#each zones.bars as bar (bar.zone)}
              <li>
                <span class="b-label">{bar.label}</span>
                <span class="b-track">
                  <span class="b-fill" style="width: {bar.pct}%; background: {bar.color}"></span>
                </span>
                <span class="b-pct">{bar.pct}%</span>
                <span class="b-time">{fmtDuration(bar.seconds)}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if power && powerArcs.length > 0}
        <div class="block">
          <h4 class="block-title">Moc</h4>
          <!-- Pointer leaves anywhere in the block → back to the dominant zone. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="donut-wrap" onpointerleave={() => (activeZone = null)}>
            <svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Rozkład czasu w strefach mocy">
              <circle class="track" cx="80" cy="80" r={R} />
              {#each powerArcs as seg (seg.zone)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle
                  class="arc"
                  class:dim={activeZone !== null && activeZone !== seg.zone}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  stroke-width="18"
                  stroke-dasharray={`${seg.dash} ${CIRC - seg.dash}`}
                  stroke-dashoffset={seg.offset}
                  transform="rotate(-90 80 80)"
                  onpointerenter={() => (activeZone = seg.zone)}
                  onpointerdown={() => (activeZone = seg.zone)}
                />
              {/each}
              {#if centreZone}
                <text x="80" y="74" class="d-value" text-anchor="middle">{centreZone.label}</text>
                <text x="80" y="94" class="d-label" text-anchor="middle">{centreZone.pct}%</text>
              {/if}
            </svg>
            <ul class="legend">
              {#each power.zones as z (z.zone)}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <li
                  class:active={activeZone === z.zone}
                  onpointerenter={() => (activeZone = z.zone)}
                  onpointerdown={() => (activeZone = z.zone)}
                >
                  <span class="swatch" style="background: {ZONE_COLORS[z.zone - 1]}"></span>
                  <span class="z-label">{z.label}</span>
                  <span class="z-pct">{z.pct}%</span>
                  <span class="z-time">{fmtDuration(z.seconds)}</span>
                </li>
              {/each}
            </ul>
            <span class="sr-only" aria-live="polite">{zoneReadout}</span>
          </div>
        </div>
      {/if}
    </div>
  </Card>
{/if}

{#if power && power.curve.length > 0}
  <Card title="Najlepsza moc" subtitle="Najwyższa średnia moc dla każdego czasu trwania">
    <Table zebra>
      {#snippet head()}
        <th>Czas</th>
        <th class="num">Moc</th>
        {#if weightKg}<th class="num">W/kg</th>{/if}
      {/snippet}
      {#each power.curve as p (p.durationS)}
        <tr>
          <td>{durLabel(p.durationS)}</td>
          <td class="num">{fmtNum(p.watts)} W</td>
          {#if weightKg}<td class="num">{fmtNum(p.watts / weightKg, 1)}</td>{/if}
        </tr>
      {/each}
    </Table>
  </Card>
{/if}

<style>
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-6);
    align-items: start;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .block-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .bars li {
    display: grid;
    grid-template-columns: minmax(56px, auto) 1fr auto auto;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .b-label {
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }

  .b-track {
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .b-fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-full);
  }

  .b-pct,
  .b-time {
    text-align: right;
    min-width: 5ch;
  }

  .donut-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .donut {
    width: 160px;
    height: 160px;
    flex-shrink: 0;
  }

  .donut .track {
    fill: none;
    stroke: var(--color-surface-2);
    stroke-width: 18;
  }

  .arc {
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }

  /* Read-out open: the picked segment keeps full strength, the rest step back. */
  .arc.dim {
    opacity: 0.3;
  }

  .d-value {
    fill: var(--color-text);
    font-size: 22px;
    font-weight: var(--font-black);
  }

  .d-label {
    fill: var(--color-text-muted);
    font-size: 12px;
  }

  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 140px;
  }

  .legend li {
    display: grid;
    grid-template-columns: auto 2ch 1fr auto;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  /* Legend and donut are two views of the same read-out — hovering either highlights both. */
  .legend li.active {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-sm);
  }

  .z-label {
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }

  .z-pct,
  .z-time {
    text-align: right;
  }

  .num {
    text-align: right;
  }

  td.num {
    font-feature-settings: var(--numeric);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
