<script lang="ts">
  /**
   * "Twoje dane" — how much local data you hold + live sync (spec 015). Triggers a sync via the API
   * and polls the run for a progress bar. Presentational logic only; all data comes from the loader.
   */
  import { invalidateAll } from '$app/navigation';
  import Card from '$lib/ui/Card.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Banner from '$lib/ui/Banner.svelte';
  import ProgressBar from '$lib/ui/ProgressBar.svelte';
  import FilterChips, { type FilterChipOption } from '$lib/ui/FilterChips.svelte';
  import type { SidecarLogResponse } from './sync.types';
  import { metricLabel } from '$lib/metric-labels';
  import { formatDay, formatInstant, isDayKey } from '$lib/date';
  import type { CoverageSnapshot, SyncRun } from '$lib/server/store/types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    coverage: CoverageSnapshot;
    lastRun: SyncRun | null;
    connected: boolean;
    /** When true, prompt to refresh (freshly logged in or data is stale/empty). */
    prompt?: boolean;
  }
  let { coverage, lastRun, connected, prompt = false }: Props = $props();

  // Live run/progress come from polling; until a poll runs we fall back to the loader's `lastRun`.
  let liveRun = $state<SyncRun | null>(null);
  let liveProgress = $state<number | null>(null);
  let busy = $state(false);
  let stopping = $state(false);
  let poll: ReturnType<typeof setInterval> | null = null;

  const run = $derived(liveRun ?? lastRun);
  const progress = $derived(
    liveProgress ?? (lastRun && lastRun.total > 0 ? lastRun.done / lastRun.total : null)
  );

  const running = $derived(run?.status === 'running' || busy);

  /*
   * Whether GARMIN is behind, which is a different question from whether WE are (spec 072). Only
   * flagged from a full day behind: a watch that has not uploaded yet this morning is normal, and a
   * banner that fires every day before breakfast is one nobody reads by the time it matters.
   */
  const staleDays = $derived(coverage.freshness.staleDays);
  const watchBehind = $derived(
    staleDays !== null && staleDays >= 1 && isDayKey(coverage.freshness.lastDataDay ?? '')
  );
  const staleDaysLabel = $derived(staleDays === 1 ? 'wczoraj' : `${staleDays} dni temu`);

  const km = (m: number): string => `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} km`;
  function niceDate(s: string | null): string {
    if (!s) return '—';
    const head = s.slice(0, 10);
    return isDayKey(head) ? formatDay(i18n.locale, head, 'iso') : '—';
  }
  function fmtBytes(b: number): string {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return `${(b / 1024 ** i).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} ${u[i]}`;
  }
  // Per-phase sync results (from the finished run) with localized labels + failure detection.
  const PHASE_LABELS: Record<string, string> = {
    activities: 'Aktywności',
    streams: 'Trasy / strumienie',
    weight: 'Waga',
    planned: 'Plan treningowy',
    workoutPush: 'Wysyłka treningów',
    metrics: 'Metryki dzienne'
  };
  interface PhaseRow {
    key: string;
    label: string;
    summary: string;
    error: string | null;
  }
  const phaseRows = $derived.by<PhaseRow[]>(() => {
    const d = run?.detail;
    if (!d) return [];
    const rows: PhaseRow[] = [];
    if (d.activities)
      rows.push({
        key: 'activities',
        label: PHASE_LABELS.activities!,
        summary: `${d.activities.count} aktywności (${d.activities.pages} stron)`,
        error: d.activities.error ?? null
      });
    if (d.streams)
      rows.push({
        key: 'streams',
        label: PHASE_LABELS.streams!,
        // Best efforts are derived inside this phase (spec 054), so they are named here rather than
        // silently inflating "pobranych" — the two are different kinds of work.
        summary: [
          `${d.streams.fetched} pobranych`,
          d.streams.efforts ? `${d.streams.efforts} odcinków przeliczonych` : null,
          d.streams.effortsPending ? `${d.streams.effortsPending} odcinków w kolejce` : null
        ]
          .filter(Boolean)
          .join(', '),
        error: d.streams.error ?? null
      });
    if (d.weight)
      rows.push({
        key: 'weight',
        label: PHASE_LABELS.weight!,
        summary: `${d.weight.points} pomiarów`,
        error: d.weight.error ?? null
      });
    if (d.planned)
      rows.push({
        key: 'planned',
        label: PHASE_LABELS.planned!,
        summary: d.planned.available
          ? `${d.planned.count} zaplanowanych`
          : 'kalendarz niedostępny w Garminie',
        error: d.planned.error ?? null
      });
    if (d.workoutPush)
      rows.push({
        key: 'workoutPush',
        label: PHASE_LABELS.workoutPush!,
        // The queue is named explicitly: "0 wysłanych" alone would read like "nothing to send".
        summary: [
          `${d.workoutPush.pushed} wysłanych`,
          d.workoutPush.pending > 0 ? `${d.workoutPush.pending} w kolejce` : null,
          d.workoutPush.unsupported > 0 ? `${d.workoutPush.unsupported} niewspieranych` : null
        ]
          .filter(Boolean)
          .join(', '),
        error: d.workoutPush.error ?? null
      });
    if (d.metrics)
      rows.push({
        key: 'metrics',
        label: PHASE_LABELS.metrics!,
        summary: `${d.metrics.days} dni z danymi (od ${d.metrics.windowStart ?? '—'})`,
        error: d.metrics.error ?? null
      });
    return rows;
  });

  const logEntries = $derived(run?.detail?.log ?? []);
  // Instants render in the app timezone (spec 018) so SSR and the browser agree.
  const logTime = (iso: string): string => formatInstant(i18n.locale, iso, 'timeSeconds');
  const ago = (iso: string | null): string => (iso ? formatInstant(i18n.locale, iso, 'dateTime') : 'nigdy');

  /* ---------------- diagnostics (spec 019) ---------------- */

  // Severity filter over the run log. "Problemy" is what you want when a sync misbehaves: it hides
  // the hundreds of routine "chunk done" lines that otherwise bury the one line that matters.
  let logFilter = $state<string | null>(null);
  const LOG_FILTERS: FilterChipOption[] = [
    { value: 'warn', label: 'Problemy' },
    { value: 'error', label: 'Tylko błędy' }
  ];
  const visibleLog = $derived(
    logFilter === 'error'
      ? logEntries.filter((e) => e.level === 'error')
      : logFilter === 'warn'
        ? logEntries.filter((e) => e.level !== 'info')
        : logEntries
  );

  const PHASE_NAMES: Record<string, string> = {
    start: 'start',
    activities: 'aktywności',
    streams: 'trasy',
    weight: 'waga',
    planned: 'plan',
    workoutPush: 'wysyłka treningów',
    metrics: 'metryki',
    done: 'koniec'
  };
  /** Why a call failed, in one word the user can act on. */
  const CODE_NAMES: Record<string, string> = {
    rate_limited: 'limit zapytań',
    token_rejected: 'token wygasł',
    not_connected: 'brak połączenia',
    sidecar_unreachable: 'usługa nie działa',
    timeout: 'przekroczony czas',
    blocked: 'zablokowane',
    not_found: 'brak endpointu',
    bad_response: 'zła odpowiedź',
    upstream_error: 'błąd Garmina',
    unsupported: 'niedostępne w tym trybie'
  };
  const codeLabel = (code: string): string => CODE_NAMES[code] ?? code;

  // How deep the daily-metric backfill has got. This is the whole point of spec 019's depth work:
  // a multi-year backfill runs over several syncs, so the user needs to see it advancing.
  interface BackfillView {
    complete: boolean;
    to: string | null;
    target: string | null;
    remaining: number;
  }
  const backfill = $derived.by<BackfillView | null>(() => {
    const m = run?.detail?.metrics;
    if (!m || (!m.backfillTo && !m.complete)) return null;
    return {
      complete: m.complete === true,
      to: m.backfillTo ?? null,
      target: m.backfillTarget ?? null,
      remaining: m.remainingDays ?? 0
    };
  });

  // The sidecar's own log tail — the Python side of the story, fetched on demand (it is a separate
  // internal call, so it is never part of the page load).
  let sidecar = $state<SidecarLogResponse | null>(null);
  let sidecarBusy = $state(false);
  async function loadSidecarLog(): Promise<void> {
    sidecarBusy = true;
    try {
      const res = await fetch('/api/sync/diagnostics?limit=200');
      sidecar = (await res.json()) as SidecarLogResponse;
    } catch {
      sidecar = { available: false, entries: [], reason: 'sidecar_unreachable' };
    } finally {
      sidecarBusy = false;
    }
  }
  /** The sidecar stamps records with epoch seconds. */
  const sidecarTime = (t: number): string => formatInstant(i18n.locale, new Date(t * 1000), 'timeSeconds');

  async function startSync(kind: 'full' | 'incremental'): Promise<void> {
    if (running) return;
    busy = true;
    try {
      const res = await fetch(`/api/sync?kind=${kind}`, { method: 'POST' });
      const data = (await res.json()) as { runId: string };
      startPolling(data.runId);
    } catch {
      busy = false;
    }
  }

  /** Stop the in-flight sync. Data already written stays — cancelling is not a rollback. */
  async function stopSync(): Promise<void> {
    stopping = true;
    try {
      const res = await fetch('/api/sync', { method: 'DELETE' });
      const data = (await res.json()) as { run: SyncRun | null; progress: number };
      liveRun = data.run;
      liveProgress = data.progress;
      if (!data.run || data.run.status !== 'running') {
        stopPolling();
        await invalidateAll();
      }
    } finally {
      stopping = false;
    }
  }

  function startPolling(runId: string): void {
    if (poll) clearInterval(poll);
    poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/status?runId=${encodeURIComponent(runId)}`);
        const data = (await res.json()) as { run: SyncRun | null; progress: number };
        liveRun = data.run;
        liveProgress = data.progress;
        if (!data.run || data.run.status !== 'running') {
          stopPolling();
          await invalidateAll(); // refresh coverage numbers
        }
      } catch {
        stopPolling();
      }
    }, 1000);
  }
  function stopPolling(): void {
    if (poll) clearInterval(poll);
    poll = null;
    busy = false;
  }

  // If a sync is already in flight when this page loads, attach the poll so the log + progress stream
  // live (e.g. it was started from another tab or a prior navigation).
  $effect(() => {
    if (lastRun && lastRun.status === 'running' && !poll) startPolling(lastRun.id);
  });

  $effect(() => () => {
    if (poll) clearInterval(poll);
  });
</script>

<div class="data">
  {#if !connected}
    <Banner tone="warning">
      Konto Garmin nie jest połączone. Połącz je w <a href="/settings">Ustawieniach</a>, aby synchronizować
      dane.
    </Banner>
  {:else if prompt}
    <Banner tone="info">Zalogowano. Chcesz teraz odświeżyć swoje dane z Garmina?</Banner>
  {/if}

  <!--
    The gap our sync cannot close (spec 072). "Ostatnia synchronizacja: przed chwilą" below is about
    US; this is about GARMIN, and the two were indistinguishable on the day a full sync reported `ok`
    while the newest data Garmin held was two days old because the watch had never uploaded.
  -->
  {#if connected && watchBehind}
    <Banner tone="warning">
      Garmin ma dane najwyżej z <strong>{formatDay(i18n.locale, coverage.freshness.lastDataDay!)}</strong>
      ({staleDaysLabel}). Synchronizacja pobrała wszystko, co Garmin ma — brakujących dni nie ma po jego
      stronie. Otwórz aplikację Garmin Connect na telefonie i zsynchronizuj zegarek, potem uruchom
      synchronizację tutaj.
    </Banner>
  {/if}

  <Card>
    <div class="sync-head">
      <div>
        <h2>Synchronizacja</h2>
        <p class="muted">
          Ostatnia synchronizacja: {ago(lastRun?.finishedAt ?? lastRun?.startedAt ?? null)}
          {#if run?.status === 'failed'}
            · <Badge tone="danger">błąd</Badge>
          {:else if run?.status === 'succeeded'}
            · <Badge tone="success">ok</Badge>
          {/if}
        </p>
      </div>
      <div class="sync-actions">
        {#if running}
          <!-- Stop wins the slot while a sync is in flight: the other two are disabled anyway. -->
          <Button size="sm" variant="secondary" loading={stopping} onclick={stopSync}>Zatrzymaj</Button>
        {/if}
        <Button
          size="sm"
          variant="secondary"
          disabled={running || !connected}
          onclick={() => startSync('incremental')}
        >
          Synchronizuj teraz
        </Button>
        <Button size="sm" disabled={running || !connected} onclick={() => startSync('full')}
          >Pełna synchronizacja</Button
        >
      </div>
    </div>

    {#if running}
      <div class="progress">
        <ProgressBar value={progress} label={run?.step ? `Pobieranie: ${run.step}` : 'Synchronizacja…'} />
      </div>
    {/if}

    {#if phaseRows.length > 0}
      <div class="phases">
        {#each phaseRows as p (p.key)}
          <div class="phase" class:err={p.error}>
            <span class="pname">{p.label}</span>
            <span class="psum">{p.summary}</span>
            {#if p.error}<Badge tone="danger">{p.error}</Badge>{:else}<Badge tone="success" dot={false}
                >OK</Badge
              >{/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if backfill}
      <p class="backfill">
        {#if backfill.complete}
          Historia metryk dziennych jest kompletna.
        {:else}
          Uzupełnianie historii: pobrano wstecz do <strong>{niceDate(backfill.to)}</strong>
          {#if backfill.remaining > 0}
            · zostało ~{backfill.remaining} dni (do {niceDate(backfill.target)})
          {/if}
          · dociąganie trwa dalej przy kolejnych synchronizacjach.
        {/if}
      </p>
    {/if}

    {#if logEntries.length > 0}
      <details class="log" open={running}>
        <summary>Dziennik synchronizacji ({logEntries.length})</summary>

        <div class="logfilter">
          <FilterChips
            options={LOG_FILTERS}
            value={logFilter}
            onSelect={(v) => (logFilter = v)}
            ariaLabel="Filtr dziennika"
            allLabel="Wszystko"
          />
        </div>

        <div class="loglines">
          {#each visibleLog as e, i (i + e.t)}
            <div class="logline {e.level}">
              <span class="lt">{logTime(e.t)}</span>
              {#if e.phase}<span class="lp">{PHASE_NAMES[e.phase] ?? e.phase}</span>{/if}
              <span class="lm">
                {e.msg}
                {#if e.metric || e.day}
                  <span class="lmeta">{e.metric ?? ''}{e.metric && e.day ? ' · ' : ''}{e.day ?? ''}</span>
                {/if}
              </span>
              {#if e.code}
                <span class="lcode"
                  >{codeLabel(e.code)}{e.retryable === false ? ' · wymaga działania' : ''}</span
                >
              {/if}
            </div>
          {:else}
            <p class="logempty">Brak wpisów dla wybranego filtru.</p>
          {/each}
        </div>
      </details>
    {/if}

    <details class="log">
      <summary>Log usługi Garmin (Python)</summary>
      <p class="muted">
        Szczegóły po stronie usługi łączącej się z Garminem — dokładny powód odrzucenia zapytania.
      </p>
      <div class="sidecar-actions">
        <Button size="sm" variant="secondary" loading={sidecarBusy} onclick={loadSidecarLog}>
          {sidecar ? 'Odśwież log' : 'Pobierz log'}
        </Button>
      </div>
      {#if sidecar && !sidecar.available}
        <Banner tone="warning">
          Log niedostępny: {codeLabel(sidecar.reason ?? 'upstream_error')}.
        </Banner>
      {:else if sidecar}
        <div class="loglines">
          {#each sidecar.entries as e, i (i + String(e.t))}
            <div class="logline {e.level === 'warning' ? 'warn' : e.level}">
              <span class="lt">{sidecarTime(e.t)}</span>
              <span class="lm">
                {e.msg}
                {#if e.endpoint}<span class="lmeta">{e.endpoint}</span>{/if}
              </span>
              {#if e.code}<span class="lcode">{codeLabel(e.code)}</span>{/if}
            </div>
          {:else}
            <p class="logempty">Brak wpisów — usługa nie odnotowała nic dla tego konta.</p>
          {/each}
        </div>
      {/if}
    </details>
  </Card>

  <div class="tiles">
    <StatTile label="Dane od" value={coverage.earliest ?? '—'} accent="orange" />
    <StatTile label="Aktywności" value={String(coverage.activities.count)} accent="cyan" />
    <StatTile label="Łączny dystans" value={km(coverage.activities.totalDistanceM)} accent="green" />
    <StatTile label="Pomiary wagi" value={String(coverage.weight.count)} accent="indigo" />
    <StatTile label="Rozmiar w bazie" value={fmtBytes(coverage.storage.totalBytes)} accent="amber" />
  </div>

  <p class="rows-note">
    W bazie: {coverage.storage.rows.metricDays.toLocaleString('pl-PL')} dni metryk ·
    {coverage.storage.rows.activities.toLocaleString('pl-PL')} aktywności ({coverage.activities.withGps} z GPS)
    ·
    {coverage.storage.rows.streams.toLocaleString('pl-PL')} strumieni tras ·
    {coverage.storage.rows.weight.toLocaleString('pl-PL')} pomiarów wagi
  </p>

  <Card>
    <h2>Pokrycie danych dziennych</h2>
    <p class="muted">Zakres dni zsynchronizowanych lokalnie dla każdej metryki.</p>
    <div class="cov-table" role="table">
      <div class="cov-row cov-head" role="row">
        <span role="columnheader">Metryka</span>
        <span role="columnheader">Od</span>
        <span role="columnheader">Do</span>
        <span role="columnheader">Dni z danymi</span>
      </div>
      {#each coverage.metrics as m (m.metric)}
        <div class="cov-row" role="row">
          <span role="cell">{metricLabel(i18n.t, m.metric)}</span>
          <span role="cell" class="mono">{niceDate(m.firstDay)}</span>
          <span role="cell" class="mono">{niceDate(m.lastDay)}</span>
          <span role="cell" class="mono">{m.presentDays}</span>
        </div>
      {:else}
        <p class="muted empty">Brak danych. Uruchom pełną synchronizację, aby pobrać historię.</p>
      {/each}
    </div>
  </Card>
</div>

<style>
  .data {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  h2 {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    margin: 0;
  }
  .muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    margin: var(--space-1) 0 0;
  }
  .sync-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .sync-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .progress {
    margin-top: var(--space-4);
  }
  .phases {
    margin-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-3);
  }
  .phase {
    display: grid;
    grid-template-columns: 160px 1fr auto;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }
  .phase .pname {
    color: var(--color-text);
    font-weight: var(--font-medium);
  }
  .phase .psum {
    color: var(--color-text-muted);
  }
  .phase.err .psum {
    color: var(--color-danger, #e5484d);
  }
  .rows-note {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin: calc(-1 * var(--space-2)) 0 0;
  }
  .log {
    margin-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-3);
  }
  .log summary {
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text);
  }
  .loglines {
    margin-top: var(--space-2);
    max-height: 260px;
    overflow-y: auto;
    background: var(--color-surface-strong, rgba(127, 127, 127, 0.06));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 12px;
    line-height: 1.5;
  }
  .logline {
    display: flex;
    gap: var(--space-3);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .logline .lt {
    color: var(--color-text-subtle);
    flex-shrink: 0;
  }
  .logline .lp {
    color: var(--color-text-muted);
    flex-shrink: 0;
    min-width: 5.5em;
  }
  .logline .lm {
    flex: 1;
    min-width: 0;
  }
  .logline .lmeta {
    color: var(--color-text-subtle);
    margin-left: var(--space-2);
  }
  .logline .lcode {
    flex-shrink: 0;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-2);
    align-self: flex-start;
  }
  .logfilter {
    margin-top: var(--space-3);
  }
  .logempty {
    color: var(--color-text-muted);
    margin: 0;
  }
  .sidecar-actions {
    margin: var(--space-2) 0;
  }
  .backfill {
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .logline.warn .lm {
    color: var(--lane-amber, #d97706);
  }
  .logline.error .lm {
    color: var(--color-danger, #e5484d);
    font-weight: var(--font-medium);
  }
  @media (max-width: 560px) {
    /*
      Two rows: name + status pill on the first, the summary spanning underneath. The status has to
      be placed explicitly — in DOM order it follows the summary, so auto-placement dropped it onto
      a third row where the stretched grid cell blew the pill up to full width (spec 034).
    */
    .phase {
      grid-template-columns: 1fr auto;
    }
    .phase .pname {
      grid-area: 1 / 1;
    }
    .phase :last-child {
      grid-area: 1 / 2;
      justify-self: end;
    }
    .phase .psum {
      grid-area: 2 / 1 / 3 / -1;
    }
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-4);
  }
  .cov-table {
    margin-top: var(--space-3);
    display: flex;
    flex-direction: column;
  }
  .cov-row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 0.8fr;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-sm);
  }
  .cov-head {
    color: var(--color-text-muted);
    font-weight: var(--font-semibold);
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .empty {
    padding: var(--space-4) 0;
  }
  @media (max-width: 560px) {
    .cov-row {
      grid-template-columns: 1.4fr 1fr 0.7fr;
    }
    .cov-row :global(span:nth-child(3)) {
      display: none;
    }
  }
</style>
