<script lang="ts">
  /**
   * Condition & regeneration panel (spec 022) — the start page's "how am I right now".
   *
   * ABSORBS `ReadinessCard` on `/`: it renders the same `ReadinessGauge` and then keeps going with
   * last night's sleep, the recovery channels and one plain-Polish read on where regeneration
   * stands. The start page therefore shows ONE condition block, not two overlapping ones.
   * `ReadinessCard` still exists for `/insights`, where readiness alone is the point.
   *
   * DIRECTION — an extension of the app's existing "Race Telemetry / Instrument" world; the
   * surface's identity is inherited, not re-invented.
   *  · THESIS: answer "how am I right now?" on ONE instrument face — readiness, last night and the
   *    recovery channels together. Refuses the dashboard default of scattering sleep, HRV and
   *    readiness across four equal cards the reader has to reassemble.
   *  · WORLD: a single card divided by hairline rules (never nested cards); heavy tabular readouts
   *    on lane markers; micro-caps labels; one composition bar for the night's stages.
   *  · READING ORDER: score + sentence + the last day of Body Battery → last night → channels,
   *    each against its own baseline.
   */
  import { Badge, Banner, Card, Icon, InfoPopover, Skeleton, StackedBar, TrendChart } from '$lib/ui';
  import type { IconName, StackedBarSegment } from '$lib/ui';
  import { formatDay, formatInstant } from '$lib/date';
  import ReadinessGauge from './ReadinessGauge.svelte';
  import {
    fmtBaseline,
    fmtChannelValue,
    fmtDelta,
    fmtPercent,
    fmtRecovery,
    fmtRecoveryEnd,
    fmtSleepDuration,
    isLiveCountdown,
    remainingMinutes
  } from './condition.format';
  import type { ConditionMetric, ConditionSnapshot, RecoveryState } from './insights.types';
  import { getI18n } from '$lib/i18n';
  import type { MessageKey } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    condition: ConditionSnapshot | null;
    connected: boolean;
    loading?: boolean;
    /** Fixed "now" (epoch ms) for tests; live otherwise. See `tick` below. */
    now?: number;
  }

  let { condition, connected, loading = false, now }: Props = $props();

  const STATE_TONE: Record<RecoveryState, 'success' | 'info' | 'danger' | 'neutral'> = {
    rested: 'success',
    steady: 'info',
    strained: 'danger',
    unknown: 'neutral'
  };

  const STATE_LABEL: Record<RecoveryState, MessageKey> = {
    rested: 'condition.state.rested',
    steady: 'condition.state.steady',
    strained: 'condition.state.strained',
    unknown: 'condition.state.unknown'
  };

  /** Channel → glyph. Unknown keys fall back to the generic activity trace. */
  const CHANNEL_ICON: Record<string, IconName> = {
    body_battery: 'battery',
    hrv: 'pulse',
    resting_heart_rate: 'heart',
    stress: 'alert',
    sleep: 'moon'
  };

  const icon = (key: string): IconName => CHANNEL_ICON[key] ?? 'activity';

  const sleep = $derived(condition?.sleep ?? null);

  const garmin = $derived(condition?.garmin ?? null);
  const recovery = $derived(condition?.recovery ?? null);

  /*
   * Whether this whole card is describing a day that is not today (spec 072).
   *
   * It is a property of the SNAPSHOT, not of one number: when the watch has not uploaded, sleep, the
   * channels, Body Battery and the readiness score are all read off the same stale day. So the
   * warning sits above everything rather than beside the score — and it distinguishes the two things
   * that were being confused, our sync (fresh, and irrelevant here) from Garmin's data (not).
   */
  const stale = $derived((condition?.staleDays ?? 0) > 0 && condition?.day != null);

  /* ---------------------------------------------------------------- *
   * Garmin's recovery timer, ticking (spec 075)
   * ---------------------------------------------------------------- */

  /*
   * The timer is the one number on this card that changes without new data, because Garmin gives us
   * the instant it computed the reading — so the card counts down from it instead of repeating a
   * figure that has not moved since the last sync.
   *
   * Once a minute, not oftener: the readout is whole hours above the first hour, so a faster tick
   * would re-render the card many times to change nothing.
   */
  let tick = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => (tick = Date.now()), 60_000);
    return () => clearInterval(id);
  });

  const nowMs = $derived(now ?? tick);
  const recoveryMinutes = $derived(recovery ? remainingMinutes(recovery, nowMs) : 0);
  /** Live only while the countdown is derivable — otherwise the frozen figure keeps its 072 label. */
  const recoveryLive = $derived(recovery ? isLiveCountdown(recovery, nowMs) : false);
  const recoveryEnd = $derived(recovery ? fmtRecoveryEnd(i18n.t, recovery.endsAt, nowMs) : null);

  /*
   * ONE headline (spec 084).
   *
   * Spec 059 put two 0–100 scores on this card behind a remembered switch, because they were built
   * from different inputs and answered different questions. Ours is now built from Garmin's own six
   * factors plus the live recovery timer, so the switch had nothing left to switch between — it only
   * asked the reader to adjudicate which number was "the real one", which is the confusion spec 084
   * exists to end. Garmin's score stays visible inside the gauge as a reference.
   */
  const garminScore = $derived(garmin?.score ?? null);

  /** The badge follows our own snapshot; Garmin's level no longer drives the header. */
  const activeState = $derived<RecoveryState>(condition?.state ?? 'unknown');
  /*
   * The sentence still comes from Garmin's side when Garmin scored the day: it names the recovery
   * timer and its change phrase, which are facts about the body rather than about a scoring method,
   * and the channel clauses inside it are the same either way (`summaryClauses`).
   */
  const activeSummary = $derived(garmin?.summary ?? condition?.summary ?? '');

  /**
   * Body Battery's last 24 hours, drawn beside the gauge (specs 051, 052). The channel list states the
   * charge against its baseline; this is the curve behind it — the overnight climb, the drain since
   * waking, and where in that arc "right now" sits.
   */
  const batteryDay = $derived(condition?.batteryDay ?? []);
  // One point draws nothing readable; below two the block is omitted rather than shown empty.
  const hasBatteryChart = $derived(batteryDay.filter((p) => p.value !== null).length >= 2);

  const stages = $derived<StackedBarSegment[]>(
    sleep === null
      ? []
      : [
          { label: i18n.t('condition.stage.deep'), value: sleep.deepS ?? 0, color: 'var(--lane-indigo)' },
          { label: i18n.t('condition.stage.rem'), value: sleep.remS ?? 0, color: 'var(--lane-violet)' },
          { label: i18n.t('condition.stage.light'), value: sleep.lightS ?? 0, color: 'var(--lane-sky)' },
          { label: i18n.t('condition.stage.awake'), value: sleep.awakeS ?? 0, color: 'var(--lane-amber)' }
        ]
  );

  /** Sleep's own stat cluster — only the readouts the payload actually supports. */
  interface Readout {
    key: string;
    icon: IconName;
    label: string;
    value: string;
    unit?: string;
    accent: string;
  }

  const sleepReadouts = $derived<Readout[]>(
    sleep === null
      ? []
      : [
          sleep.score !== null
            ? {
                key: 'score',
                icon: 'moon' as IconName,
                label: i18n.t('condition.readout.sleepScore'),
                value: String(Math.round(sleep.score)),
                accent: 'var(--lane-indigo)'
              }
            : null,
          sleep.efficiencyPct !== null
            ? {
                key: 'eff',
                icon: 'activity' as IconName,
                label: i18n.t('condition.readout.efficiency'),
                value: fmtPercent(i18n.t, sleep.efficiencyPct) ?? '—',
                accent: 'var(--lane-teal)'
              }
            : null,
          sleep.bedTime !== null
            ? {
                key: 'bed',
                icon: 'bed' as IconName,
                label: i18n.t('condition.readout.bedTime'),
                value: sleep.bedTime,
                accent: 'var(--lane-violet)'
              }
            : null,
          sleep.wakeTime !== null
            ? {
                key: 'wake',
                icon: 'sunrise' as IconName,
                label: i18n.t('condition.readout.wakeTime'),
                value: sleep.wakeTime,
                accent: 'var(--lane-amber)'
              }
            : null
        ].filter((r): r is Readout => r !== null)
  );

  function deltaClass(metric: ConditionMetric): 'good' | 'bad' | 'flat' {
    if (metric.favourable === null) return 'flat';
    return metric.favourable ? 'good' : 'bad';
  }
