<script lang="ts">
  import {
    AppShell,
    Button,
    Card,
    Input,
    Textarea,
    Field,
    ScoreScale,
    Badge,
    SegmentedControl,
    Toggle,
    Banner,
    Skeleton,
    StatTile,
    IconButton,
    Sparkline,
    BarChart,
    TrendChart,
    RadarChart,
    Table,
    Toast,
    Spinner,
    RangeBadge,
    RankMedal,
    DeltaBadge,
    toasts
  } from '$lib/ui';
  import { DEFAULT_RANGE, RANGE_OPTIONS } from '$lib/range';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let sampleValue = $state('');
  let errorValue = $state('not-an-email');
  let noteValue = $state('');
  let toggleOn = $state(true);

  // Score-scale demos: one fully labelled scale (the check-in's soreness) and one anchors-only (RPE).
  const SORENESS_HINTS: Record<number, string> = {
    1: 'bez śladu',
    2: 'ledwo czuć',
    3: 'lekkie zakwasy',
    4: 'wyraźne zakwasy',
    5: 'czuć przy każdym kroku',
    6: 'boli',
    7: 'boli mocno',
    8: 'trening pod górkę',
    9: 'ledwo się ruszam',
    10: 'nie do ruszenia'
  };
  const RPE_HINTS: Record<number, string> = {
    1: 'bardzo lekko',
    3: 'lekko',
    5: 'umiarkowanie',
    7: 'ciężko',
    9: 'bardzo ciężko',
    10: 'maksymalnie'
  };
  let soreDemo = $state<number | null>(6);
  let rpeDemo = $state<number | null>(null);

  const rows = [
    { day: 'Mon', steps: 8421, rhr: 54, sleep: '7h 12m' },
    { day: 'Tue', steps: 11238, rhr: 52, sleep: '6h 48m' },
    { day: 'Wed', steps: 6094, rhr: 55, sleep: '7h 40m' },
    { day: 'Thu', steps: 9765, rhr: 53, sleep: '7h 02m' }
  ];

  // Profile-shape demo vectors for the radar (already normalised 0..1; null = brak danych).
  const radarFull = [
    { key: 'speed', label: 'Szybkość', value: 0.81 },
    { key: 'tempo', label: 'Tempo', value: 0.57 },
    { key: 'endurance', label: 'Wytrzymałość', value: 0.62 },
    { key: 'volume', label: 'Objętość', value: 0.4 },
    { key: 'consistency', label: 'Regularność', value: 0.72 }
  ];
  const radarGap = radarFull.map((a) => (a.key === 'endurance' ? { ...a, value: null } : a));
  const radarSparse = radarFull.map((a, i) => (i === 0 ? a : { ...a, value: null }));

  // Sample 7-day series for the trend charts.
  const stepsSeries = [8421, 11238, 6094, 9765, 7310, 10420, 9204];
  const rhrSeries = [54, 52, 55, 53, 53, 51, 50];
  const batterySeries = [61, 68, 72, 66, 74, 70, 72];
  const hrvSeries = [42, 45, 41, 48, 47, 52, 49];

  // 14-day daily series for the larger Analytics charts.
  const dailySteps = [
    8421, 11238, 6094, 9765, 7310, 10420, 9204, 12480, 5900, 8830, 10120, 7640, 9950, 11870
  ];
  const dayLabels = [
    'Jul 25',
    'Jul 26',
    'Jul 27',
    'Jul 28',
    'Jul 29',
    'Jul 30',
    'Jul 31',
    'Aug 1',
    'Aug 2',
    'Aug 3',
    'Aug 4',
    'Aug 5',
    'Aug 6',
    'Aug 7'
  ];
  const dailyBattery = [61, 68, 72, 66, 74, 70, 72, 58, 63, 69, 77, 71, 66, 73];
  const dailyRhr = [54, 52, 55, 53, 53, 51, 50, 56, 54, 52, 51, 53, 52, 49];

  const fmtInt = (n: number) => n.toLocaleString();

  // 90 days of steps — enough that the x ticks must thin themselves to fit.
  const quarterSteps = Array.from({ length: 90 }, (_, i) =>
    Math.round(9000 + Math.sin(i / 4) * 2600 + (i % 7 === 6 ? -2800 : 0) + (i % 11) * 120)
  );
  // Short month names keep a date tick to ~6 characters, which is what lets many of them fit.
  const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const quarterLabels = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 4, 14 + i));
    return `${d.getUTCDate()} ${MONTHS_PL[d.getUTCMonth()]}`;
  });

  // Three-series load chart — the PMC shape, now expressible with the shared primitive.
  const pmcSeries = [
    {
      name: 'CTL',
      values: [38, 40, 41, 43, 44, 46, 47, 49, 50, 51, 52, 54, 55, 56],
      color: 'var(--lane-green)'
    },
    {
      name: 'ATL',
      values: [30, 46, 52, 38, 61, 44, 35, 58, 66, 42, 39, 71, 48, 40],
      color: 'var(--lane-red)'
    },
    { name: 'TSB', values: [8, -6, -11, 5, -17, 2, 12, -9, -16, 9, 13, -17, 7, 16], color: 'var(--lane-sky)' }
  ];

  // Grouped bars: minutes per sport per day.
  const sportSeries = [
    { name: 'Bieg', values: [45, 0, 62, 0, 38, 0, 74], color: 'var(--lane-orange)' },
    { name: 'Rower', values: [0, 90, 0, 55, 0, 120, 0], color: 'var(--lane-cyan)' },
    { name: 'Siła', values: [20, 0, 25, 0, 30, 0, 0], color: 'var(--lane-violet)' }
  ];
  const weekLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

  // Click-to-select demo: the headline follows the picked day.
  let pickedDay = $state<number | null>(dailySteps.length - 1);
  const pickedLabel = $derived(pickedDay === null ? '—' : (dayLabels[pickedDay] ?? '—'));
  const pickedSteps = $derived(pickedDay === null ? '—' : fmtInt(dailySteps[pickedDay] ?? 0));

  const rangeOptions = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '1y', label: '1Y' }
  ];
  let range = $state('30d');

  // The real global range set (spec 047) — long + compact labels per option.
  const globalRangeOptions = $derived(
    RANGE_OPTIONS.map((o) => ({
      value: o.value,
      label: i18n.t(o.labelKey),
      short: i18n.t(o.shortKey)
    }))
  );
  let globalRange = $state<string>(DEFAULT_RANGE);
