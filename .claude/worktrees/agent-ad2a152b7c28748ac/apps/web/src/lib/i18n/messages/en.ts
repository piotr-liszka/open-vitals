/**
 * English catalog (spec 055) — a complete mirror of `pl.ts`, not a partial overlay.
 *
 * Typed as `Catalog`, whose key set comes from the Polish catalog: adding a Polish message without
 * translating it here is a type error, and so is a key that exists only here. Keep the sections and
 * their order identical to `pl.ts` so the two files diff against each other cleanly.
 *
 * Wording follows British conventions (`en-GB` is the `Intl` tag) and stays metric throughout.
 */
import type { Catalog } from './index';

export const en: Catalog = {
  /* ------------------------------------------------------------------ *
   * Shared vocabulary
   * ------------------------------------------------------------------ */
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.add': 'Add',
  'common.refresh': 'Refresh',
  'common.retry': 'Try again',
  'common.back': 'Back',
  'common.more': 'More',
  'common.less': 'Less',
  'common.all': 'All',
  'common.none': 'None',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.on': 'On',
  'common.off': 'Off',
  'common.loading': 'Loading…',
  'common.error': 'Error',
  'common.noData': 'No data',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.show': 'Show',
  'common.hide': 'Hide',
  'common.days': { one: '{count} day', other: '{count} days' },
  'common.weeks': { one: '{count} week', other: '{count} weeks' },
  'common.activities': { one: '{count} activity', other: '{count} activities' },

  /* ------------------------------------------------------------------ *
   * App chrome
   * ------------------------------------------------------------------ */
  'shell.brand': 'OpenVitals',
  'shell.sidebarLabel': 'Primary navigation',
  'shell.openMenu': 'Open menu',
  'shell.closeMenu': 'Close menu',
  'shell.version': 'Version',
  'shell.builtAt': 'Built: {at}',
  'shell.builtAtCommit': 'Built: {at} · commit {sha}',
  'shell.logout': 'Sign out',

  'theme.toLight': 'Switch to light mode',
  'theme.toDark': 'Switch to dark mode',
  'theme.label': 'Dark mode',

  'lang.label': 'Language',
  'lang.pl': 'Polish',
  'lang.en': 'English',
  'lang.plShort': 'PL',
  'lang.enShort': 'EN',
  'lang.switchTo': 'Switch to {language}',

  /* ------------------------------------------------------------------ *
   * Navigation (spec 048 groups)
   * ------------------------------------------------------------------ */
  'nav.group.training': 'Training',
  'nav.group.health': 'Health',
  'nav.group.system': 'System',
  'nav.start': 'Start',
  'nav.training': 'Training',
  'nav.analysis': 'Analysis',
  'nav.plan': 'Training plan',
  'nav.activities': 'Activities',
  'nav.insights': 'Insights',
  'nav.data': 'Data',
  'nav.settings': 'Settings',
  'nav.dashboard': 'Dashboard',

  /* ------------------------------------------------------------------ *
   * Global range switch (spec 047)
   * ------------------------------------------------------------------ */
  'range.label': 'Range',
  'range.7': '7 days',
  'range.14': '14 days',
  'range.30': '30 days',
  'range.365': '1 year',
  'range.all': 'all time',
  'range.7.short': '7d',
  'range.14.short': '14d',
  'range.30.short': '30d',
  'range.365.short': '1y',
  'range.all.short': '∞',
  'range.allFrom': 'all time (from {start})',

  /* ------------------------------------------------------------------ *
   * Daily metrics
   * ------------------------------------------------------------------ */
  'metric.steps': 'Steps',
  'metric.resting_heart_rate': 'Resting heart rate',
  'metric.hrv': 'HRV',
  'metric.body_battery': 'Body Battery',
  'metric.sleep': 'Sleep',
  'metric.stress': 'Stress',
  'metric.spo2': 'SpO₂',
  'metric.respiration': 'Respiration',
  'metric.calories': 'Calories',

  /* ------------------------------------------------------------------ *
   * Shared UI components (lib/ui)
   * ------------------------------------------------------------------ */
  'bucket.day': 'day',
  'bucket.week': 'week',
  'bucket.month': 'month',

  'ui.spinnerLabel': 'Loading',
  'ui.moreCount': '+ {count} more',
  'ui.dismissNotification': 'Dismiss notification',
  'ui.mapLabel': 'Activity map',
  'ui.chartNoData': 'No data',

  'rangeBadge.tooltip':
    'This card shows data for the selected range: {range}. Change it with the switch at the top of the page.',
  'rangeBadge.bucketHint': 'One point is one {noun}.',

  'sparkline.trend': 'trend',
  'sparkline.trendOf': '{label} trend',
  'sparkline.summaryEmpty': '{prefix}, no data',
  'sparkline.summary': {
    one: '{prefix}, {count} point, latest {latest}',
    other: '{prefix}, {count} points, latest {latest}'
  },

  'yearGrid.label': 'Activity through the year',
  'yearGrid.summary': {
    one: '{label}: {count} active day in {year}',
    other: '{label}: {count} active days in {year}'
  },
  'yearGrid.dayEmpty': '{day}: no activity',
  'yearGrid.dayValue': '{day}: {value}',
  'yearGrid.less': 'less',
  'yearGrid.more': 'more',

  'tier.base': 'Basic',
  'tier.advanced': 'Advanced',
  'tier.baseTooltip': 'Basic mode — connection and MCP address only',
  'tier.advancedTooltip': 'Advanced mode — data processing enabled',

  /* ------------------------------------------------------------------ *
   * Sync + data freshness (spec 027)
   * ------------------------------------------------------------------ */
  'sync.lastSync': 'Last sync',
  'sync.never': 'never',
  'sync.syncNow': 'Sync now',
  'sync.inProgress': 'Sync in progress',
  'sync.syncing': 'Syncing',
  'sync.lastAttemptFailed': 'The last attempt failed',
  'sync.details': 'details',
  'sync.autoImminent': 'Auto: any moment now',
  'sync.autoIn': 'Auto in ~{minutes} min',
  'sync.unchangedAt': 'unchanged {at}',
  'sync.checkedUnchanged': 'Checked {at} · unchanged',

  /* ------------------------------------------------------------------ *
   * Consent (spec 011/014)
   * ------------------------------------------------------------------ */
  'consent.genericError': 'Something went wrong. Please try again.',
  'consent.networkError': 'Could not reach the server. Please try again.',
  'consent.accepted': 'Accepted',
  'consent.enabledByDefault': 'Enabled by default',
  'consent.showTerms': 'Show terms',
  'consent.hideTerms': 'Hide terms',
  'consent.acceptAndEnable': 'Accept and enable',
  'consent.badRequest': 'Expected the fields { featureId, termsVersion, accept }.',
  'consent.unknownFeature': 'Unknown feature.',
  'consent.termsChanged': 'The terms have changed — reload the page and read the new version.',

  'advanced.enabled': 'On',
  'advanced.disabled': 'Off',
  'advanced.toggleLabel': 'Toggle advanced mode',
  'advanced.enableTitle': 'Enable advanced mode',
  'advanced.disableTitle': 'Disable advanced mode?',
  'advanced.disableBody':
    'You will return to basic mode — just the Garmin connection and your MCP address. The dashboard, ' +
    'analytics and insights will be hidden, and range data will stop being fetched. You can turn advanced ' +
    'mode back on at any time.',
  'advanced.disableConfirm': 'Disable advanced mode',

  /* ------------------------------------------------------------------ *
   * Garmin connection + setup (spec 003/012)
   * ------------------------------------------------------------------ */
  'connection.title': 'Garmin connection',
  'connection.subtitle': 'We never store your sign-in — only the encrypted tokens Garmin returns.',
  'connection.unreachable': 'Unreachable',
  'connection.connected': 'Connected',
  'connection.disconnected': 'Not connected',
  'connection.sessionValidUntil': 'Session valid until',
  'connection.detailsLabel': 'Details',
  'connection.unreachableDetail': 'Could not reach the Garmin service. We will retry automatically.',
  'connection.disconnectConfirm': 'Disconnect and delete the stored tokens?',
  'connection.disconnect': 'Disconnect',
  'connection.disconnectGarmin': 'Disconnect Garmin',

  'setup.emailLabel': 'Garmin email',
  'setup.passwordLabel': 'Garmin password',
  'setup.passwordPlaceholder': 'Your Garmin Connect password',
  'setup.mfaLabel': 'Verification code',
  'setup.mfaHelp': 'Sent by Garmin by email or through your authenticator app.',
  'setup.startOver': 'Start over',
  'setup.verifyAndConnect': 'Verify and connect',
  'setup.connect': 'Connect Garmin',
  'setup.connected': 'Garmin account connected.',
  'setup.mfaPrompt': 'Enter the verification code Garmin just sent.',
  'setup.rejectedWithCode': 'Garmin rejected these details. Check the email, password and code.',
  'setup.rejected': 'Garmin rejected these details. Check the email and password.',
  'setup.failed': 'Setup failed. Please try again.',
  'setup.networkError': 'Could not reach the server.',
  'setup.keyMismatch':
    'Server configuration error: web and sidecar do not share an INTERNAL_API_KEY. This is not a problem with your password.',

  'setup.invalidCredentials': 'A valid email address and password are required.',
  'setup.serviceUnavailable': 'The Garmin service is unavailable. Please try again shortly.',

  /* ------------------------------------------------------------------ *
   * Personal MCP URL (spec 012)
   * ------------------------------------------------------------------ */
  'mcp.title': 'Your MCP address',
  'mcp.subtitle': 'Add it as a connector in Claude or ChatGPT',
  'mcp.ready': 'Ready',
  'mcp.connectFirst': 'Connect Garmin first',
  'mcp.rotate': 'Rotate',
  'mcp.copyFailed': 'Could not copy — select the address and copy it manually.',
  'mcp.rotated': 'Token rotated — the old address no longer works.',
  'mcp.rotateFailed': 'Could not rotate the token. Please try again.',
  'mcp.networkError': 'Could not reach the server. Please try again.',
  'mcp.warning':
    'This address belongs to your account alone and contains a secret token — treat it like a password. ' +
    'Anyone who has it can read your Garmin data through this service. Use {rotate} to generate a new ' +
    'token; the previous address stops working immediately.',

  'widget.streak.label': 'Streak',
  'widget.streak.description': 'Consecutive weeks with activity',
  'widget.coverage.label': 'Collected data',
  'widget.coverage.description': 'How much data you hold locally',
  'widget.weeklyVolume.label': 'Training volume',
  'widget.weeklyVolume.description': 'Training hours per week (per month over long ranges)',
  'widget.activityTypes.label': 'Activity types',
  'widget.activityTypes.description': 'Split by sport across the selected range',
  'widget.recentActivities.label': 'Recent activities',
  'widget.recentActivities.description': 'The latest sessions in the selected range',
  'widget.metricTrend.label': 'Metric trend',
  'widget.metricTrend.description': 'A metric charted across the selected range',
  'widget.seeAlso': 'The full picture in {page}',

  'dashboard.defaultName': 'Overview',
  'dashboard.rename': 'Rename',
  'dashboard.delete': 'Delete dashboard',
  'dashboard.moveLeft': 'Move left',
  'dashboard.moveRight': 'Move right',
  'dashboard.resize': 'Resize',
  'dashboard.removeWidget': 'Remove widget',

  'dashboard.panelN': 'Dashboard {n}',

  'dashboard.addPanel': 'Add dashboard',
  'dashboard.namePrompt': 'Dashboard name',
  'dashboard.done': 'Done',
  'dashboard.edit': 'Edit',
  'dashboard.addWidget': '+ Add widget',
  'dashboard.left': 'Left',
  'dashboard.right': 'Right',
  'dashboard.emptyPanel': 'This dashboard is empty. Click {edit} → {addWidget}.',

  /* ------------------------------------------------------------------ *
   * Training section + timeline (specs 025/032)
   * ------------------------------------------------------------------ */
  'training.overview': 'Overview',
  'training.volume': 'Volume',
  'training.tab.plan': 'Plan',
  'training.tab.goals': 'Goals',
  'training.titleWithTab': '{section} · {tab}',

  'timeline.stat.distance': 'Distance',
  'timeline.stat.pace': 'Pace',
  'timeline.stat.time': 'Time',
  'timeline.stat.avgPower': 'Avg power',
  'timeline.stat.avgSpeed': 'Avg speed',
  'timeline.stat.avgHr': 'Avg HR',
  'timeline.stat.elevation': 'Elevation gain',
  'timeline.stat.deviation': 'Deviation',
  'timeline.stat.previousRecord': 'Previous record',
  'timeline.stat.streak': 'Streak',
  'timeline.unit.days': 'days',

  'timeline.signal.long_sleep': 'Exceptionally long sleep',
  'timeline.signal.poor_sleep': 'Short sleep',
  'timeline.signal.elevated_rhr': 'Elevated resting heart rate',
  'timeline.signal.low_rhr': 'Exceptionally low resting heart rate',
  'timeline.signal.hrv_rise': 'HRV spike',
  'timeline.signal.hrv_drop': 'HRV drop',
  'timeline.signal.high_stress': 'High-stress day',
  'timeline.signal.low_stress': 'Low-stress day',
  'timeline.signal.body_battery_peak': 'Body Battery at its peak',
  'timeline.signal.body_battery_crash': 'Body Battery crash',
  'timeline.signal.metric_outlier': 'Unusual reading',
  'timeline.signal.aboveBaseline': '{label} above your usual baseline',
  'timeline.signal.belowBaseline': '{label} below your usual baseline',

  'timeline.milestone.longestDistance': 'Longest distance — {sport}',
  'timeline.milestone.longestDistanceDetail': 'Your record in this sport: {value}',
  'timeline.milestone.longestDuration': 'Longest time — {sport}',
  'timeline.milestone.longestDurationDetail': 'Your longest session in this sport: {value}',
  'timeline.milestone.newSport': 'New sport: {sport}',
  'timeline.milestone.newSportDetail': 'The first session of its kind in your history',
  'timeline.milestone.streak': {
    one: '{count} day in a row with training',
    other: '{count} days in a row with training'
  },
  'timeline.milestone.streakDetail':
    'The streak is alive — every one of those days has at least one activity',

  /* ------------------------------------------------------------------ *
   * Dashboard widgets (spec 019)
   * ------------------------------------------------------------------ */
  'widget.noActivitiesInRange': 'No activities in range: {range}.',
  'widget.noActivitiesInRangeHint':
    'No activities in range: {range}. Change the range above, or sync your data under',
  'widget.notEnoughData': 'Not enough data in range: {range}.',
  'widget.showingLastOf': 'Showing the last {shown} of {total} in range.',

  'training.sectionAriaLabel': 'Training section',

  /* ------------------------------------------------------------------ *
   * Walking page (spec 025)
   * ------------------------------------------------------------------ */
  'walking.emptyTitle': 'No walks or hikes',
  'walking.emptySubtitle': 'This page reads synced walking activities.',
  'walking.emptyBody':
    'No walks, strolls or hikes found in range: {range}. Change the range at the top of the page, ' +
    'or run a sync under',
  'walking.tile.sessions': 'Walks',
  'walking.tile.longest': 'Longest',
  'walking.tile.avgPace': 'Avg pace',
  'walking.kmTitle.week': 'Weekly distance',
  'walking.kmTitle.month': 'Monthly distance',
  'walking.kmSubtitle.week': 'Distance covered week by week',
  'walking.kmSubtitle.month': 'Distance covered month by month',
  'walking.elevationTitle.week': 'Weekly elevation gain',
  'walking.elevationTitle.month': 'Monthly elevation gain',
  'walking.elevationSubtitle.week': 'Total climbing per week',
  'walking.elevationSubtitle.month': 'Total climbing per month',
  'walking.chart.distance': 'Distance',
  'walking.longestTitle': 'Longest routes',
  'walking.longestSubtitle': 'Greatest distance in range',
  'walking.stepsTitle': 'Daily steps',
  'walking.stepsAvgSubtitle': '{steps} steps a day on average',
  'walking.stepsSubtitle': 'Daily step count',
  'walking.stepsUnit': 'steps',

  /* ------------------------------------------------------------------ *
   * Running page (specs 025/038/042/043)
   * ------------------------------------------------------------------ */
  'running.empty': 'No running activities yet. Sync your data under',
  'running.emptyTail': ', and your runs will appear here.',
  'running.rangeHeading': 'Range: {range}',
  'running.noRunsInRange':
    'No runs in this range. The personal bests and runner profile below cover your whole history.',
  'running.tile.runs': 'Runs',
  'running.tile.totalDistance': 'Total distance',
  'running.tile.longest': 'Longest',
  'running.tile.avgPace': 'Avg pace',

  'running.bests.title': 'Personal bests',
  'running.bests.subtitle':
    'The fastest predicted time for each distance (even pacing). Across your whole history.',
  'running.bests.distance': 'Distance',
  'running.bests.time': 'Time',
  'running.bests.pace': 'Pace',
  'running.bests.date': 'Date',
  'running.bests.empty': 'Not enough data to establish personal bests.',

  'running.zones.title': 'Heart-rate zones',
  'running.zones.subtitle': 'Split based on a max heart rate of {maxHr} bpm',
  'running.zones.noHr': 'No heart-rate data',
  'running.zones.ariaLabel': 'Share of time in each heart-rate zone',
  'running.zones.empty': 'No heart-rate streams in the synced runs.',

  'running.mileage.title.week': 'Weekly mileage',
  'running.mileage.title.month': 'Monthly mileage',
  'running.mileage.subtitle.week': 'Distance week by week',
  'running.mileage.subtitle.month': 'Distance month by month',

  'running.predictions.title': 'Predicted times',
  'running.predictions.subtitle':
    'Two independent methods. When they agree the number is worth something; when they diverge, that is information too.',
  'running.predictions.fromBests': 'From bests',
  'running.predictions.fromCriticalSpeed': 'From critical speed',
  'running.predictions.basedOn': 'Based on',
  'running.predictions.farExtrapolation': 'distant extrapolation',
  'running.predictions.criticalSpeedOnly': 'critical-speed model only',
  'running.predictions.note':
    '"From bests" is Riegel\'s law applied to your closest-performing distance — the further the ' +
    'extrapolation, the less it means, which is why we show its multiple and refuse to compute it at ' +
    'all beyond four times. Distances neither method has anything to say about simply do not appear. ' +
    'Neither method knows anything about fuelling, heat, or whether you have ever run the distance.',

  'running.curve.title': 'Pace curve',
  'running.curve.subtitle':
    'The best pace held for a given duration — an envelope over recent runs, not a single session',
  'running.curve.criticalPace': 'Critical pace',
  'running.curve.criticalPaceHint':
    "The pace the curve flattens towards — the fastest you can hold aerobically. Running's equivalent of FTP.",
  'running.curve.anaerobicReserve': 'Anaerobic reserve',
  'running.curve.anaerobicReserveHint':
    'How many metres you can run above critical pace before it runs out. A large value means a strong finish.',
  'running.curve.label': 'pace curve',
  'running.curve.note':
    'Lower on the chart = faster. The curve is an envelope over recent runs assuming one-second ' +
    'sampling — on a watch that records less often the short end will read too fast. This is a picture ' +
    'of training, not a test result.',

  'running.efficiency.title': 'Aerobic efficiency over time',
  'running.efficiency.subtitle':
    'Monthly averages. Rising efficiency or falling cost = better aerobic form, regardless of how hard you tried.',
  'running.efficiency.label': 'aerobic efficiency',
  'running.efficiency.seriesEf': 'Efficiency (m/min/bpm)',
  'running.efficiency.seriesCost': 'Cardiac cost (÷{scale} beats/km)',
  'running.efficiency.note':
    'Efficiency is metres per minute per heartbeat, cost is beats per kilometre — which is why one ' +
    'line should rise and the other fall. Months without runs are a gap in the line, not a zero. ' +
    'Computed from averages, so compare months of similar intensity.',

  /* ------------------------------------------------------------------ *
   * Volume page (spec 037)
   * ------------------------------------------------------------------ */
  'volume.title': 'Volume',
  'volume.empty':
    'No synced activities in recent years. After the first sync, months and a year-on-year comparison ' +
    'will appear here.',
  'volume.summaryLabel': 'Volume summary',
  'volume.measure.distance': 'Distance',
  'volume.measure.duration': 'Time',
  'volume.measure.elevation': 'Elevation gain',
  'volume.measureAriaLabel': 'Volume measure',
  'volume.tile.thisYearToDate': 'This year to date',
  'volume.tile.yearToThisDay': '{year} to this day',
  'volume.tile.wholeYear': 'All of {year}',
  'volume.tile.avgPerFullMonth': 'Average per full month',
  'volume.tile.bestMonth': 'Best month · {month}',
  'volume.yoy.title': 'Year on year',
  'volume.yoy.subtitle':
    'Cumulative kilometres. Each year measured on the same day of the season — otherwise the comparison ' +
    'would mean nothing.',
  'volume.yoy.ahead': 'Ahead of {year}',
  'volume.yoy.behind': 'Behind {year}',
  'volume.yoy.byKm': 'by {km} km on the same day of the year.',
  'volume.yoy.label': 'cumulative distance',
  'volume.monthly.title': 'Month by month',
  'volume.monthly.subtitle': 'The last {months} months, split by sport. The current month is incomplete.',
  'volume.monthly.baselineNote':
    'The reference line is the average of complete months — the current, partial month counts towards ' +
    'neither that average nor "best month".',
  'volume.grid.title': 'Consistency {year}',
  'volume.grid.subtitle':
    'Every day of the year as one square — streaks, gaps and seasonality show up here immediately, which ' +
    'no weekly chart will do',
  'volume.grid.ariaLabel': 'Training consistency',
  'volume.grid.note':
    'The shade depends on how big a day was relative to your other days, not to the biggest one — ' +
    'otherwise a single long run would wash out the whole year. A day with no activity is an empty ' +
    'square, not the palest shade.',
  'volume.months.title': 'Months',
  'volume.months.subtitle': 'The same numbers as a table, with the month in progress marked',
  'volume.months.month': 'Month',
  'volume.months.activities': 'Activities',
  'volume.months.inProgress': 'in progress',

  'training.band.fresh': 'Fresh',
  'training.band.optimal': 'Optimal',
  'training.band.neutral': 'Neutral',
  'training.band.fatigued': 'Fatigued',
  'training.band.very-fatigued': 'Very fatigued',

  'training.emptyTitle': 'No training to show',
  'training.emptySubtitle': 'This section reads synced activities.',
  'training.emptyBody': 'No activities found. Run a sync under',
  'training.emptyBodyTail': ', and cycling, running and walking will appear here automatically.',
  'training.rangeHeading': 'Range: {range}',
  'training.tile.activities': 'Activities',
  'training.other': 'Other',
  'training.split.title': 'Split by sport',
  'training.split.subtitle': 'Share of training time across the selected range',
  'training.split.ariaLabel': 'Split of training time by sport',
  'training.split.sessions': 'Sessions',
  'training.split.load': 'Load',
  'training.volume.title': 'Training volume',
  'training.volume.subtitle.week': 'Training hours per week, split by sport',
  'training.volume.subtitle.month': 'Training hours per month, split by sport',
  'training.volume.unit': 'hrs',
  'training.form.heading': 'Form',
  'training.tile.ctl': 'CTL (fitness)',
  'training.tile.atl': 'ATL (fatigue)',
  'training.tile.tsb': 'TSB (freshness)',
  'training.tile.streak': 'Streak',
  'training.streakUnit': { one: 'week', other: 'weeks' },
  'training.reco.title': 'Recommendation',
  'training.reco.subtitleFtp': 'Load from power · FTP {watts} W',
  'training.reco.subtitleHr': 'Load from Garmin data and heart rate',
  'training.reco.empty': 'The PMC needs sessions with load, power or heart rate. Run a sync under',
  'training.pmc.title': 'PMC — performance management',
  'training.pmc.subtitle': 'CTL (fitness), ATL (fatigue) and TSB (freshness) over time',

  /* ------------------------------------------------------------------ *
   * Weekly summary card — the "all sports" section (spec 089)
   * ------------------------------------------------------------------ */
  'weeklySummary.all.chip': 'Everything',
  'weeklySummary.all.subject': 'all sports',
  'weeklySummary.all.sessions': 'Sessions',
  'weeklySummary.all.noDistance':
    'No distance here: a kilometre on the bike does not add to a kilometre on foot — that total ' +
    'would mean nothing. Time, climbing and sessions do add up.',

  /* ------------------------------------------------------------------ *
   * Today's metrics dashboard (specs 006/028)
   * ------------------------------------------------------------------ */
  'dash.ariaLabel': "Today's metrics",
  'dash.today': 'Today',
  'dash.snapshotOf': 'Snapshot from {date}',
  'dash.unlockTitle': 'Unlock weekly trends',
  'dash.unlockSubtitle': 'Turn this on to see how each metric moves over time',

  /* ------------------------------------------------------------------ *
   * Pages: titles, section shells, landing/login
   * ------------------------------------------------------------------ */
  'page.dashboardTitle': 'Dashboard',
  'page.yourData': 'Your data',
  'page.activity': 'Activity',
  'page.notConnectedTitle': 'Garmin account not connected',
  'page.notConnectedCta': 'Connect in Settings →',
  'page.notConnectedBody':
    'Advanced mode is on, but we cannot see a Garmin connection. Reconnect the account in Settings.',
  'page.garminDownTitle': 'The Garmin service is temporarily unavailable',
  'page.garminDownCta': 'Check the connection →',
  'page.garminDownBody':
    'We could not reach the Garmin service, so readings may be out of date. Your data is safe — we will ' +
    'reconnect automatically.',
  'page.redirectingToSettings': 'Redirecting to settings…',

  'settings.advancedTitle': 'Advanced mode',
  'settings.advancedSubtitle':
    'Turn data processing on or off — the dashboard, analytics and insights. Turning it off returns you to basic mode.',
  'settings.featuresTitle': 'Features and consent',
  'settings.featuresSubtitle': 'Turn features on and off. Some require accepting terms first.',

  'activities.tab.list': 'List',
  'activities.tab.map': 'Map',
  'activities.sectionAriaLabel': 'Activities section',
  'activities.titleWithTab': 'Activities · {tab}',

  'login.title': 'Sign in',
  'login.subtitle': 'Connect your Garmin data to your AI tools',
  'login.note':
    'You do not need an account — signing in with Google registers you and creates your private space.',
  'landing.headTitle': 'Vagus — your Garmin data, connected to AI',

  /* ------------------------------------------------------------------ *
   * Activities list, heat map, power (specs 020/041/023)
   * ------------------------------------------------------------------ */
  'activities.routeOf': 'Route: {name}',
  'activities.search': 'Search activities',
  'activities.sortBy': 'Sort by',
  'activities.ascending': 'Ascending',
  'activities.descending': 'Descending',
  'activities.next': 'Next',
  'activities.emptyInRange':
    'No activities in range: {range} for this filter. Change the range at the top of the page, or run ' +
    'a sync under',
  'activities.empty': 'No activities for this filter. Run a sync under',

  'activities.searchPlaceholder': 'Search by name or sport…',
  'activities.searchAction': 'Search',
  'activities.sort.date': 'Date',
  'activities.view': 'View',
  'activities.view.grid': 'Grid',
  'activities.filterBySport': 'Filter by sport',
  'activities.previous': 'Previous',
  'activities.pageOf': 'Page {page} of {total}',

  'heatmap.withGpsTrack': 'With a GPS track',
  'heatmap.empty': 'No GPS tracks for this filter. Run a sync under',
  'heatmap.mapLabel': 'Route heat map',

  'power.emptyTitle': 'No power data',
  'power.emptySubtitle': 'The power profile needs activities recorded with a power meter.',
  'power.emptyBody': 'No power streams found. Run a sync under',
  'power.ftpFromSettings': 'from settings',
  'power.recordsTitle': 'Power records (all-time)',
  'power.recordsSubtitle': 'The best average power for each duration',
  'power.compareTitle': 'Power curve comparison (by year)',
  'power.compareSubtitle':
    'X axis: effort duration · Y axis: best average power. Click a year in the legend to hide it.',
  'power.tableCaption': 'Best power (W) for selected durations, by year',

  /* ------------------------------------------------------------------ *
   * Timeline card (specs 022/032)
   * ------------------------------------------------------------------ */
  'timelineView.today': 'today',
  'timelineView.yesterday': 'yesterday',

  'timelineView.title': 'Timeline',
  'timelineView.subtitle': 'The last {past} days and the next {future}',
  'timelineView.orientation': 'Timeline layout',
  'timelineView.vertical': 'Vertical',
  'timelineView.horizontal': 'Horizontal',
  'timelineView.notConnected': 'Connect your Garmin account to see your timeline.',
  'timelineView.connectCta': 'Connect in Settings →',
  'timelineView.notEnabled': 'The timeline uses your synced data. Turn on advanced mode to run it.',
  'timelineView.notEnoughData': 'Not enough data — sync your watch and come back shortly.',
  'timelineView.emptyPast':
    'No events in the last {days} days. Once you sync a session or an unusual reading shows up, it will appear here.',
  'timelineView.axisAriaLabel': 'Timeline — the last {days} days, scrolls horizontally',
  'timelineView.pastHeading': 'What happened',
  'timelineView.noPlanned': 'No planned sessions',
  'timelineView.noPlannedBody': 'Nothing in your Garmin calendar for the next {days} days.',
  'timelineView.plannedNotSynced': 'Planned sessions are not synced yet',
  'timelineView.plannedNotSyncedBody':
    'We do not fetch the training calendar from Garmin yet, so we show nothing here rather than guess ' +
    'what you have planned. Once plan syncing ships, this space fills itself.',
  'timelineView.showPrimary': 'Show only the highlights',
  'timelineView.showAll': 'Show all events ({count})',
  'timelineView.push.pending': 'to send',
  'timelineView.push.pushed': 'on Garmin',
  'timelineView.push.failed': 'send failed',
  'timelineView.push.unsupported': 'unsupported',

  /* ------------------------------------------------------------------ *
   * Activity detail + insights (specs 026/010)
   * ------------------------------------------------------------------ */
  'detail.backToActivities': '← Activities',
  'detail.tile.avgPace': 'Average pace',
  'detail.tile.avgSpeed': 'Average speed',
  'detail.tile.avgHr': 'Average heart rate',
  'detail.tile.avgPower': 'Average power',
  'detail.tile.load': 'Load',
  'detail.streamsSubtitle': 'The watch recording — click to pin the same moment on every chart',
  'detail.detailsTitle': 'Details',
  'detail.detailsSubtitle': 'Everything Garmin recorded for this activity',
  'detail.noDetails':
    'This activity has no detailed data yet. {dash} usually means the watch did not record it.',

  'insights.strength.moderate': 'moderate',
  'insights.strength.strong': 'strong',
  'insights.stat.range': 'Range',
  'insights.stat.total': 'Total',
  'insights.stat.best': 'Best',
  'insights.stat.daysWithData': 'Days with data',
  'insights.periodSubtitle': '{start} – {end} · {days} days',

  'insights.trends': 'Trends',
  'insights.anomalies': 'Anomalies',
  'insights.correlations': 'Correlations',
  'insights.anomalyTitleHigh': '{label}: unusually high {date}',
  'insights.anomalyTitleLow': '{label}: unusually low {date}',
  'insights.anomalyBody': 'Reading {value} — {sd} SD from your {days}-day baseline ({severity} deviation).',
  'insights.correlationMeta': 'r = {r} · {days} days',

  /* ------------------------------------------------------------------ *
   * Spec 087 — the predicted race time, day by day
   * ------------------------------------------------------------------ */
  'predHistory.title': 'Prediction history',
  'predHistory.subtitle':
    'How the predicted time moved day by day — recomputed from the records that stood on each day',
  'predHistory.filterLabel': 'Distance',
  'predHistory.chartLabel': 'predicted time',
  'predHistory.netHeading': 'Change over this range',
  'predHistory.netFaster': '{value} faster than at the start of the range.',
  'predHistory.netSlower': '{value} slower than at the start of the range.',
  'predHistory.netFlat': 'Unchanged — the record this prediction rests on has not moved in this range.',
  'predHistory.netUnknown': 'Too few days with a basis in this range to call it a change.',
  'predHistory.note':
    'Every point is the same prediction as the card above, recomputed from the records that stood that day — not an interpolation between them. The line is flat between records because the best effort is too. This is the Riegel model over your measured efforts only; critical speed is not in it, so the numbers can differ from the card above. A day with no basis is a gap, not a zero.',

  'widget.streakUnit': { one: 'week streak', other: 'week streak' },
  'readiness.band.low': 'Low',
  'readiness.band.moderate': 'Moderate',
  'readiness.band.high': 'High',
  'readiness.band.peak': 'Peak',

  // Spec 084: the score's own limits, its forecast, and the honest refusals.
  'readiness.limit.recovery': 'Recovery timer',
  'readiness.limit.hrv': 'HRV out of range',
  'readiness.limit.load': 'Training load',
  'readiness.limitedBy': 'The channels alone give {composite}, but {limit} caps the score at {score}.',
  'readiness.limitedByMany': 'The channels alone give {composite}, but {limits} cap the score at {score}.',
  'readiness.limitJoin': ' and ',
  'readiness.channelsAriaLabel': 'Readiness channels',
  'readiness.limitsAriaLabel': 'What is capping readiness',
  'readiness.derived': 'computed here',
  'readiness.derivedNote':
    'Garmin published no factors today, so these channels are computed from the raw data.',
  'readiness.fullyReadyToday': 'Nothing is holding you back today',
  'readiness.fullyReadyOn': 'Fully ready: {day}',
  'readiness.fullyReadyUnknown': "When you'll be fully ready — we can't say yet",
  'readiness.recoveredAt': 'The recovery timer reaches zero {when}',
  'readiness.clearsOn': 'clears {day}',
  'readiness.clearsAt': 'clears {when}',
  'readiness.clearsUnknown': 'no projection',
  'readiness.hrvProjection': 'assuming nights around {nightly} ms',
  'readiness.garminReference': 'Garmin: {score}',
  'readiness.explainTitle': 'Where this number comes from',
  'readiness.explainBody':
    'The score answers "how ready am I to train today". It is built from absolute inputs — last night\'s sleep score, the live recovery timer, HRV against your own balanced range, training load and stress history — not from how far today sits from a 30-day average.',
  'readiness.explainLimits':
    'The channels are a weighted mean, but any input that on its own says "do not train hard today" imposes a ceiling and pins the score instead of being averaged away. A good night\'s sleep does not discharge a 61-hour recovery debt.',
  'readiness.explainBands': 'Bands: below 40 low, 40–59 moderate, 60–79 high, 80 and up peak.',
  'readiness.explainDisclaimer': 'A consumer wellness signal, not a medical diagnosis.',
  'readiness.explainGarmin':
    'Garmin gets the same factors but combines them with its own undisclosed formula, so the two numbers can still differ. We are not trying to reproduce its score — we want one that can be read line by line.',

  'readiness.title': 'Readiness',
  'readiness.subtitle': 'How ready you are to train today, and when you will be back at full strength',
  'readiness.notConnected': 'Connect your Garmin account to see your readiness.',
  'readiness.connectCta': 'Connect on the dashboard →',
  'readiness.notEnabled': 'Readiness uses your multi-day metrics. Turn on advanced mode to run it.',
  'readiness.notEnoughData': 'Not enough data — sync your watch and come back in a few days.',
  'readiness.driversAriaLabel': 'Readiness drivers',

  /* ------------------------------------------------------------------ *
   * Planned vs actual (spec 085)
   * ------------------------------------------------------------------ */
  'plan.title': 'Planned vs actual',
  'plan.subtitle': 'What was asked for, what happened, and what to change next time',
  'plan.origin.authored': 'Your plan',
  'plan.origin.garmin': 'Garmin plan',
  'plan.kind.race': 'Race',
  'plan.kind.note': 'Note',
  'plan.compliance': 'of the plan met',
  'plan.complianceAriaLabel': 'Plan adherence',
  'plan.noTargets': 'This calendar entry sets no measurable target to compare against.',
  'plan.tableCaption': 'Plan targets against what was done',
  'plan.col.metric': 'Target',
  'plan.col.target': 'Planned',
  'plan.col.actual': 'Actual',
  'plan.col.met': 'Verdict',
  'plan.met.yes': 'On plan',
  'plan.met.no': 'Off plan',
  'plan.met.unknown': 'Not recorded',
  'plan.step.duration': 'Time',
  'plan.step.distance': 'Distance',
  'plan.step.load': 'Load',
  'plan.step.pace': 'Pace',
  'plan.step.power': 'Power',
  'plan.step.hr': 'Heart rate',
  'plan.rangeFrom': 'from {value}',
  'plan.rangeTo': 'up to {value}',
  'plan.takeawaysTitle': 'For next time',
  'plan.takeaway.over': '{metric} came in {pct}% above plan — next time hold to what was written.',
  'plan.takeaway.under': '{metric} came in {pct}% below plan — next time finish the session as planned.',
  'plan.takeaway.harder':
    'The session ran {pct}% harder than the plan asked for ({metric}) — next time stay inside the planned range.',
  'plan.takeaway.easier':
    'The session ran {pct}% easier than the plan asked for ({metric}) — next time stay inside the planned range.',
  'plan.strip.title': 'Planned structure',
  'plan.strip.ariaLabel': 'Planned session structure on the elapsed-time axis',
  'plan.strip.note': 'Planned blocks on the same time axis as the charts below.',
  'plan.stepKind.warmup': 'Warm-up',
  'plan.stepKind.work': 'Work',
  'plan.stepKind.recovery': 'Recovery',
  'plan.stepKind.rest': 'Rest',
  'plan.stepKind.cooldown': 'Cool-down',
  'plan.stepRepeat': '{kind} {index}/{total}',
  'plan.stepMarkerLap': '{kind} — until the lap button',
  'plan.stepMarkerCalories': '{kind} — until calories burned',

  /* ------------------------------------------------------------------ *
   * Which lap was which planned step (spec 091)
   * ------------------------------------------------------------------ */
  'plan.stepNth': '{kind} {index}',
  'plan.source.perStep':
    'Intensity measured from the laps aligned to each planned step — every rep judged on its own.',
  'plan.source.average':
    'The laps could not be reconciled with the plan, so intensity is the whole session average. On an interval session that average sits between the work band and the recovery.',
  'plan.strip.executedLabel': 'Executed',
  'plan.strip.executedAriaLabel': 'Executed extent of the planned steps on the elapsed-time axis',
  'error.activityNotFound': 'Activity not found',
  'error.tooManyAttempts': 'Too many attempts. Wait a moment and try again.',
  'auth.missingCode': 'Missing authorization code.',

  'auth.sessionExpired': 'Your sign-in session expired. Please try again.',
  'auth.invalidState': 'Invalid sign-in state. Please try again.',
  'auth.verificationFailed': 'Could not verify the Google sign-in.',

  'insights.subtitle': 'Readiness, trends, anomalies and correlations from your own metrics',
  'insights.connectTitle': 'Connect Garmin to see insights',
  'insights.connectSubtitle': 'Insights need a connected Garmin account.',
  'insights.connectCta': 'Connect on the dashboard →',
  'insights.enableTitle': 'Turn on advanced mode',
  'insights.enableSubtitle': 'Insights are built from your multi-day metrics.',
  'insights.notEnoughTrends': 'Not enough data to show trends.',
  'insights.nothingUnusualTitle': 'Nothing unusual',
  'insights.nothingUnusualBody': 'Nothing unusual — your metrics are steady.',
  'insights.noCorrelations': 'No meaningful correlations — they will appear once we have more days.',
  'insights.chartsAriaLabel': 'Long-range charts',
  'insights.metricsHeading': 'Metrics — {range}',
  'insights.stat.average': 'Average',
  'insights.stat.worst': 'Weakest',
  'insights.strength.weak': 'weak',

  /* ------------------------------------------------------------------ *
   * Where the intensity zones come from (spec 086)
   * ------------------------------------------------------------------ */
  'zones.explainLabel': 'Where do these zones come from?',
  'zones.explainTitle': 'Where these zones come from',
  'zones.hrGarmin':
    'Heart rate: these are your own zones, configured in Garmin Connect — we do not define them here. Garmin sends only the time spent in each one, never the boundaries in beats per minute, which is why the bars can say no more than "Zone 1–5".',
  'zones.hrEstimatedIntro':
    'Heart rate: Garmin sent no time-in-zone for this activity, so we split the heart-rate trace ourselves, by percentage of maximum heart rate:',
  'zones.hrBand': 'Zone {zone} — {range} of maximum heart rate',
  'zones.hrEstimatedMax':
    'The maximum we use is the highest heart rate recorded in this session, not a figure from your profile. So the top zone is all but guaranteed, and the whole split is only as good as that assumption.',
  'zones.powerIntro': 'Power: these zones are always ours — the Coggan Z1–Z7 model as a percentage of FTP:',
  'zones.powerBand': '{name} · {range} of FTP — {use}',
  'zones.power.z1.name': 'Z1 active recovery',
  'zones.power.z1.use': 'spinning the legs out, barely an effort',
  'zones.power.z2.name': 'Z2 endurance',
  'zones.power.z2.use': 'aerobic base, long steady hours',
  'zones.power.z3.name': 'Z3 tempo',
  'zones.power.z3.use': 'firm continuous riding — fast, but not yet painful',
  'zones.power.z4.name': 'Z4 threshold',
  'zones.power.z4.use': 'work around FTP, raises the lactate threshold',
  'zones.power.z5.name': 'Z5 VO2max',
  'zones.power.z5.use': 'three to eight minute intervals, aerobic ceiling',
  'zones.power.z6.name': 'Z6 anaerobic',
  'zones.power.z6.use': 'efforts of thirty seconds to three minutes, anaerobic capacity',
  'zones.power.z7.name': 'Z7 neuromuscular',
  'zones.power.z7.use': 'sprints up to fifteen seconds, maximum power',
  'zones.ftpConfigured': 'The percentages are taken from the {ftp} W FTP saved in your settings.',
  'zones.ftpEstimated':
    "You have no FTP saved, so we take 95% of this session's best 20-minute power: {ftp} W. Everything derived from it — zones, IF, TSS — moves with that estimate.",
  'zones.ftpNoSettings':
    'There is no screen in the app today for saving an FTP, a maximum heart rate or a body weight, so in practice what you are looking at is always the estimate.',

  /* ------------------------------------------------------------------ *
   * Data page: coverage, sync run detail, diagnostics (spec 019)
   * ------------------------------------------------------------------ */
  'data.phase.activities': 'Activities',
  'data.phase.streams': 'Routes / streams',
  'data.phase.weight': 'Weight',
  'data.phase.planned': 'Training plan',
  'data.phase.workoutPush': 'Workout push',
  'data.phase.metrics': 'Daily metrics',
  'data.summary.activities': '{count} activities ({pages} pages)',
  'data.summary.streams': '{count} fetched',
  'data.summary.weight': '{count} readings',
  'data.summary.planned': '{count} planned',
  'data.summary.plannedUnavailable': 'calendar unavailable on Garmin',
  'data.summary.pushed': '{count} sent',
  'data.summary.pending': '{count} queued',
  'data.summary.unsupported': '{count} unsupported',
  'data.summary.metrics': '{count} days with data (from {from})',

  'data.filter.problems': 'Problems',
  'data.filter.errorsOnly': 'Errors only',
  'data.phaseName.start': 'start',
  'data.phaseName.activities': 'activities',
  'data.phaseName.streams': 'routes',
  'data.phaseName.weight': 'weight',
  'data.phaseName.planned': 'plan',
  'data.phaseName.workoutPush': 'workout push',
  'data.phaseName.metrics': 'metrics',
  'data.phaseName.done': 'done',
  'data.code.rate_limited': 'rate limited',
  'data.code.token_rejected': 'token expired',
  'data.code.not_connected': 'not connected',
  'data.code.sidecar_unreachable': 'service down',
  'data.code.timeout': 'timed out',
  'data.code.blocked': 'blocked',
  'data.code.not_found': 'endpoint missing',
  'data.code.bad_response': 'bad response',
  'data.code.upstream_error': 'Garmin error',
  'data.code.unsupported': 'unavailable in this mode',

  'data.notConnected': 'Your Garmin account is not connected. Connect it in',
  'data.notConnectedTail': ' to sync data.',
  'data.settingsLink': 'Settings',
  'data.refreshPrompt': 'Signed in. Refresh your Garmin data now?',
  'data.runFailed': 'failed',
  'data.fullSync': 'Full sync',
  'data.backfillTo': 'Backfilling history: reached back to',
  'data.backfillRemaining': '· ~{days} days left (to {target})',
  'data.backfillContinues': '· backfilling continues on subsequent syncs.',
  'data.needsAction': ' · needs action',
  'data.logEmptyForFilter': 'No entries for the selected filter.',
  'data.sidecarLogTitle': 'Garmin service log (Python)',
  'data.sidecarLogNote':
    'Detail from the service that talks to Garmin — the exact reason a request was rejected.',
  'data.sidecarRefresh': 'Refresh log',
  'data.sidecarFetch': 'Fetch log',
  'data.sidecarUnavailable': 'Log unavailable: {reason}.',
  'data.sidecarEmpty': 'No entries — the service recorded nothing for this account.',
  'data.tile.totalDistance': 'Total distance',
  'data.storageLine':
    'Stored: {metricDays} days of metrics · {activities} activities ({withGps} with GPS) · {streams} route streams · {weight} weight readings',
  'data.coverageNote': 'The span of days synced locally for each metric.',
  'data.coverageEmpty': 'No data. Run a full sync to fetch your history.',

  /* ------------------------------------------------------------------ *
   * Landing page (logged out)
   * ------------------------------------------------------------------ */
  'landing.selfHostNav': 'Self-host',
  'landing.continueWithGoogle': 'Continue with Google',
  'landing.orSelfHost': 'or self-host it →',
  'landing.tier.baseTitle': 'Basic mode',
  'landing.tier.advancedTitle': 'Advanced mode',
  'landing.howTitle': 'Three steps to your data',
  'landing.step.useTitle': 'Read it anywhere',
  'landing.dockerLabel': 'Run it in Docker',
  'landing.dockerComment': '# set your secrets',
  'landing.dockerComment2': '# web + sidecar + postgres',
  'landing.finalHeading': 'Ready whenever you are.',
  'landing.footNote': 'Your Garmin data — for you and your AI.',
  'landing.preview.steps': 'steps',
  'landing.preview.hrv': 'hrv',

  'landing.howItWorks': 'How it works',
  'landing.signIn': 'Sign in',
  'landing.eyebrow': 'Telemetry for your body',
  'landing.headlineLead': 'Your Garmin data,',
  'landing.headlineAccent': 'connected to AI.',
  'landing.lede':
    'Vagus connects your Garmin Connect account to an AI assistant through a personal MCP address. ' +
    'Start in basic mode — we process nothing — and turn on advanced mode with a dashboard and ' +
    'analytics whenever you want to.',
  'landing.noPassword': 'No password. Your data stays yours — separate per account, by consent, never sold.',
  'landing.previewToday': 'Today',
  'landing.previewLive': 'live',
  'landing.tier.baseBody':
    'Connect your Garmin account and get a personal MCP address. We process and display nothing — we ' +
    'only relay readings when you ask for them. Sleep, steps, HRV, Body Battery, stress, SpO₂ and more ' +
    '— always yours. There is exactly one write back to Garmin and you enable it separately: the ' +
    'workouts you author yourself.',
  'landing.tier.advancedBody':
    'Once you accept the terms you unlock the dashboard, analytics, insights and charts. Your data is ' +
    'shown in the app, and readiness, anomalies and correlations are computed locally — no AI involved.',
  'landing.privacyTitle': 'Privacy as standard',
  'landing.privacyBody':
    'Every account is isolated. Tokens are encrypted, and advanced mode is optional and gated by ' +
    'versioned consent. Nothing is sold or shared.',
  'landing.step.googleTitle': 'Sign in with Google',
  'landing.step.googleBody': 'No password. We create a private space just for you.',
  'landing.step.garminTitle': 'Connect Garmin',
  'landing.step.garminBody':
    'A one-time sign-in (MFA supported). We never store your credentials — only encrypted tokens.',
  'landing.step.useBody':
    'Turn on advanced mode to see the dashboard, or give the MCP address to your AI assistant so it can ' +
    'read your data.',
  'landing.selfHostTitle': 'Would you rather run it yourself?',
  'landing.selfHostBody':
    'Vagus can be self-hosted. Point it at your own Postgres and Google OAuth client — the whole thing ' +
    'runs as two small containers on your hardware, and the data never leaves your infrastructure.',
  'landing.selfHostNote': 'Self-hosting requires a Google OAuth client and a Postgres instance.',

  /* ------------------------------------------------------------------ *
   * Base-tier start screen
   * ------------------------------------------------------------------ */
  'baseHome.eyebrowBase': 'Basic mode',
  'baseHome.eyebrowActive': 'Basic mode is active',
  'baseHome.advanceTitle': 'Unlock advanced mode',

  'baseHome.perk.dashboard': "Dashboard — today's readiness and the headline metrics at a glance.",
  'baseHome.perk.analytics': 'Analytics — multi-day trends and statistics for every metric.',
  'baseHome.perk.insights': 'Insights — readiness, anomalies and correlations computed locally, no AI.',
  'baseHome.perk.range': 'One range switch — 7, 14, 30 days, a year or all time, on every page.',
  'baseHome.onboardTitle': 'Connect Garmin and you are done',
  'baseHome.onboardLede':
    'In basic mode you connect your Garmin account and get a personal MCP address for your AI ' +
    'assistant. {emphasis} — we only relay readings when you ask for them.',
  'baseHome.onboardEmphasis': 'We process and store nothing',
  'baseHome.step.signIn': 'Sign in with your Garmin details — used once, to fetch access tokens.',
  'baseHome.step.tokens': 'We store only encrypted tokens. Your password is never kept.',
  'baseHome.step.mcp': 'Your personal MCP address goes live — copy it from',
  'baseHome.step.mcpTail': 'into your AI client.',
  'baseHome.settingsLink': 'Settings',
  'baseHome.connectTitle': 'Connect your Garmin account',
  'baseHome.garminDownTitle': 'The Garmin service is temporarily unavailable',
  'baseHome.garminDownBody':
    'We could not reach the Garmin service. Your data is safe — we will retry automatically.',
  'baseHome.advanceLede':
    'Nothing is processed yet — you have a Garmin connection and your MCP address. Turn on advanced ' +
    'mode to see your data in the app:',
  'baseHome.advanceNote':
    'Processing happens inside your session; data is neither sold nor sent onward. You can withdraw ' +
    'consent at any time and return to basic mode.',
  'baseHome.consentUnavailable': 'The consent panel is temporarily unavailable.',
  'baseHome.mcpCardTitle': 'MCP address and connection',
  'baseHome.mcpCardSubtitle': 'Your Garmin account status and personal MCP address live in Settings.',
  'baseHome.openSettings': 'Open settings →',

  /* ------------------------------------------------------------------ *
   * Garmin Training Readiness (spec 059)
   * ------------------------------------------------------------------ */
  'garminReadiness.factor.sleep': 'Sleep',
  'garminReadiness.factor.sleep_history': 'Sleep history',
  'garminReadiness.factor.hrv': 'HRV',
  'garminReadiness.factor.recovery': 'Recovery',
  'garminReadiness.factor.load': 'Load',
  'garminReadiness.factor.stress': 'Stress history',
  'garminReadiness.change.decreased': 'shorter than yesterday',
  'garminReadiness.change.increased': 'longer than yesterday',
  'garminReadiness.change.none': 'unchanged',
  'garminReadiness.change.noChangeSleep': 'unchanged after sleep',
  'garminReadiness.change.noChangeActivity': 'unchanged after training',
  'garminReadiness.change.decreasedSleep': 'shorter after sleep',
  'garminReadiness.change.decreasedActivity': 'shorter after training',
  'garminReadiness.change.increasedActivity': 'longer after training',

  'garminReadiness.head.prime': 'Garmin: peak readiness',
  'garminReadiness.head.high': 'Garmin: high readiness',
  'garminReadiness.head.moderate': 'Garmin: moderate readiness',
  'garminReadiness.head.low': 'Garmin: low readiness',
  'garminReadiness.head.poor': 'Garmin: very low readiness',
  'garminReadiness.head.unknown': 'Garmin: readiness not scored',
  'garminReadiness.level.prime': 'Peak',
  'garminReadiness.level.high': 'High',
  'garminReadiness.level.moderate': 'Moderate',
  'garminReadiness.level.low': 'Low',
  'garminReadiness.level.poor': 'Very low',
  'garminReadiness.level.unknown': 'Not scored',

  'garminReadiness.stale': 'out of date',
  'garminReadiness.dataFrom': 'data from {day}',
  'garminReadiness.recovered': 'recovery complete',
  'garminReadiness.recoveryIn': '{time} to full recovery',
  'garminReadiness.recoveryInStale': '{time} to full recovery (as of that day)',

  /* ------------------------------------------------------------------ *
   * Condition / regeneration sentence (spec 022)
   * ------------------------------------------------------------------ */
  'condition.head.rested': 'You are well rested',
  'condition.head.steady': 'Recovery is on track',
  'condition.head.strained': 'Your body is under strain',
  'condition.head.unknown': 'Not enough data to judge recovery',
  'condition.unknownTail': 'sync your watch for a few days and we will work out the rest.',
  'condition.sleepClause': 'sleep {duration}',

  'condition.recoveryEndToday': 'today {time}',
  'condition.recoveryEndTomorrow': 'tomorrow {time}',
  'condition.recoveryEndOn': '{day}, {time}',

  'condition.aboveBaseline': 'above baseline',
  'condition.belowBaseline': 'below baseline',
  'condition.dataFrom': 'data from {day}',

  /* ------------------------------------------------------------------ *
   * Sport families
   * ------------------------------------------------------------------ */
  'sportGroup.ride': 'Cycling',
  'sportGroup.run': 'Running',
  'sportGroup.walk': 'Walking',
  'sportGroup.swim': 'Swimming',
  'sportGroup.strength': 'Strength',
  'sportGroup.other': 'Other',

  /* ------------------------------------------------------------------ *
   * Sports — keys are Garmin `activityType.typeKey` values (spec 020)
   * ------------------------------------------------------------------ */
  'sport.cycling': 'Cycling',
  'sport.road_biking': 'Road cycling',
  'sport.mountain_biking': 'Mountain biking',
  'sport.gravel_cycling': 'Gravel',
  'sport.cyclocross': 'Cyclocross',
  'sport.downhill_biking': 'Downhill biking',
  'sport.virtual_ride': 'Virtual ride',
  'sport.indoor_cycling': 'Indoor cycling',
  'sport.track_cycling': 'Track cycling',
  'sport.bmx': 'BMX',
  'sport.recumbent_cycling': 'Recumbent cycling',
  'sport.handcycling': 'Handcycling',
  'sport.indoor_handcycling': 'Indoor handcycling',
  'sport.e_bike_fitness': 'E-bike',
  'sport.e_bike_mountain': 'E-mountain bike',
  'sport.ebikeride': 'E-bike',

  'sport.running': 'Run',
  'sport.trail_running': 'Trail run',
  'sport.street_running': 'Street run',
  'sport.track_running': 'Track run',
  'sport.treadmill_running': 'Treadmill',
  'sport.indoor_running': 'Indoor run',
  'sport.virtual_run': 'Virtual run',
  'sport.obstacle_run': 'Obstacle run',
  'sport.ultra_run': 'Ultra run',

  'sport.swimming': 'Swimming',
  'sport.lap_swimming': 'Swimming (pool)',
  'sport.open_water_swimming': 'Swimming (open water)',

  'sport.walking': 'Walk',
  'sport.casual_walking': 'Stroll',
  'sport.speed_walking': 'Power walk',
  'sport.indoor_walking': 'Indoor walk',
  'sport.hiking': 'Hiking',
  'sport.rucking': 'Rucking',
  'sport.mountaineering': 'Mountaineering',

  'sport.strength_training': 'Strength training',
  'sport.functional_strength': 'Functional strength',
  'sport.indoor_cardio': 'Cardio',
  'sport.cardio_training': 'Cardio',
  'sport.hiit': 'HIIT',
  'sport.pilates': 'Pilates',
  'sport.elliptical': 'Elliptical',
  'sport.stair_climbing': 'Stair climber',
  'sport.indoor_rowing': 'Rowing (ergometer)',

  'sport.yoga': 'Yoga',
  'sport.breathwork': 'Breathwork',
  'sport.meditation': 'Meditation',
  'sport.stretching': 'Stretching',
  'sport.rowing': 'Rowing',
  'sport.kayaking': 'Kayaking',
  'sport.canoeing': 'Canoeing',
  'sport.stand_up_paddleboarding': 'Paddleboarding',
  'sport.whitewater_rafting': 'Rafting',
  'sport.sailing': 'Sailing',
  'sport.surfing': 'Surfing',
  'sport.windsurfing': 'Windsurfing',
  'sport.kitesurfing': 'Kitesurfing',
  'sport.inline_skating': 'Inline skating',
  'sport.skateboarding': 'Skateboarding',
  'sport.ice_skating': 'Ice skating',
  'sport.skate_skiing': 'Skate skiing',
  'sport.cross_country_skiing': 'Cross-country skiing',
  'sport.cross_country_skiing_ws': 'Cross-country skiing',
  'sport.backcountry_skiing': 'Ski touring',
  'sport.resort_skiing': 'Downhill skiing',
  'sport.resort_skiing_snowboarding_ws': 'Skiing / snowboarding',
  'sport.snowboarding': 'Snowboarding',
  'sport.snowshoeing': 'Snowshoeing',
  'sport.snowmobiling': 'Snowmobiling',
  'sport.rock_climbing': 'Rock climbing',
  'sport.indoor_climbing': 'Indoor climbing',
  'sport.bouldering': 'Bouldering',
  'sport.tennis': 'Tennis',
  'sport.table_tennis': 'Table tennis',
  'sport.padel': 'Padel',
  'sport.squash': 'Squash',
  'sport.badminton': 'Badminton',
  'sport.soccer': 'Football',
  'sport.basketball': 'Basketball',
  'sport.volleyball': 'Volleyball',
  'sport.golf': 'Golf',
  'sport.boxing': 'Boxing',
  'sport.horseback_riding': 'Horse riding',
  'sport.fishing': 'Fishing',
  'sport.hunting': 'Hunting',
  'sport.triathlon': 'Triathlon',
  'sport.multi_sport': 'Multisport',
  'sport.transition': 'Transition',
  'sport.winter_sports': 'Winter sports',
  'sport.other': 'Other'
};