</script>

<!--
  `overflowVisible` because the explain-popover below hangs out of the card (spec 086); without it
  the card's rounded clip cuts the explanation in half.
-->
<Card title={i18n.t('condition.title')} subtitle={i18n.t('condition.subtitle')} overflowVisible>
  {#snippet actions()}
    {#if condition && !loading && connected}
      <Badge tone={STATE_TONE[activeState]}>{i18n.t(STATE_LABEL[activeState])}</Badge>
    {/if}
  {/snippet}

  {#if loading}
    <div class="loading">
      <Skeleton width="var(--space-16)" height="var(--space-12)" radius="md" />
      <Skeleton width="70%" height="var(--space-4)" />
      <Skeleton width="90%" height="var(--space-4)" />
    </div>
  {:else if !connected}
    <p class="note">{i18n.t('condition.notConnected')}</p>
    <a class="link" href="/settings">{i18n.t('condition.connectCta')}</a>
  {:else if condition === null}
    <p class="note">{i18n.t('readiness.notEnoughData')}</p>
  {:else}
    {#if stale}
      <Banner tone="warning">
        {i18n.t('condition.staleBanner', { day: formatDay(i18n.locale, condition.day!) })}
      </Banner>
    {/if}

    <div class="panel">
      <div class="hero" class:with-chart={hasBatteryChart}>
        <div class="lead">
          {#if condition.readiness}
            <!--
              `align="start"`: the trigger sits right beside the score, near the LEFT edge of the lead
              column, so an end-aligned panel would open leftwards, across the card edge and over the
              sidebar. It opens rightwards, where the room is.
            -->
            {#snippet popover()}
              <InfoPopover
                label={i18n.t('readiness.explainLabel')}
                title={i18n.t('readiness.explainTitle')}
                align="start"
              >
                <p>{i18n.t('readiness.explainBody')}</p>
                <p>{i18n.t('readiness.explainLimits')}</p>
                <p>{i18n.t('readiness.explainGarmin')}</p>
                <p>{i18n.t('readiness.explainBands')}</p>
                <p>{i18n.t('readiness.explainDisclaimer')}</p>
              </InfoPopover>
            {/snippet}
            <ReadinessGauge readiness={condition.readiness} size="lg" {garminScore} now={nowMs} {popover} />
          {:else}
            <p class="note">{i18n.t('condition.noScore')}</p>
          {/if}

          {#if recovery}
            <div class="recovery">
              <span class="recovery-icon" style="color: var(--lane-cyan)">
                <Icon name="clock" size={16} />
              </span>
              <span class="recovery-value">{fmtRecovery(i18n.t, recoveryMinutes)}</span>
              <span class="recovery-label">
                <!--
                  The timer is a COUNTDOWN captured at a moment. Given Garmin's own capture instant we
                  advance it to now (spec 075), so a reading from an older day is still a true figure
                  and needs no qualifier. Without that instant — or once a later session has made
                  Garmin re-derive the timer — it really is frozen, and says so (spec 072).
                -->
                {#if recoveryMinutes <= 0}
                  {i18n.t('condition.recoveredLabel')}
                {:else if recoveryLive}
                  {i18n.t('condition.recoveryLabel')}
                {:else if stale}
                  {i18n.t('condition.recoveryLabelStale', { day: formatDay(i18n.locale, recovery.day) })}
                {:else}
                  {i18n.t('condition.recoveryLabel')}
                {/if}
              </span>
              {#if recovery.changeKey}
                <span class="recovery-change">{i18n.t(recovery.changeKey)}</span>
              {/if}
              <!--
                The half of the pair that does not decay: a countdown answers "how long", this answers
                "when", and only "when" can be checked against the watch an hour from now. Given its
                own row, so the timer keeps one uninterrupted reading line above it.
              -->
              {#if recoveryLive && recoveryMinutes > 0 && recoveryEnd}
                <span class="recovery-end">{i18n.t('condition.recoveryEndLabel', { when: recoveryEnd })}</span
                >
              {/if}
            </div>
          {/if}

          <p class="summary">{activeSummary}</p>

          <!--
            No Training Readiness for this account: the gauge still works from the fallback channels
            (spec 084) and marks them as ours, so this only explains why no Garmin figure sits beside
            the score.
          -->
          {#if garmin === null}
            <p class="source-note">{i18n.t('condition.noGarminScore')}</p>
          {/if}
        </div>

        {#if hasBatteryChart}
          <div class="battery">
            <div class="battery-head">
              <h4 class="block-title">
                <span class="block-icon" style="color: var(--lane-cyan)"
                  ><Icon name="battery" size={16} /></span
                >
                Body Battery
              </h4>
              <span class="block-meta">{i18n.t('condition.batteryPeriod')}</span>
            </div>
            <TrendChart
              values={batteryDay.map((p) => p.value ?? NaN)}
              labels={batteryDay.map((p) => formatInstant(i18n.locale, new Date(p.at), 'time'))}
              color="var(--lane-cyan)"
              height={132}
              yAxis={false}
              label="Body Battery"
              formatValue={(n) => String(Math.round(n))}
            />
          </div>
        {/if}
      </div>

      {#if sleep}
        <section class="block" aria-labelledby="condition-sleep">
          <div class="block-head">
            <h4 class="block-title" id="condition-sleep">
              <span class="block-icon" style="color: var(--lane-indigo)"><Icon name="moon" size={16} /></span>
              {i18n.t('condition.lastNightTitle')}
            </h4>
            <span class="block-meta">{formatDay(i18n.locale, sleep.day, 'weekday')}</span>
          </div>

          <div class="sleep-total">
            <span class="total-value">{fmtSleepDuration(sleep.totalS) ?? '—'}</span>
            <span class="total-label">{i18n.t('condition.sleepLabel')}</span>
          </div>

          {#if sleepReadouts.length > 0}
            <ul class="readouts">
              {#each sleepReadouts as r (r.key)}
                <li class="readout">
                  <span class="readout-icon" style="color: {r.accent}"><Icon name={r.icon} size={16} /></span>
                  <span class="readout-value">{r.value}</span>
                  <span class="readout-label">{r.label}</span>
                </li>
              {/each}
            </ul>
          {/if}

          {#if stages.some((s) => s.value > 0)}
            <StackedBar
              segments={stages}
              ariaLabel={i18n.t('condition.sleepStagesAriaLabel')}
              format={(v) => fmtSleepDuration(v) ?? '—'}
            />
          {/if}
        </section>
      {/if}

      {#if condition.channels.length > 0}
        <section class="block" aria-labelledby="condition-channels">
          <div class="block-head">
            <h4 class="block-title" id="condition-channels">
              <span class="block-icon" style="color: var(--lane-green)"><Icon name="pulse" size={16} /></span>
              {i18n.t('condition.channelsTitle')}
            </h4>
            <span class="block-meta">{i18n.t('condition.channelsSubtitle')}</span>
          </div>

          <ul class="channels">
            {#each condition.channels as c (c.key)}
              <li class="channel" style="--lane: var(--lane-{c.accent})">
                <span class="channel-icon"><Icon name={icon(c.key)} size={16} /></span>
                <span class="channel-readout">
                  <span class="channel-value">{fmtChannelValue(i18n.t, c)}</span>
                  {#if c.unit}<span class="channel-unit">{c.unit}</span>{/if}
                </span>
                <span class="channel-label">{c.label}</span>
                <span class="channel-delta {deltaClass(c)}">
                  {#if fmtDelta(i18n.t, c)}
                    {i18n.t('condition.channelDelta', {
                      delta: fmtDelta(i18n.t, c) ?? '',
                      baseline: fmtBaseline(i18n.t, c) ?? ''
                    })}
                  {:else}
                    {i18n.t('garminReadiness.change.none')}
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {/if}
</Card>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .note {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }
  .link:hover {
    text-decoration: underline;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /*
    The reading order is vertical, not horizontal: score, then the sentence that explains it (spec
    059). The old layout put the sentence in its own hero column, which at this card's width made a
    62-character line into a ten-line ribbon of three-word rows beside the number. The chart is the
    only thing that earns a second column, and only when there is room for one.
  */
  .hero {
    display: grid;
    gap: var(--space-5);
    align-items: start;
  }

  .lead {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .source-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    line-height: var(--leading-normal);
  }

  /* Garmin's recovery timer: a fact about the body, so it stays put whichever score is on screen. */
  .recovery {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .recovery-icon {
    display: inline-flex;
    align-self: center;
  }

  .recovery-value {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .recovery-label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .recovery-change {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
  }

  /* Full-width so the absolute moment sits on its own line under the countdown, not beside it. */
  .recovery-end {
    flex-basis: 100%;
    font-size: var(--text-xs);
    font-feature-settings: var(--numeric);
    color: var(--color-text-subtle);
  }

  .battery {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  @media (min-width: 900px) {
    .hero.with-chart {
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem);
      gap: var(--space-8);
    }
  }

  .battery-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .summary {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--leading-normal);
    color: var(--color-text-on-surface);
    text-wrap: balance;
    max-width: 62ch;
  }

  /* Hairline rules, not nested cards: one instrument face divided into readings. */
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .block-title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .block-icon {
    display: inline-flex;
    align-self: center;
  }

  .block-meta {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
    font-feature-settings: var(--numeric);
  }

  .sleep-total {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .total-value {
    font-size: var(--readout-xl);
    font-weight: var(--font-black);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
    white-space: nowrap;
  }

  .total-label {
    font-size: var(--readout-unit);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }

  /* Dense stat clusters: glyph, big tabular number, micro-caps label underneath. */
  .readouts,
  .channels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: var(--space-4) var(--space-5);
  }

  .readout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'icon value' 'icon label';
    column-gap: var(--space-3);
    align-items: baseline;
    min-width: 0;
  }

  .readout-icon {
    grid-area: icon;
    align-self: center;
    display: inline-flex;
  }

  .readout-value {
    grid-area: value;
    font-size: var(--readout-sm);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
    white-space: nowrap;
  }

  .readout-label {
    grid-area: label;
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .channel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'icon value' 'icon label' 'icon delta';
    column-gap: var(--space-3);
    row-gap: var(--space-1);
    min-width: 0;
  }

  .channel-icon {
    grid-area: icon;
    display: inline-flex;
    align-self: start;
    margin-top: var(--space-1);
    color: var(--lane);
  }

  .channel-readout {
    grid-area: value;
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    min-width: 0;
  }

  .channel-value {
    font-size: var(--readout-sm);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
    white-space: nowrap;
  }

  .channel-unit {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }

  .channel-label {
    grid-area: label;
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .channel-delta {
    grid-area: delta;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text-subtle);
  }
  .channel-delta.good {
    color: var(--color-success);
  }
  .channel-delta.bad {
    color: var(--color-danger);
  }
</style>
