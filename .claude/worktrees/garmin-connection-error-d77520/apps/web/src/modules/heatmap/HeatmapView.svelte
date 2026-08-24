<script lang="ts">
  /** Full-bleed GPS heatmap (PWRX §3): every track drawn faint + additive over the theme's basemap
   * (spec 051), with a filter/summary rail. Reads only the loader data (local store). */
  import { goto } from '$app/navigation';
  import LeafletMap from '$lib/ui/LeafletMap.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import FilterChips from '$lib/ui/FilterChips.svelte';
  import type { FilterChipOption } from '$lib/ui/FilterChips.svelte';
  import type { MapPolyline } from '$lib/ui/LeafletMap.svelte';
  import { sportLabel } from '$lib/sport-labels';
  import type { HeatmapData } from './heatmap.types';

  let { data }: { data: HeatmapData } = $props();

  // Facets arrive most-frequent-first; the chip row collapses everything past the top 5.
  const sportChips = $derived<FilterChipOption[]>(
    data.sports.map((s) => ({ value: s.sport, label: sportLabel(s.sport) }))
  );
  const yearChips = $derived<FilterChipOption[]>(
    data.years.map((y) => ({ value: String(y), label: String(y) }))
  );

  // Faint additive tracks give the density "heat" look without a heavyweight heat layer.
  const polylines = $derived<MapPolyline[]>(
    data.tracks.map((t) => ({ points: t.gps, weight: 2, opacity: 0.35 }))
  );
  const km = $derived(
    `${(data.totalDistanceM / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} km`
  );

  function apply(next: { sport?: string | null; year?: number | null }): void {
    const sport = next.sport === undefined ? data.sport : next.sport;
    const year = next.year === undefined ? data.year : next.year;
    const q = new URLSearchParams();
    if (sport) q.set('sport', sport);
    if (year) q.set('year', String(year));
    // The map moved under the activities section (spec 048). Navigating to the old `/heatmap` would
    // still work — it 308s — but every chip click would cost a redirect round-trip and flash the
    // stale URL in the address bar.
    void goto(`/activities/map${q.toString() ? `?${q}` : ''}`, { invalidateAll: true, noScroll: true });
  }
</script>

<div class="layout">
  <aside class="rail">
    <div class="tiles">
      <StatTile label="Aktywności" value={String(data.count)} accent="orange" />
      <StatTile label="Dystans" value={km} accent="green" />
      <StatTile label="Z trasą GPS" value={String(data.tracks.length)} accent="cyan" />
    </div>

    <div class="filter">
      <span class="flabel">Sport</span>
      <FilterChips
        options={sportChips}
        value={data.sport}
        ariaLabel="Filtruj po sporcie"
        onSelect={(sport) => apply({ sport })}
      />
    </div>

    {#if data.years.length > 0}
      <div class="filter">
        <span class="flabel">Rok</span>
        <FilterChips
          options={yearChips}
          value={data.year == null ? null : String(data.year)}
          ariaLabel="Filtruj po roku"
          maxVisible={8}
          onSelect={(y) => apply({ year: y == null ? null : Number(y) })}
        />
      </div>
    {/if}

    {#if data.tracks.length === 0}
      <p class="empty">
        Brak tras GPS dla tego filtra. Uruchom synchronizację w zakładce <a href="/data">Dane</a>.
      </p>
    {/if}
  </aside>

  <div class="map">
    <LeafletMap {polylines} height="100%" ariaLabel="Mapa ciepła tras" />
  </div>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: var(--space-5);
    /* `--heatmap-offset` is whatever the page stacks above the map — since spec 048 that is the
       section's tab row. Defaults to 0 so the view still fills the screen on its own. */
    height: calc(100dvh - var(--topbar-height) - var(--space-6) * 2 - var(--heatmap-offset, 0px));
    min-height: 520px;
  }
  .rail {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    overflow-y: auto;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .tiles :global(> *:first-child) {
    grid-column: 1 / -1;
  }
  .filter {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .flabel {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    font-weight: var(--font-semibold);
  }
  .empty {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .map {
    min-height: 480px;
    height: 100%;
  }
  /* Map full height needs the child to stretch. */
  .map :global(.map) {
    height: 100% !important;
  }
  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
      height: auto;
    }
    .map {
      height: 60vh;
    }
  }
</style>