</script>

<AppShell title="Styleguide">
  {#snippet brand()}
    <span class="brand">GB Design System</span>
  {/snippet}

  {#snippet nav()}
    <a class="nav-link active" href="#buttons">Buttons</a>
    <a class="nav-link" href="#badges">Badges</a>
    <a class="nav-link" href="#ranks">Rank medals</a>
    <a class="nav-link" href="#deltas">Delta badges</a>
    <a class="nav-link" href="#segmented">Segmented control</a>
    <a class="nav-link" href="#range">Range indicator</a>
    <a class="nav-link" href="#banners">Banners</a>
    <a class="nav-link" href="#stats">Stat tiles</a>
    <a class="nav-link" href="#sparklines">Sparklines</a>
    <a class="nav-link" href="#charts">Charts</a>
    <a class="nav-link" href="#cards">Cards</a>
    <a class="nav-link" href="#forms">Forms</a>
    <a class="nav-link" href="#scores">Score scale</a>
    <a class="nav-link" href="#table">Table</a>
    <a class="nav-link" href="#feedback">Feedback</a>
    <a class="nav-link" href="#skeletons">Skeletons</a>
  {/snippet}

  {#snippet actions()}
    <Button size="sm" variant="secondary">Docs</Button>
  {/snippet}

  <div class="page">
    <!-- ============ BUTTONS ============ -->
    <section id="buttons" class="group">
      <h2>Buttons</h2>

      <h3>Variants (md)</h3>
      <div class="row">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>

      <h3>Sizes</h3>
      <div class="row">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="sm" variant="secondary">Small</Button>
        <Button size="md" variant="secondary">Medium</Button>
      </div>

      <h3>States</h3>
      <div class="row">
        <Button loading>Saving…</Button>
        <Button variant="secondary" loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button variant="danger" disabled>Disabled</Button>
      </div>

      <h3>Icon only (spec 027)</h3>
      <div class="row">
        <IconButton icon="refresh" label="Synchronizuj teraz" />
        <IconButton icon="refresh" label="Synchronizuj teraz" size="sm" />
        <IconButton icon="refresh" label="Synchronizacja w toku" loading />
        <IconButton icon="calendar" label="Kalendarz" disabled />
      </div>
    </section>

    <!-- ============ BADGES ============ -->
    <section id="badges" class="group">
      <h2>Badges</h2>
      <div class="row">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="success">Connected</Badge>
        <Badge tone="warning">Degraded</Badge>
        <Badge tone="danger">Down</Badge>
        <Badge tone="info">Info</Badge>
      </div>
    </section>

    <!-- ============ RANK MEDALS ============ -->
    <section id="ranks" class="group">
      <h2>Rank medals</h2>
      <p class="muted">
        The podium hierarchy for any "best N ever" list (spec 054): gold, silver, bronze, then plainly
        numbered. Colour never carries the meaning on its own &mdash; the rank (or a short label such as
        <code>PR</code>) is always printed, so the order survives greyscale and a screen reader.
      </p>
      <div class="row">
        <RankMedal rank={1} label="PR" ariaLabel="Rekord życiowy" />
        <RankMedal rank={2} />
        <RankMedal rank={3} />
        <RankMedal rank={4} />
        <RankMedal rank={12} />
      </div>
    </section>

    <!-- ============ DELTA BADGES ============ -->
    <section id="deltas" class="group">
      <h2>Delta badges</h2>
      <p class="muted">
        "This metric moved, and that is good or bad" (spec 076). Direction (the tone) and arrow are separate
        props on purpose: a faster race time is an improvement that points <em>down</em>, a rising weekly
        volume is an improvement that points <em>up</em>. Colour never carries the meaning alone &mdash; the
        arrow plus a visually hidden sentence state it too.
      </p>
      <div class="row">
        <DeltaBadge direction="better" arrow="down" value="1:40" label="szybciej o 1:40 niż 90 dni temu" />
        <DeltaBadge direction="worse" arrow="up" value="0:35" label="wolniej o 0:35 niż 90 dni temu" />
        <DeltaBadge direction="same" value="bez zmian" label="bez zmian od 90 dni" />
        <DeltaBadge
          direction="better"
          arrow="up"
          value="+12 km"
          label="12 km więcej niż w zeszłym miesiącu"
        />
      </div>
    </section>

    <!-- ============ SEGMENTED CONTROL ============ -->
    <section id="segmented" class="group">
      <h2>Segmented control</h2>

      <h3>Window range (md)</h3>
      <div class="row">
        <SegmentedControl options={rangeOptions} bind:value={range} ariaLabel="Insights window range" />
        <span class="muted">Selected: {range}</span>
      </div>

      <h3>Compact (sm)</h3>
      <div class="row">
        <SegmentedControl
          options={rangeOptions}
          bind:value={range}
          ariaLabel="Insights window range (compact)"
          size="sm"
        />
      </div>

      <h3>With compact labels (spec 047)</h3>
      <p class="muted">
        Options carrying a <code>short</code> label swap to it below 768&nbsp;px. Narrow the window to see
        <code>7d 14d 30d 1r ∞</code>. The full label stays the accessible name at every width.
      </p>
      <div class="row">
        <SegmentedControl
          options={globalRangeOptions}
          bind:value={globalRange}
          ariaLabel="Global data range"
          size="sm"
        />
        <span class="muted">Selected: {globalRange}</span>
      </div>
    </section>

    <!-- ============ RANGE INDICATOR ============ -->
    <section id="range" class="group">
      <h2>Range indicator</h2>
      <p class="muted">
        The global range switch (spec 047) lives in the <code>AppShell</code> topbar on every range-aware route
        — it is not composed per page, so there is nothing to demo here. What pages DO compose is the indicator:
        every card whose content follows the switch carries one, and a card without one is claiming the opposite
        (all-time, switch-independent). Absence is meaningful, so never add it decoratively.
      </p>

      <h3>Sizes</h3>
      <div class="row">
        <RangeBadge label="30 dni" />
        <RangeBadge label="30 dni" size="sm" />
      </div>

      <h3>Bucketed range</h3>
      <p class="muted">
        Past 45 days a chart point stops being a day. Pass <code>bucketNoun</code> and the tooltip says what one
        point covers — hover to read it.
      </p>
      <div class="row">
        <RangeBadge label="1 rok" bucketNoun="tydzień" />
        <RangeBadge label="cały czas (od 2021-03-04)" bucketNoun="miesiąc" />
      </div>

      <h3>On a card</h3>
      <div class="row col">
        <Card title="Objętość treningu" subtitle="Godziny w tygodniu" range="30 dni">
          <p class="muted">Ranged: the badge appears in the header via the <code>range</code> prop.</p>
        </Card>
        <Card title="Zebrane dane" subtitle="Ile danych masz lokalnie">
          <p class="muted">Not ranged: no badge, because the switch does not move these numbers.</p>
        </Card>
      </div>
    </section>

    <!-- ============ TOGGLE ============ -->
    <section id="toggle" class="group">
      <h2>Toggle</h2>
      <div class="row">
        <Toggle checked={toggleOn} label="Demo toggle" onchange={(next) => (toggleOn = next)} />
        <span class="muted">{toggleOn ? 'On' : 'Off'}</span>
        <Toggle checked={true} size="sm" label="Small on" />
        <Toggle checked={false} disabled label="Disabled" />
        <Toggle checked={true} loading label="Loading" />
      </div>
    </section>

    <!-- ============ BANNERS ============ -->
    <section id="banners" class="group">
      <h2>Banners</h2>
      <div class="stack full">
        <Banner tone="danger" title="Garmin service is temporarily unavailable">
          We couldn't reach the Garmin service, so these readings may be stale. Your data is safe — we'll
          reconnect automatically.
        </Banner>
        <Banner tone="warning" title="Session expiring soon">
          Reconnect within 24 hours to keep your metrics syncing.
        </Banner>
        <Banner tone="success" title="Garmin account connected">
          Your dashboard will populate on the next refresh.
        </Banner>
        <Banner tone="info">
          {#snippet children()}Heads up: trends need 7 days of history to appear.{/snippet}
        </Banner>
        <Banner tone="warning" title="Analytics paused">
          {#snippet children()}Trend collection is off for this account.{/snippet}
          {#snippet actions()}
            <Button size="sm" variant="secondary">Resume</Button>
          {/snippet}
        </Banner>
      </div>
    </section>

    <!-- ============ STAT TILES ============ -->
    <section id="stats" class="group">
      <h2>Stat tiles</h2>
      <div class="grid">
        <StatTile label="Steps today" value="9,204" accent="orange" delta={12} deltaSuffix="%">
          {#snippet sparkline()}
            <Sparkline values={stepsSeries} label="steps" color="var(--lane-orange)" showArea />
          {/snippet}
        </StatTile>

        <StatTile label="Resting HR" value="50" unit="bpm" accent="red" delta={-2} deltaSuffix=" bpm">
          {#snippet sparkline()}
            <Sparkline values={rhrSeries} label="resting HR" color="var(--lane-red)" />
          {/snippet}
        </StatTile>

        <StatTile label="Body battery" value="72" unit="%" accent="cyan" delta={3} deltaSuffix="%">
          {#snippet sparkline()}
            <Sparkline values={batterySeries} label="body battery" color="var(--lane-cyan)" showArea />
          {/snippet}
        </StatTile>

        <StatTile label="HRV overnight" value="49" unit="ms" accent="green" delta={0} deltaSuffix=" ms" />

        <StatTile label="SpO2" value="—" accent="sky" muted />

        <!-- Long readouts step down a size instead of spilling past the tile border (spec 029). -->
        <StatTile label="Czas" value="6 h 52 min" accent="indigo" />

        <StatTile label="Dystans łącznie" value="12 345 678" unit="km" accent="violet" />
      </div>

      <!-- The activity-detail hero row: many narrow columns, where the readout tokens (sized off the
           viewport) used to overlap their own unit. The tile measures itself now (spec 031). -->
      <h3>Narrow columns (activity hero)</h3>
      <div class="tiles-narrow">
        <StatTile label="Dystans" value="6,11" unit="km" accent="orange" />
        <StatTile label="Czas w ruchu" value="34:50" accent="cyan" />
        <StatTile label="Średnie tempo" value="5:44" unit="min/km" accent="lime" />
        <StatTile label="Średnie tętno" value="135" unit="bpm" accent="red" />
        <StatTile label="Średnia moc" value="387" unit="W" accent="amber" />
        <StatTile label="Przewyższenie" value="30" unit="m" accent="green" />
        <StatTile label="Kalorie" value="517" unit="kcal" accent="violet" />
        <StatTile label="Obciążenie" value="65" accent="indigo" />
      </div>
    </section>

    <!-- ============ SPARKLINES ============ -->
    <section id="sparklines" class="group">
      <h2>Sparklines</h2>

      <h3>Lane colours</h3>
      <div class="sparks">
        <div class="spark-cell">
          <span class="spark-name">Steps</span>
          <Sparkline values={stepsSeries} label="steps" color="var(--lane-orange)" showArea />
        </div>
        <div class="spark-cell">
          <span class="spark-name">HRV</span>
          <Sparkline values={hrvSeries} label="HRV" color="var(--lane-green)" showArea baseline={45} />
        </div>
        <div class="spark-cell">
          <span class="spark-name">Resting HR</span>
          <Sparkline values={rhrSeries} label="resting HR" color="var(--lane-red)" />
        </div>
        <div class="spark-cell">
          <span class="spark-name">Body battery</span>
          <Sparkline values={batterySeries} label="body battery" color="var(--lane-cyan)" showArea />
        </div>
      </div>

      <h3>Edge cases</h3>
      <div class="sparks">
        <div class="spark-cell">
          <span class="spark-name">Single point</span>
          <Sparkline values={[72]} label="single" color="var(--lane-indigo)" />
        </div>
        <div class="spark-cell">
          <span class="spark-name">All equal</span>
          <Sparkline values={[60, 60, 60, 60]} label="flat" color="var(--lane-amber)" showArea />
        </div>
        <div class="spark-cell">
          <span class="spark-name">Empty</span>
          <Sparkline values={[]} label="empty" />
        </div>
      </div>
    </section>

    <!-- ============ CHARTS ============ -->
    <section id="charts" class="group">
      <h2>Charts</h2>

      <h3>Bar chart — daily series</h3>
      <div class="charts">
        <div class="chart-cell">
          <span class="chart-name">Steps · 14 days</span>
          <BarChart values={dailySteps} labels={dayLabels} color="var(--lane-orange)" formatValue={fmtInt} />
        </div>
        <div class="chart-cell">
          <span class="chart-name">Body battery · goal 70</span>
          <BarChart values={dailyBattery} labels={dayLabels} color="var(--lane-cyan)" baseline={70} />
        </div>
      </div>

      <h3>Trend chart — line + area</h3>
      <p class="muted">
        Hover, tap-and-drag, or focus the chart and press ←/→ to read a single day. Pass
        <code>labels</code> to title the read-out with its date.
      </p>
      <div class="charts">
        <div class="chart-cell wide">
          <span class="chart-name">Steps · min/max + average</span>
          <TrendChart
            values={dailySteps}
            labels={dayLabels}
            label="steps"
            color="var(--lane-orange)"
            formatValue={fmtInt}
            showAvg
          />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Resting HR</span>
          <TrendChart values={dailyRhr} labels={dayLabels} label="resting HR" color="var(--lane-red)" />
        </div>
      </div>

      <h3>Axes — labelled scale, thinned date ticks, unit</h3>
      <p class="muted">
        The y scale lands on round values and reserves exactly the gutter its widest tick needs; the unit is
        printed once, never on every tick. X ticks thin themselves to the measured width, so 90 dates and 7
        dates both stay readable. <code>xAxis</code>/<code>yAxis</code> turn them off for decorative uses.
      </p>
      <div class="charts">
        <div class="chart-cell wide">
          <span class="chart-name">Steps · 90 days · ticks thin automatically</span>
          <TrendChart
            values={quarterSteps}
            labels={quarterLabels}
            label="steps"
            unit="kroki"
            color="var(--lane-orange)"
            formatValue={fmtInt}
            showAvg
          />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Resting HR · bpm</span>
          <BarChart
            values={dailyRhr}
            labels={dayLabels}
            label="resting HR"
            unit="bpm"
            color="var(--lane-red)"
            height={180}
          />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Axes off — decorative</span>
          <TrendChart
            values={dailyBattery}
            labels={dayLabels}
            label="body battery"
            color="var(--lane-cyan)"
            xAxis={false}
            yAxis={false}
            height={120}
          />
        </div>
      </div>

      <h3>Multi-series + legend</h3>
      <p class="muted">
        Pass <code>series</code> for two or more named lines/bars. Legend items carry each series' value while a
        read-out is open, and toggle their series on click or Enter — the last visible series can't be switched
        off.
      </p>
      <div class="charts">
        <div class="chart-cell wide">
          <span class="chart-name">Training load · CTL / ATL / TSB</span>
          <TrendChart
            series={pmcSeries}
            labels={dayLabels.slice(0, 14)}
            label="load"
            unit="TSS/d"
            height={220}
          />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Minutes per sport · grouped bars</span>
          <BarChart series={sportSeries} labels={weekLabels} unit="min" height={200} />
        </div>
      </div>

      <h3>Click to select</h3>
      <p class="muted">
        Click, tap, or focus the chart and press Enter to pin a day — the pinned read-out survives the pointer
        leaving, so a headline can follow it via <code>bind:selectedIndex</code>. Esc clears the pin.
      </p>
      <div class="charts">
        <div class="chart-cell wide">
          <span class="chart-name">Steps · {pickedLabel}</span>
          <StatTile label="Kroki tego dnia" value={pickedSteps} unit="kroki" accent="orange" />
          <BarChart
            values={dailySteps}
            labels={dayLabels}
            label="steps"
            color="var(--lane-orange)"
            formatValue={fmtInt}
            height={180}
            bind:selectedIndex={pickedDay}
          />
        </div>
      </div>

      <h3>Edge cases</h3>
      <div class="charts">
        <div class="chart-cell">
          <span class="chart-name">Bar · empty</span>
          <BarChart values={[]} />
        </div>
        <div class="chart-cell">
          <span class="chart-name">Bar · single</span>
          <BarChart values={[9204]} labels={['Aug 7']} color="var(--lane-green)" />
        </div>
        <div class="chart-cell">
          <span class="chart-name">Bar · all equal</span>
          <BarChart values={[60, 60, 60, 60, 60]} color="var(--lane-amber)" />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Trend · empty</span>
          <TrendChart values={[]} label="steps" />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Trend · single</span>
          <TrendChart values={[72]} label="body battery" color="var(--lane-cyan)" />
        </div>
        <div class="chart-cell wide">
          <span class="chart-name">Trend · all equal</span>
          <TrendChart values={[50, 50, 50, 50, 50]} label="flat" color="var(--lane-indigo)" />
        </div>
      </div>

      <h3>Radar (profile shape)</h3>
      <div class="charts">
        <div class="chart-cell">
          <span class="chart-name">Radar · five axes</span>
          <RadarChart axes={radarFull} ariaLabel="Radar demo" color="var(--lane-orange)" />
        </div>
        <div class="chart-cell">
          <span class="chart-name">Radar · one axis missing</span>
          <RadarChart axes={radarGap} ariaLabel="Radar demo z brakiem danych" />
        </div>
        <div class="chart-cell">
          <span class="chart-name">Radar · too little data (frame only)</span>
          <RadarChart axes={radarSparse} ariaLabel="Radar demo bez danych" />
        </div>
      </div>
    </section>

    <!-- ============ CARDS ============ -->
    <section id="cards" class="group">
      <h2>Cards</h2>
      <div class="grid">
        <Card title="Health check" subtitle="Sidecar + Garmin session">
          {#snippet actions()}
            <Badge tone="success">Healthy</Badge>
          {/snippet}
          <p class="muted">All systems reporting. Last checked a moment ago.</p>
        </Card>

        <Card title="MCP endpoint">
          {#snippet actions()}
            <Button size="sm" variant="ghost">Copy</Button>
          {/snippet}
          <code class="mcp">https://bridge.lan:8080/mcp?token=•••••</code>
        </Card>

        <Card>
          <p class="muted">A plain card with no header — just body content and token padding.</p>
        </Card>
      </div>
    </section>

    <!-- ============ FORMS ============ -->
    <section id="forms" class="group">
      <h2>Forms</h2>
      <div class="form">
        <Field label="Email" help="We only use this to log you in.">
          {#snippet children(c)}
            <Input
              id={c.id}
              aria-describedby={c.describedBy}
              type="email"
              placeholder="you@example.com"
              bind:value={sampleValue}
            />
          {/snippet}
        </Field>

        <Field label="Garmin email" error="Enter a valid email address." required>
          {#snippet children(c)}
            <Input
              id={c.id}
              aria-describedby={c.describedBy}
              invalid={c.invalid}
              type="email"
              bind:value={errorValue}
            />
          {/snippet}
        </Field>

        <Field label="Disabled field" help="Read-only example.">
          {#snippet children(c)}
            <Input id={c.id} aria-describedby={c.describedBy} value="locked" disabled />
          {/snippet}
        </Field>

        <Field label="Note" help="Textarea — the counter appears only near the limit.">
          {#snippet children(c)}
            <Textarea
              id={c.id}
              aria-describedby={c.describedBy}
              bind:value={noteValue}
              rows={3}
              maxlength={240}
              counterFrom={60}
              placeholder="anything worth remembering"
            />
          {/snippet}
        </Field>
      </div>
    </section>

    <!-- ============ SCORE SCALES ============ -->
    <section id="scores" class="group">
      <h2>Score scale</h2>
      <div class="form">
        <ScoreScale
          label="Ból / zakwasy"
          value={soreDemo}
          hints={SORENESS_HINTS}
          lowLabel={SORENESS_HINTS[1]}
          highLabel={SORENESS_HINTS[10]}
          warnFrom={4}
          onchange={(next) => (soreDemo = next)}
        />
        <ScoreScale
          label="RPE (anchors only)"
          value={rpeDemo}
          hints={RPE_HINTS}
          lowLabel={RPE_HINTS[1]}
          highLabel={RPE_HINTS[10]}
          onchange={(next) => (rpeDemo = next)}
        />
        <ScoreScale label="Unset" value={null} onchange={() => {}} />
        <ScoreScale label="Disabled" value={6} disabled onchange={() => {}} />
      </div>
    </section>

    <!-- ============ TABLE ============ -->
    <section id="table" class="group">
      <h2>Table</h2>
      <Table zebra caption="Recent daily metrics">
        {#snippet head()}
          <th>Day</th>
          <th>Steps</th>
          <th>Resting HR</th>
          <th>Sleep</th>
        {/snippet}
        {#each rows as r (r.day)}
          <tr>
            <td>{r.day}</td>
            <td>{r.steps.toLocaleString()}</td>
            <td>{r.rhr} bpm</td>
            <td>{r.sleep}</td>
          </tr>
        {/each}
      </Table>
    </section>

    <!-- ============ FEEDBACK ============ -->
    <section id="feedback" class="group">
      <h2>Feedback</h2>

      <h3>Spinner</h3>
      <div class="row">
        <Spinner size="sm" />
        <Spinner size="md" />
      </div>

      <h3>Toast (static preview)</h3>
      <div class="stack">
        <Toast tone="success" message="Garmin session refreshed." ondismiss={() => {}} />
        <Toast tone="error" message="Sidecar is unreachable." ondismiss={() => {}} />
        <Toast tone="info" message="MCP token copied to clipboard." ondismiss={() => {}} />
      </div>

      <h3>Toast (live via store)</h3>
      <div class="row">
        <Button size="sm" variant="secondary" onclick={() => toasts.success('Saved successfully.')}>
          Fire success
        </Button>
        <Button size="sm" variant="secondary" onclick={() => toasts.error('Something went wrong.')}>
          Fire error
        </Button>
        <Button size="sm" variant="secondary" onclick={() => toasts.info('Heads up.')}>Fire info</Button>
      </div>
    </section>

    <!-- ============ SKELETONS ============ -->
    <section id="skeletons" class="group">
      <h2>Skeletons</h2>

      <h3>Primitives</h3>
      <div class="skeleton-demo">
        <Skeleton width="var(--space-16)" height="var(--space-2)" />
        <Skeleton height="var(--space-4)" radius="md" />
        <Skeleton height="var(--space-8)" radius="lg" />
        <div class="skeleton-row">
          <Skeleton circle height="var(--space-10)" />
          <div class="skeleton-lines">
            <Skeleton width="60%" height="var(--space-3)" />
            <Skeleton width="90%" height="var(--space-2)" />
          </div>
        </div>
      </div>

      <h3>Composed tile placeholder</h3>
      <div class="grid">
        <div class="tile-skeleton">
          <Skeleton width="40%" height="var(--space-2)" />
          <Skeleton width="70%" height="var(--space-10)" radius="md" />
          <Skeleton height="var(--space-8)" radius="md" />
        </div>
        <div class="tile-skeleton">
          <Skeleton width="45%" height="var(--space-2)" />
          <Skeleton width="60%" height="var(--space-10)" radius="md" />
          <Skeleton height="var(--space-8)" radius="md" />
        </div>
      </div>
    </section>
  </div>
</AppShell>

<style>
  .brand {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .nav-link {
    display: block;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-decoration: none;
  }
  .nav-link:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
    text-decoration: none;
  }
  .nav-link.active {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    scroll-margin-top: var(--topbar-height);
  }

  .group h3 {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: var(--space-2);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  /* A row of full-width demos (cards) rather than inline chips. */
  .row.col {
    flex-direction: column;
    align-items: stretch;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  .stack.full {
    align-items: stretch;
    gap: var(--space-3);
  }

  .skeleton-demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 420px;
  }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1;
  }

  .tile-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-4);
  }

  /* Mirrors the activity-detail hero exactly, so the narrow-column case is documented, not implied. */
  .tiles-narrow {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .sparks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-4);
  }

  .spark-cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .spark-name {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }

  .chart-cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .chart-cell.wide {
    grid-column: span 2;
  }

  @media (max-width: 720px) {
    .chart-cell.wide {
      grid-column: auto;
    }
  }

  .chart-name {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 420px;
  }

  .muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .mcp {
    display: block;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-on-surface);
    overflow-x: auto;
  }
</style>
