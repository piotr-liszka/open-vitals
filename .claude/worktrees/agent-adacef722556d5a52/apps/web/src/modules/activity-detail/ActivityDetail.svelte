<script lang="ts">
  /**
   * Single-activity detail (spec 026). Presentational orchestrator: everything comes from the
   * module's `ActivityDetailData`, every decision about *what exists* was already made by the pure
   * helpers (`buildStatSections`, `buildActivityCharts`, `buildLapTable`).
   *
   * Reading order, top to bottom:
   *   1. identity — what this was, when
   *   2. the six headline numbers
   *   3. how good it was, against the athlete's own recent training (user request 5.3)
   *   3b. how it compared to the plan, when one matched (spec 085)
   *   4. where it happened (map)
   *   5. how it unfolded (stream charts on one shared crosshair)
   *   6. how hard it was (HR / power zones, best power)
   *   7. how it was split (laps, run/walk)
   *   8. everything else, grouped (the long tail of Garmin's numbers)
   *
   * Sections 4–8 disappear entirely when their data does not exist, so a treadmill run is a short
   * page and a power-meter ride is a long one.
   */
  import LeafletMap from '$lib/ui/LeafletMap.svelte';
  import type { MapMarker } from '$lib/ui/LeafletMap.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { sportGroup, sportLabel } from '$lib/sport-labels';
  import { formatDay, isDayKey } from '$lib/date';
  import TrainingVerdict from './TrainingVerdict.svelte';
  import PlannedVsActual from './PlannedVsActual.svelte';
  import ActivityFlags from './ActivityFlags.svelte';
  import ActivityEfficiency from './ActivityEfficiency.svelte';
  import ActivityBestEfforts from './ActivityBestEfforts.svelte';
  import SimilarActivities from './SimilarActivities.svelte';
  import ActivityClimbs from './ActivityClimbs.svelte';
  import ActivityStreamsPanel from './ActivityStreamsPanel.svelte';
  import ActivityZones from './ActivityZones.svelte';
  import ActivityLapsPanel from './ActivityLapsPanel.svelte';
  import StatSections from './StatSections.svelte';
  import { buildStatSections } from './activity-stat-groups';
  import { streamLength } from './activity-charts';
  import { DASH, fmtDuration, fmtKm, fmtNum, fmtPace, isNum, paceFromMps, speedKmh } from './activity-format';
  import type { ActivityDetailData } from './activity-detail.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { data }: { data: ActivityDetailData } = $props();

  const a = $derived(data.activity);
  const family = $derived(sportGroup(a.sport));
  const paceSport = $derived(family === 'run' || family === 'walk' || family === 'swim');

  const day = $derived(a.startTimeLocal.slice(0, 10));
  const timeOfDay = $derived(a.startTimeLocal.slice(11, 16));
  const when = $derived(isDayKey(day) ? formatDay(i18n.locale, day, 'weekday') : day);

  const elapsed = $derived(a.movingS ?? a.durationS);
  const avgSpeedMps = $derived(
    isNum(a.distanceM) && isNum(elapsed) && elapsed > 0 ? a.distanceM / elapsed : null
  );
  const avgPace = $derived(data.stats.pace.avgMovingSecPerKm ?? paceFromMps(avgSpeedMps));

  const sections = $derived(
    buildStatSections({
      stats: data.stats,
      sport: family,
      hasTypedSplits: data.typedSplits.length > 0
    })
  );
  const hasStreams = $derived(streamLength(data.streams) > 0);

  // Route map: full track + start (green) / end (red) markers.
  const polylines = $derived(data.gps ? [{ points: data.gps, weight: 4, opacity: 0.95 }] : []);
  function routeMarkers(gps: NonNullable<ActivityDetailData['gps']>): MapMarker[] {
    const start = gps[0];
    const end = gps[gps.length - 1];
    if (!start || !end) return [];
    return [
      { lat: start[0], lng: start[1], color: 'var(--lane-green, #24c67e)' },
      { lat: end[0], lng: end[1], color: 'var(--lane-red, #fb3b5e)' }
    ];
  }
  const markers = $derived<MapMarker[]>(data.gps && data.gps.length > 0 ? routeMarkers(data.gps) : []);
</script>

