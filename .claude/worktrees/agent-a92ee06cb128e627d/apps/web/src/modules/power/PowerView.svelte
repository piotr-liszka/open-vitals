<script lang="ts">
  /** Power Profile view (PWRX §5), scoped to cycling by the loader (spec 025): rider-type radar
   * (inline-SVG pentagon), FTP + Coggan zones, all-time best-power tiles (W/kg + date), a yearly
   * power-curve comparison and a yearly best-efforts table. All data is from the loader;
   * presentational only.
   *
   * The year curves are the shared `TrendChart` multi-series primitive — its own legend doubles as
   * the year selector, which is why the bespoke chip row and inline SVG are gone. One consequence
   * is deliberate: the duration axis is now evenly spaced per sampled duration rather than log-scaled,
   * so the short end of the curve is no longer visually compressed. */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Table from '$lib/ui/Table.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import RadarChart from '$lib/ui/RadarChart.svelte';
  import type { RadarAxis } from '$lib/ui/RadarChart.svelte';
  import type { ChartSeries } from '$lib/ui/chart-axis';
  import { formatDay } from '$lib/date';
  import type { PowerData, RiderAxisKey } from './power.types';
  import { formatInteger, formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { data }: { data: PowerData } = $props();

  // ---- formatting ----
  const fmtDate = (day: string | null): string => (day ? formatDay(i18n.locale, day, 'shortYear') : '—');
  function fmtDur(s: number): string {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}min`;
    const h = s / 3600;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  const wkg = (n: number | null): string => (n == null ? '—' : `${n.toFixed(2)} W/kg`);

  // ---- rider radar ----
  // Per-axis "elite" W/kg used to normalise each spoke to a 0..1 radius (Coggan power-profile scale).
  // The DRAWING is `lib/ui/RadarChart` (spec 033) — only this normalisation is cycling's business.
  const REF_WKG: Record<RiderAxisKey, number> = {
    sprint: 22,
    punch: 11.5,
    climb: 7.6,
    tt: 6.6,
    endurance: 5.9
  };
  const maxAxisWatts = $derived(Math.max(1, ...data.radar.map((a) => a.watts)));

  function axisFrac(key: RiderAxisKey, watts: number, wattsPerKg: number | null): number {
    const f = wattsPerKg != null ? wattsPerKg / REF_WKG[key] : watts / maxAxisWatts;
    return Math.max(0, Math.min(1, f));
  }

  const radarAxes = $derived<RadarAxis[]>(
    data.radar.map((a) => ({
      key: a.key,
      label: a.label,
      value: axisFrac(a.key, a.watts, a.wattsPerKg)
    }))
  );

  // ---- yearly power curve ----
  const LANE = [
    '--lane-orange',
    '--lane-cyan',
    '--lane-green',
    '--lane-violet',
    '--lane-amber',
    '--lane-sky',
    '--lane-teal',
    '--lane-lime'
  ];
  const yearColor = (year: number): string => `var(${LANE[data.years.indexOf(year) % LANE.length]})`;

  /** The x lattice: one slot per sampled duration, shared by every curve. */
  const curveLabels = $derived(data.durations.map((d) => fmtDur(d)));

  /** Watts for each sampled duration, gaps where a year never held that effort. */
  function alongLattice(points: ReadonlyArray<{ durationS: number; watts: number }>): number[] {
    const byDuration = new Map(points.map((p) => [p.durationS, p.watts]));
    return data.durations.map((d) => byDuration.get(d) ?? Number.NaN);
  }

  const curveSeries = $derived<ChartSeries[]>([
    { name: 'Rekord', values: alongLattice(data.allTimeCurve), color: 'var(--color-text-muted)' },
    ...data.yearCurves.map((c) => ({
      name: String(c.year),
      values: alongLattice(c.points),
      color: yearColor(c.year)
    }))
  ]);

  // ---- yearly best-efforts table ----
  const TABLE_DURS = [5, 60, 300, 1200, 3600];
  const tableCols = $derived(TABLE_DURS.filter((d) => data.durations.includes(d)));
  function bestOfYear(year: number, dur: number): number | null {
    return (
      data.yearCurves.find((c) => c.year === year)?.points.find((p) => p.durationS === dur)?.watts ?? null
    );
  }
  const colBest = $derived(
    new Map(tableCols.map((d) => [d, Math.max(0, ...data.years.map((y) => bestOfYear(y, d) ?? 0))]))
  );
</script>

<div class="power">
  {#if !data.hasPower}
    <Card title={i18n.t('power.emptyTitle')} subtitle={i18n.t('power.emptySubtitle')}>
      <p class="empty">
        {i18n.t('power.emptyBody')} <a href="/data">{i18n.t('nav.data')}</a>.
      </p>
    </Card>
  {:else}
    <div class="grid-2">
      <Card
        title="Analiza typu zawodnika"
        subtitle={data.weightKg ? `Masa ${data.weightKg} kg · W/kg` : 'Masa nieznana · waty'}
      >
        <div class="radar-wrap">
          <RadarChart axes={radarAxes} ariaLabel="Radar typu zawodnika" />
        </div>
        <dl class="axis-list">
          {#each data.radar as a (a.key)}
            <div class="axis-row">
              <dt>{a.label}</dt>
              <dd>
                {a.watts} W{#if a.wattsPerKg}
                  · {a.wattsPerKg.toFixed(2)} W/kg{/if}
              </dd>
            </div>
          {/each}
        </dl>
      </Card>

      <Card title="FTP i strefy mocy">
        <div class="ftp">
          <div class="ftp-main">
            <span class="ftp-val">{data.ftpWatts ?? '—'}<span class="u">W</span></span>
            <span class="ftp-sub"
              >{wkg(data.ftpWattsPerKg)}
              {#if data.ftpSource === 'settings'}<Badge tone="info">{i18n.t('power.ftpFromSettings')}</Badge
                >{:else if data.ftpSource === 'estimated'}<Badge tone="neutral">szacowane</Badge>{/if}
            </span>
          </div>
          <div class="ftp-side">
            <div>
              <span class="k">Szac. 20 min</span><span class="v">{data.best20MinWatts ?? '—'} W</span>
            </div>
            <div>
              <span class="k">Najlepsze 60 min</span><span class="v">{data.best60MinWatts ?? '—'} W</span>
            </div>
          </div>
        </div>
        {#if data.zones.length > 0}
          <ul class="zones">
            {#each data.zones as z (z.zone)}
              <li class="zone">
                <span class="zbar" style={`--w: ${Math.min(100, ((z.maxPct ?? 1.7) * 100) / 1.7)}%`}></span>
                <span class="zname">Z{z.zone} · {z.name}</span>
                <span class="zrange">{z.minW}{z.maxW != null ? `–${z.maxW}` : '+'} W</span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>

    <Card title={i18n.t('power.recordsTitle')} subtitle={i18n.t('power.recordsSubtitle')}>
      <div class="tiles">
        {#each data.bests as b (b.durationS)}
          <div class="tile">
            <span class="t-dur">{fmtDur(b.durationS)}</span>
            <span class="t-w">{b.watts}<span class="u">W</span></span>
            <span class="t-meta"
              >{b.wattsPerKg != null ? `${b.wattsPerKg.toFixed(2)} W/kg · ` : ''}{fmtDate(b.day)}</span
            >
          </div>
        {/each}
      </div>
    </Card>

    {#if data.yearCurves.length > 0}
      <Card title={i18n.t('power.compareTitle')} subtitle={i18n.t('power.compareSubtitle')}>
        <TrendChart
          series={curveSeries}
          labels={curveLabels}
          height={320}
          unit="W"
          label="Krzywa mocy"
          formatValue={(n) => `${Math.round(n)} W`}
        />
      </Card>

      {#if tableCols.length > 0}
        <Card title="Najlepsze wyniki wg roku">
          <Table zebra caption={i18n.t('power.tableCaption')}>
            {#snippet head()}
              <th scope="col">Rok</th>
              {#each tableCols as d (d)}<th scope="col">{fmtDur(d)}</th>{/each}
            {/snippet}
            {#each data.years as y (y)}
              <tr>
                <td class="yr">{y}</td>
                {#each tableCols as d (d)}
                  {@const w = bestOfYear(y, d)}
                  <td class:best={w != null && w === colBest.get(d) && w > 0}>{w != null ? `${w} W` : '—'}</td
                  >
                {/each}
              </tr>
            {/each}
          </Table>
        </Card>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .power {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5);
  }
  @media (max-width: 900px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
  .empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .empty a {
    color: var(--color-accent);
  }

  /* radar */
  .radar-wrap {
    display: flex;
    justify-content: center;
  }
  .axis-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: var(--space-4) 0 0;
  }
  .axis-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }
  .axis-row dt {
    color: var(--color-text-muted);
  }
  .axis-row dd {
    margin: 0;
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  /* ftp + zones */
  .ftp {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .ftp-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .ftp-val {
    font-size: var(--readout-xl);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
  .u {
    font-size: var(--readout-unit);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
    margin-left: 2px;
  }
  .ftp-sub {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }
  .ftp-side {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .ftp-side div {
    display: flex;
    flex-direction: column;
  }
  .ftp-side .k {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }
  .ftp-side .v {
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
  .zones {
    list-style: none;
    margin: var(--space-4) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .zone {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    overflow: hidden;
    font-size: var(--text-sm);
  }
  .zbar {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--w);
    background: var(--color-accent-soft);
  }
  .zname,
  .zrange {
    position: relative;
    z-index: 1;
  }
  .zname {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }
  .zrange {
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  /* best tiles */
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space-3);
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .t-dur {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
    font-weight: var(--font-semibold);
  }
  .t-w {
    font-size: var(--readout-md);
    font-weight: var(--font-black);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
  .t-meta {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .yr {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }
  :global(.table td.best) {
    color: var(--color-accent);
    font-weight: var(--font-bold);
  }
</style>
