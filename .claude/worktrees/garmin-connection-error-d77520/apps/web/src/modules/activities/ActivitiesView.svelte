<script lang="ts">
  /**
   * Activities browser (PWRX §1): search box + sport chips + sort control + grid/list toggle over a
   * responsive card grid. All state lives in the URL; every control navigates with new query params
   * so the server loader re-runs (reads local store). Presentational otherwise.
   */
  import { goto } from '$app/navigation';
  import Input from '$lib/ui/Input.svelte';
  import Button from '$lib/ui/Button.svelte';
  import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
  import FilterChips from '$lib/ui/FilterChips.svelte';
  import type { FilterChipOption } from '$lib/ui/FilterChips.svelte';
  import RangeBadge from '$lib/ui/RangeBadge.svelte';
  import { RANGE_PARAM } from '$lib/range';
  import { sportLabel } from '$lib/sport-labels';
  import ActivityCard from './ActivityCard.svelte';
  import type { ActivitiesData, ActivitySort, SortDir, ViewMode } from './activities.types';

  let { data }: { data: ActivitiesData } = $props();

  // Facets arrive most-frequent-first, so the collapsed chip row shows the sports actually trained.
  const sportChips = $derived<FilterChipOption[]>(
    data.facets.sports.map((s) => ({ value: s.sport, label: sportLabel(s.sport) }))
  );

  // Local mirror of the search box; committed to the URL on submit/Enter. Kept in sync with the
  // loader-provided query via an effect (avoids capturing `data` in the state initializer).
  let searchTerm = $state('');
  $effect(() => {
    searchTerm = data.query.search ?? '';
  });

  const view = $state<{ mode: ViewMode }>({ mode: 'grid' });

  const km = $derived(
    `${(data.facets.totalDistanceM / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} km`
  );
  const hours = $derived(`${Math.round(data.facets.totalDurationS / 3600).toLocaleString('pl-PL')} h`);

  function apply(next: {
    sport?: string | null;
    search?: string | null;
    sort?: ActivitySort;
    dir?: SortDir;
    page?: number;
  }): void {
    const q = new URLSearchParams();
    const sport = next.sport === undefined ? data.query.sport : next.sport;
    const search = next.search === undefined ? data.query.search : next.search;
    const sort = next.sort ?? data.query.sort;
    const dir = next.dir ?? data.query.dir;
    const page = next.page ?? 1;
    if (sport) q.set('sport', sport);
    if (search) q.set('search', search);
    if (sort !== 'date') q.set('sort', sort);
    if (dir !== 'desc') q.set('dir', dir);
    if (page > 1) q.set('page', String(page));
    /*
     * The global range rides along (spec 047). This function rebuilds the query from scratch, so
     * without this line every sport chip, sort click and page step would silently reset the range to
     * the default — the switch would look like it forgets.
     */
    if (data.range) q.set(RANGE_PARAM, data.range.key);
    void goto(`/activities${q.toString() ? `?${q}` : ''}`, { invalidateAll: true, noScroll: true });
  }

  function submitSearch(event: SubmitEvent): void {
    event.preventDefault();
    apply({ search: searchTerm.trim() || null });
  }

  const sortOptions = [
    { value: 'date', label: 'Data' },
    { value: 'distance', label: 'Dystans' },
    { value: 'duration', label: 'Czas' }
  ];
  const viewOptions = [
    { value: 'grid', label: 'Siatka' },
    { value: 'list', label: 'Lista' }
  ];
</script>

<div class="wrap">
  <header class="summary">
    <div class="metric">
      <span class="m-value">{data.facets.total}</span><span class="m-label">Aktywności</span>
    </div>
    <div class="metric"><span class="m-value">{km}</span><span class="m-label">Dystans</span></div>
    <div class="metric"><span class="m-value">{hours}</span><span class="m-label">Czas</span></div>
    <!-- These three totals are the filtered set, and the range is one of the filters (spec 047) —
         "247 aktywności" means something different on 7 dni than on cały czas. -->
    {#if data.range}
      <div class="summary-range"><RangeBadge label={data.range.label} size="sm" /></div>
    {/if}
  </header>

  <div class="controls">
    <form class="search" onsubmit={submitSearch}>
      <Input
        type="search"
        placeholder="Szukaj po nazwie lub sporcie…"
        bind:value={searchTerm}
        aria-label="Szukaj aktywności"
      />
      <Button type="submit" size="sm" variant="secondary">Szukaj</Button>
    </form>

    <div class="right">
      <div class="sort">
        <SegmentedControl
          options={sortOptions}
          value={data.query.sort}
          size="sm"
          ariaLabel="Sortuj według"
          onChange={(v) => apply({ sort: v as ActivitySort })}
        />
        <Button
          size="sm"
          variant="ghost"
          onclick={() => apply({ dir: data.query.dir === 'asc' ? 'desc' : 'asc' })}
          title={data.query.dir === 'asc' ? 'Rosnąco' : 'Malejąco'}
        >
          {data.query.dir === 'asc' ? '↑' : '↓'}
        </Button>
      </div>
      <SegmentedControl
        options={viewOptions}
        value={view.mode}
        size="sm"
        ariaLabel="Widok"
        onChange={(v) => (view.mode = v as ViewMode)}
      />
    </div>
  </div>

  <FilterChips
    options={sportChips}
    value={data.query.sport}
    ariaLabel="Filtruj po sporcie"
    onSelect={(sport) => apply({ sport })}
  />

  {#if data.items.length === 0}
    <p class="empty">
      Brak aktywności{#if data.range}&nbsp;w zakresie: {data.range.label}{/if} dla tego filtra. Zmień zakres u góry
      strony lub uruchom synchronizację w zakładce <a href="/data">Dane</a>.
    </p>
  {:else}
    <div class="grid" class:list={view.mode === 'list'}>
      {#each data.items as item (item.id)}
        <ActivityCard {item} view={view.mode} />
      {/each}
    </div>
  {/if}

  {#if data.pageCount > 1}
    <nav class="pager" aria-label="Strony">
      <Button
        size="sm"
        variant="secondary"
        disabled={data.query.page <= 1}
        onclick={() => apply({ page: data.query.page - 1 })}
      >
        Poprzednia
      </Button>
      <span class="page-label">Strona {data.query.page} z {data.pageCount}</span>
      <Button
        size="sm"
        variant="secondary"
        disabled={data.query.page >= data.pageCount}
        onclick={() => apply({ page: data.query.page + 1 })}
      >
        Następna
      </Button>
    </nav>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6);
  }
  /* Pushed to the far end of the readout row, so it qualifies all three totals at once. */
  .summary-range {
    margin-left: auto;
  }
  .metric {
    display: flex;
    flex-direction: column;
  }
  .m-value {
    font-size: var(--readout-md);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
  .m-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 260px;
    max-width: 420px;
  }
  .search :global(> :first-child) {
    flex: 1;
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .sort {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }
  .grid.list {
    grid-template-columns: 1fr;
  }

  .empty {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }
  .page-label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }
</style>