<div class="detail">
  <header class="hero">
    <div class="titles">
      <div class="crumbs"><a href="/activities">{i18n.t('detail.backToActivities')}</a></div>
      <h1 class="name">{a.name ?? sportLabel(i18n.t, a.sport)}</h1>
      <div class="meta">
        <Badge tone="neutral" dot={false}>{sportLabel(i18n.t, a.sport)}</Badge>
        <span class="date">{when}, {timeOfDay}</span>
      </div>
    </div>
    <!-- Deep-link placeholder — hidden until the Strava integration lands (PWRX §2, T3). -->
    {#if data.stravaUrl}
      <a class="strava" href={data.stravaUrl} rel="noopener noreferrer external" target="_blank">
        Zobacz na Strava →
      </a>
    {/if}
  </header>

  <section class="tiles" aria-label="Kluczowe liczby">
    {#if isNum(a.distanceM)}
      <StatTile label="Dystans" value={fmtKm(a.distanceM, 2)} unit="km" accent="orange" />
    {/if}
    <StatTile label="Czas w ruchu" value={fmtDuration(elapsed)} accent="cyan" />
    {#if paceSport}
      <StatTile label={i18n.t('detail.tile.avgPace')} value={fmtPace(avgPace)} unit="min/km" accent="lime" />
    {:else}
      <StatTile
        label={i18n.t('detail.tile.avgSpeed')}
        value={fmtNum(speedKmh(avgSpeedMps), 1)}
        unit="km/h"
        accent="lime"
      />
    {/if}
    {#if isNum(a.avgHr)}
      <StatTile label={i18n.t('detail.tile.avgHr')} value={fmtNum(a.avgHr)} unit="bpm" accent="red" />
    {/if}
    {#if data.power}
      <StatTile
        label={i18n.t('detail.tile.avgPower')}
        value={fmtNum(data.power.avg)}
        unit="W"
        accent="amber"
      />
    {/if}
    {#if isNum(a.elevationGainM)}
      <StatTile
        label={i18n.t('timeline.stat.elevation')}
        value={fmtNum(a.elevationGainM)}
        unit="m"
        accent="green"
      />
    {/if}
    {#if isNum(a.calories)}
      <StatTile label="Kalorie" value={fmtNum(a.calories)} unit="kcal" accent="violet" />
    {/if}
    {#if isNum(a.trainingLoad)}
      <StatTile label={i18n.t('detail.tile.load')} value={fmtNum(a.trainingLoad)} accent="indigo" />
    {/if}
  </section>

  <TrainingVerdict
    comparison={data.trainingComparison}
    power={data.power}
    ftp={data.ftp}
    ftpEstimated={data.ftpEstimated}
  />

  <!-- The plan gets a section of its own, directly under the verdict it qualifies (spec 085).
       It renders nothing at all when no plan matched this session. -->
  <PlannedVsActual comparison={data.trainingComparison} />

  <ActivityFlags highlights={data.highlights} suspects={data.suspects} />

  <ActivityBestEfforts efforts={data.bestEfforts} />

  <ActivityEfficiency efficiency={data.efficiency} pacing={data.pacing} />

  {#if data.gps}
    <Card title="Trasa">
      <div class="map">
        <LeafletMap
          {polylines}
          {markers}
          height="380px"
          ariaLabel={i18n.t('activities.routeOf', { name: a.name ?? sportLabel(i18n.t, a.sport) })}
        />
      </div>
    </Card>
  {/if}

  <!-- One card, two answers to "what should I compare this to" (spec 065): a comparable EFFORT,
       or literally the same route. The matched-route table from spec 041 is the second tab. -->
  <SimilarActivities similar={data.similarActivities} route={data.matchedRoute} />

  <ActivityClimbs climbs={data.climbs} totalGainM={a.elevationGainM} />

  {#if hasStreams}
    <Card title="Przebieg" subtitle={i18n.t('detail.streamsSubtitle')}>
      <ActivityStreamsPanel streams={data.streams} sport={family} plannedStructure={data.plannedStructure} />
    </Card>
  {/if}

  <ActivityZones
    hr={data.hr}
    stats={data.stats}
    power={data.power}
    weightKg={data.weightKg}
    ftp={data.ftp}
    ftpEstimated={data.ftpEstimated}
  />

  <ActivityLapsPanel laps={data.laps} typedSplits={data.typedSplits} sport={family} />

  {#if sections.length > 0}
    <Card title={i18n.t('detail.detailsTitle')} subtitle={i18n.t('detail.detailsSubtitle')}>
      <StatSections {sections} />
    </Card>
  {:else}
    <Card title={i18n.t('detail.detailsTitle')}>
      <p class="empty">
        {i18n.t('detail.noDetails', { dash: DASH })}
      </p>
    </Card>
  {/if}
</div>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .crumbs a {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .crumbs a:hover {
    color: var(--color-text);
  }

  .name {
    font-size: var(--text-2xl);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    margin: var(--space-1) 0;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .date {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .strava {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-accent);
    text-decoration: none;
    white-space: nowrap;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .map :global(.map) {
    height: 380px !important;
  }

  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
