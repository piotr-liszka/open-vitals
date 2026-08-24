<script lang="ts">
  /**
   * One dashboard's widget grid (specs 016, 064). Widgets render from the registry, so this component
   * never needs to know a widget's internals; the layout persists to `/api/dashboards` on every
   * change.
   *
   * Spec 064 removed the tab strip that used to sit on top. The sidebar is the switcher now, and the
   * strip was the copy of it that could not be linked to. What is left here is editing THIS
   * dashboard: its name, its widgets, and their order.
   *
   * Reordering is offered twice on purpose. Dragging is what people reach for; the arrow buttons are
   * what a keyboard can reach at all. Both call `moveItem`, so they cannot disagree about what a move
   * means.
   */
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import RangeBadge from '$lib/ui/RangeBadge.svelte';
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
  import { toasts } from '$lib/ui/toast';
  import { bucketNounKey } from '$lib/series';
  import { goto, invalidateAll } from '$app/navigation';
  import { WIDGETS, WIDGET_TYPES } from './widget-registry';
  import { moveItem } from './reorder';
  import { dashboardHref } from './dashboard-nav';
  import { MAX_DASHBOARD_NAME } from './dashboards.types';
  import type { WidgetData } from './dashboard-data';
  import type { DashboardConfig, WidgetInstance, WidgetSpan, WidgetType } from './dashboards.types';
  import { rangeLabel } from '$lib/range';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    config: DashboardConfig;
    /** Which dashboard of the config this page is showing — it comes from the URL. */
    dashboardId: string;
    data: WidgetData;
  }
  let { config, dashboardId, data }: Props = $props();

  const bucketLabel = $derived(
    data.range.bucket === 'day' ? undefined : i18n.t(bucketNounKey(data.range.bucket))
  );

  /*
   * Fork the loaded config into local editable state — we are the source of truth after mount. This
   * is safe to do once, without an effect that re-syncs it, because the page `{#key}`s this component
   * on the dashboard id: navigating to another dashboard remounts rather than mutating props under a
   * half-finished edit.
   */
  // svelte-ignore state_referenced_locally
  let cfg = $state<DashboardConfig>(structuredClone(config));

  let editing = $state(false);
  let adding = $state(false);
  let confirmingDelete = $state(false);

  const active = $derived(cfg.dashboards.find((d) => d.id === dashboardId) ?? cfg.dashboards[0]!);
  const isLast = $derived(cfg.dashboards.length <= 1);
  const SPAN_CYCLE: WidgetSpan[] = [4, 6, 8, 12];

  function uid(prefix: string): string {
    const c =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : `${cfg.dashboards.length}-${active.widgets.length}`;
    return `${prefix}-${c}`;
  }

  /**
   * Save the whole document. Every edit is the same write (spec 064), so there is one function and
   * one endpoint rather than a verb each. `invalidateAll` is what repaints the sidebar after a rename
   * or a delete — the nav is served by the root layout load, so it has to be told the data moved.
   */
  async function persist(opts: { refreshNav?: boolean } = {}): Promise<void> {
    const res = await fetch('/api/dashboards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify($state.snapshot(cfg))
    });
    if (!res.ok) {
      toasts.error('Nie udało się zapisać panelu');
      return;
    }
    if (opts.refreshNav) await invalidateAll();
  }

  function renameDashboard(event: Event): void {
    const name = (event.currentTarget as HTMLInputElement).value.trim();
    if (!name || name === active.name) return;
    active.name = name.slice(0, MAX_DASHBOARD_NAME);
    void persist({ refreshNav: true });
  }

  async function deleteDashboard(): Promise<void> {
    confirmingDelete = false;
    if (isLast) return;
    const remaining = cfg.dashboards.filter((d) => d.id !== active.id);
    cfg.dashboards = remaining;
    await persist({ refreshNav: true });
    await goto(dashboardHref(remaining[0]!.id));
  }

  function addWidget(type: WidgetType): void {
    const w: WidgetInstance = { id: uid('w'), type, span: WIDGETS[type].defaultSpan };
    if (type === 'metric-trend') w.options = { metric: 'steps' };
    active.widgets.push(w);
    adding = false;
    void persist();
  }
  function removeWidget(id: string): void {
    active.widgets = active.widgets.filter((w) => w.id !== id);
    void persist();
  }
  function resizeWidget(w: WidgetInstance): void {
    w.span = SPAN_CYCLE[(SPAN_CYCLE.indexOf(w.span) + 1) % SPAN_CYCLE.length]!;
    void persist();
  }

  function reorder(from: number, to: number): void {
    const next = moveItem(active.widgets, from, to);
    // `moveItem` returns the original reference for a no-op, so an out-of-range or same-slot drop
    // costs no request at all.
    if (next === active.widgets) return;
    active.widgets = next as WidgetInstance[];
    void persist();
  }

  /* ---- drag and drop ----
     Native HTML5 DnD: no dependency, and the browser draws the drag image. `dragIndex` is component
     state rather than dataTransfer payload because the payload is a string and this is a same-list
     move — round-tripping an index through the clipboard would be ceremony for nothing. */
  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);

  function onDragStart(i: number, event: DragEvent): void {
    dragIndex = i;
    event.dataTransfer?.setData('text/plain', String(i));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(i: number, event: DragEvent): void {
    if (dragIndex === null) return;
    // Without preventDefault the browser refuses the drop outright.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    overIndex = i;
  }
  function onDrop(i: number, event: DragEvent): void {
    event.preventDefault();
    if (dragIndex !== null) reorder(dragIndex, i);
    dragIndex = null;
    overIndex = null;
  }
  function onDragEnd(): void {
    dragIndex = null;
    overIndex = null;
  }
</script>

<div class="board">
  <div class="bar">
    {#if editing}
      <!-- Renaming in place, rather than through a prompt: this input IS the title, so the reader
           edits the thing they are looking at and sees the sidebar entry follow on blur. -->
      <input
        class="name-input"
        type="text"
        value={active.name}
        maxlength={MAX_DASHBOARD_NAME}
        aria-label="Nazwa panelu"
        onblur={renameDashboard}
        onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
    {:else}
      <h2 class="name">{active.name}</h2>
    {/if}

    <div class="spacer"></div>

    {#if editing}
      <Button
        size="sm"
        variant="danger"
        disabled={isLast}
        title={isLast ? 'To jedyny panel — nie można go usunąć' : undefined}
        onclick={() => (confirmingDelete = true)}>Usuń panel</Button
      >
    {/if}
    <Button size="sm" variant={editing ? 'primary' : 'secondary'} onclick={() => (editing = !editing)}>
      {editing ? 'Gotowe' : 'Edytuj'}
    </Button>
  </div>

  {#if editing}
    <div class="adder">
      {#if adding}
        <div class="picker">
          {#each WIDGET_TYPES as t (t)}
            <button type="button" class="pick" onclick={() => addWidget(t)}>
              <span class="pick-name">{i18n.t(WIDGETS[t].labelKey)}</span>
              <span class="pick-desc">{i18n.t(WIDGETS[t].descriptionKey)}</span>
            </button>
          {/each}
        </div>
        <div><Button size="sm" variant="ghost" onclick={() => (adding = false)}>Anuluj</Button></div>
      {:else}
        <div class="adder-row">
          <Button size="sm" variant="secondary" onclick={() => (adding = true)}>+ Dodaj widget</Button>
          <p class="hint">Przeciągnij kartę za uchwyt, aby zmienić kolejność.</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- A real list: the cells are items in an order the reader controls, which is exactly what a
       screen reader should be told when they reorder one. It also gives the draggable cells the ARIA
       role that drag handlers on a static element would otherwise lack.

       `board-grid` / `board-cell`, not `grid` / `cell`: `CoverageWidget` uses both of those names for
       its own unrelated layout, and a widget of it renders INSIDE this grid. Svelte scopes every rule
       so nothing ever collided visually — but a DOM query for `.grid > .cell` on a page showing three
       widgets found seven elements, and that is a debugging trap nobody should have to fall into twice. -->
  <div class="board-grid" class:editing role="list">
    {#each active.widgets as w, i (w.id)}
      {@const def = WIDGETS[w.type]}
      {@const Comp = def.component}
      <section
        class="board-cell"
        role="listitem"
        class:dragging={dragIndex === i}
        class:dropzone={overIndex === i && dragIndex !== i}
        style="--span: {w.span}"
        draggable={editing}
        ondragstart={(e) => onDragStart(i, e)}
        ondragover={(e) => onDragOver(i, e)}
        ondrop={(e) => onDrop(i, e)}
        ondragend={onDragEnd}
      >
        <Card>
          <div class="wtitle">
            {#if editing}
              <span class="grip" aria-hidden="true" title="Przeciągnij, aby przenieść">⠿</span>
            {/if}
            <span class="wname">{i18n.t(def.labelKey)}</span>
            <!--
              Which widgets follow the global range comes from the registry (spec 047), so a widget
              the user adds is marked correctly without this grid knowing anything about it. Unmarked
              widgets (coverage, streak) are making the opposite claim: all-time, switch-independent.
            -->
            {#if def.ranged}
              <RangeBadge label={rangeLabel(i18n.t, data.range)} bucketNoun={bucketLabel} size="sm" />
            {/if}
            {#if editing}
              <div class="wctrl">
                <button
                  type="button"
                  title="W lewo"
                  aria-label="Przesuń w lewo"
                  onclick={() => reorder(i, i - 1)}
                  disabled={i === 0}>←</button
                >
                <button
                  type="button"
                  title="W prawo"
                  aria-label="Przesuń w prawo"
                  onclick={() => reorder(i, i + 1)}
                  disabled={i === active.widgets.length - 1}>→</button
                >
                <button
                  type="button"
                  title="Zmień rozmiar"
                  aria-label="Zmień rozmiar"
                  onclick={() => resizeWidget(w)}>⤢ {w.span}</button
                >
                <button
                  type="button"
                  class="del"
                  title="Usuń"
                  aria-label="Usuń widget"
                  onclick={() => removeWidget(w.id)}>✕</button
                >
              </div>
            {/if}
          </div>
          <div class="wbody">
            <Comp {data} {...w.options ? { options: w.options } : {}} />
          </div>
          <!--
            Every built-in widget except the streak is a smaller view of a page that does the subject
            properly (spec 048). Naming that page is honest about the overlap and gives the reader the
            one click that gets them the full thing.
          -->
          {#if def.seeAlso}
            <a class="wsee" href={def.seeAlso.href}
              >{i18n.t('widget.seeAlso', { page: i18n.t(def.seeAlso.pageKey) })} →</a
            >
          {/if}
        </Card>
      </section>
    {:else}
      <p class="empty">
        Ten panel jest pusty. Kliknij <strong>Edytuj</strong> → <strong>Dodaj widget</strong>.
      </p>
    {/each}
  </div>
</div>

<ConfirmDialog
  open={confirmingDelete}
  title="Usunąć panel „{active.name}”?"
  body={active.widgets.length === 1
    ? '1 widget zostanie usunięty. Tej operacji nie można cofnąć.'
    : `${active.widgets.length} widgetów zostanie usuniętych. Tej operacji nie można cofnąć.`}
  onconfirm={deleteDashboard}
  oncancel={() => (confirmingDelete = false)}
/>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .spacer {
    flex: 1;
  }
  .name,
  .name-input {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }
  /* Sized and positioned like the heading it replaces, so switching into edit mode does not make the
     title jump. */
  .name-input {
    min-width: 0;
    max-width: 22rem;
    padding: var(--space-1) var(--space-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
  }
  .name-input:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .adder {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .adder-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }
  .picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .pick {
    text-align: left;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .pick:hover {
    border-color: var(--color-accent);
    background: var(--color-surface-hover);
  }
  .pick:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .pick-name {
    font-weight: var(--font-semibold);
    color: var(--color-text);
    font-size: var(--text-sm);
  }
  .pick-desc {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  .board-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--space-4);
  }
  .board-cell {
    grid-column: span var(--span);
    min-width: 0;
  }
  .board-cell :global(.card),
  .board-cell :global(article) {
    height: 100%;
  }
  .board-grid.editing .board-cell {
    cursor: grab;
  }
  /* The card being dragged fades rather than disappears: the browser's drag image is a copy, and a
     hidden original makes the list look like it lost a card mid-drag. */
  .board-cell.dragging {
    opacity: 0.4;
  }
  /* The drop target says where the card will land. An accent outline rather than a moved card,
     because animating the whole grid under the cursor is how a drop ends up one slot off. */
  .board-cell.dropzone :global(.card),
  .board-cell.dropzone :global(article) {
    outline: 2px dashed var(--color-accent);
    outline-offset: 2px;
  }
  .wtitle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }
  .grip {
    color: var(--color-text-subtle);
    cursor: grab;
    letter-spacing: -0.1em;
  }
  /* The name yields first: a truncated widget label beats a truncated range indicator, which would
     leave the reader unsure which window they are looking at. */
  .wname {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Badge sits between the name and the edit controls; the edit row wins the remaining space. */
  .wtitle :global(.range-badge) {
    margin-right: auto;
  }
  .wctrl {
    display: inline-flex;
    gap: var(--space-1);
  }
  .wctrl button {
    min-width: 26px;
    height: 26px;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .wctrl button:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }
  .wctrl button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .wctrl button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .wctrl .del:hover {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }
  .wbody {
    min-height: 96px;
  }
  /* Quiet by design: it points at the fuller view without competing with the widget's own numbers. */
  .wsee {
    display: inline-block;
    margin-top: var(--space-4);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-subtle);
    text-decoration: none;
  }
  .wsee:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }
  .wsee:focus-visible {
    outline: none;
    border-radius: var(--radius-sm);
    box-shadow: var(--focus-ring);
  }
  .empty {
    grid-column: 1 / -1;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    padding: var(--space-6);
    text-align: center;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
  }
  /* Responsive: collapse to a single column on small screens (widgets ignore span). */
  @media (max-width: 900px) {
    .board-grid {
      grid-template-columns: 1fr;
    }
    .board-cell {
      grid-column: 1 / -1;
    }
  }
</style>
