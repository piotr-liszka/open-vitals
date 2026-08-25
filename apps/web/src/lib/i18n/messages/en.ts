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
  'metric.training_readiness': 'Readiness (Garmin)',

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
  'connection.fullSubtitle':
    'The source of every data point in this app. We never store your sign-in — only the encrypted tokens Garmin returns.',

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
  'mcp.copied': 'Copied the MCP address to the clipboard.',
  'mcp.urlAriaLabel': 'MCP address',
  'mcp.infoLabel': 'What is this address?',

  /* ------------------------------------------------------------------ *
   * Athlete profile: FTP, maximum heart rate, body weight (spec 090)
   * ------------------------------------------------------------------ */
  'profile.section': 'Athlete',
  'settings.integrationsSection': 'Integrations',
  'settings.appSection': 'App',
  'settings.accountSection': 'My account',
  'profile.title': 'Profile',
  'profile.subtitle': 'The three numbers the rest is measured against',
  'profile.intro':
    'Every field may be left empty — we then estimate the value from the training itself. A saved number replaces that estimate.',
  'profile.ftp.label': 'FTP (W)',
  'profile.ftp.help': 'Used for IF, TSS and the power zones.',
  'profile.ftp.empty':
    "Estimated for now: 95% of each session's best 20-minute power, so the threshold moves with every ride.",
  'profile.maxHr.label': 'Maximum heart rate (bpm)',
  'profile.maxHr.help': 'Used for the heart-rate zone split and the training-load model.',
  'profile.maxHr.empty':
    "Estimated for now: the maximum is the session's own highest reading, so the top zone is all but guaranteed.",
  'profile.weight.label': 'Body weight (kg)',
  'profile.weight.help': 'Used for the W/kg column of the best-power table.',
  'profile.weight.empty': 'Empty for now: the W/kg column does not appear at all.',
  'profile.placeholder': 'Estimated',
  'profile.saved': 'Profile saved.',
  'profile.saveFailed': 'Could not save the profile.',
  'profile.networkError': 'Could not reach the server. Please try again.',
  'profile.error.number': 'Enter a number.',
  'profile.error.range': 'Enter a value between {min} and {max}.',

  /* ------------------------------------------------------------------ *
   * Workout planner vocabulary (specs 066/081) — steps, targets, completion
   * ------------------------------------------------------------------ */
  'workout.stepKind.repeat': 'Repeat',
  'workout.durationType.lap': 'Lap button',
  'workout.durationValueLabel.time': 'Seconds',
  'workout.durationValueLabel.distance': 'Metres',
  'workout.durationValueLabel.lap': 'Value',
  'workout.target.none': 'No target',
  'workout.target.speed': 'Speed',
  'workout.target.cadence': 'Cadence',
  'workout.lapEnd': 'to the lap button',
  'workout.completionBadge.done': 'Done',
  'workout.completionBadge.shortened': 'Shortened',
  'workout.adherencePct': '{pct}% of plan',
  'workout.dayShift.later': 'done {days} later',
  'workout.dayShift.earlier': 'done {days} earlier',
  'workout.matchedHeuristic': 'matched approximately — by day and distance',
  'workout.editor.nameLabel': 'Name',
  'workout.editor.namePlaceholder': 'e.g. Intervals 5×1 km',
  'workout.editor.sportLabel': 'Sport',
  'workout.editor.timeLabel': 'Time',
  'workout.editor.timeHelp': 'Empty = any time that day',
  'workout.editor.libraryScopeNote':
    'Changes apply to the library only. Sessions already scheduled on the calendar are unaffected.',
  'workout.editor.stepsHeading': 'Steps',
  'workout.editor.stepKindAriaLabel': 'Step kind',
  'workout.editor.repeatsLabel': 'Repeats',
  'workout.editor.durationTypeAriaLabel': 'End step after',
  'workout.editor.targetAriaLabel': 'Target',
  'workout.editor.targetLowAriaLabel': 'Target from',
  'workout.editor.targetHighAriaLabel': 'Target to',
  'workout.editor.moveUp': 'Move up',
  'workout.editor.moveDown': 'Move down',
  'workout.editor.removeStep': 'Remove step',
  'workout.editor.addStepInBlock': '+ Step in block',
  'workout.editor.addStep': '+ Step',
  'workout.editor.addRepeat': '+ Repeat',
  'workout.editor.noteLabel': 'Note',
  'workout.editor.notePlaceholder': 'Optional session description',
  'workout.editor.noteHint': 'The note goes into the session description in Garmin Connect.',
  'workout.editor.notSaved': 'Not saved',
  'workout.editor.saving': 'Saving…',
  'workout.editor.saveChanges': 'Save changes',
  'workout.editor.addWorkout': 'Add workout',
  'workout.saveFailed': "Couldn't save the workout.",
  'workout.deleteFailed': "Couldn't delete the workout.",
  'workout.scheduleFailed': "Couldn't schedule the workout.",
  'workout.library.saved': 'Saved in the library',
  'workout.library.added': 'Added to the library',
  'workout.library.removed': 'Removed from the library',
  'workout.scheduledToast': 'Scheduled "{title}" for {date}',
  'workout.saved': 'Changes saved',
  'workout.added': 'Workout added',
  'workout.pushFailed': "Couldn't send the workout",
  'workout.pushedToast': 'Sent "{title}" to Garmin',
  'workout.pushRejected': 'Garmin rejected this workout',
  'workout.deletedToast': 'Workout deleted',
  'workout.pushState.pending': 'Queued',
  'workout.pushState.pushed': 'On the watch',
  'workout.pushState.failed': 'Send failed',
  'workout.pushState.unsupported': 'Unsupported',
  'workout.addButton': '+ Workout',
  'workout.readOnlyTitle': 'Read-only mode',
  'workout.readOnlyBody':
    'Workout writing is turned off. Turn on "Write workouts to Garmin" on the Garmin card in',
  'workout.readOnlyBodyTail': ' to add and edit sessions here.',
  'workout.emptyDay': 'Nothing planned for this day.',
  'workout.emptyDayHint': ' Add one with the button above, or through the assistant (MCP).',
  'workout.onGarmin': 'On Garmin',
  'workout.pushing': 'Sending…',
  'workout.pushNow': 'Send to Garmin',
  'workout.pushAgain': 'Send again',
  'workout.staleOnGarmin': 'Garmin may still have an older version',
  'workout.fromCalendar': 'From calendar',
  'workout.fromGarminBadge': 'From Garmin',
  'workout.syncedBackBadge': 'Synced',
  'workout.confirmDeleteTitle': 'Delete "{title}"?',
  'workout.confirmDeleteBody.onGarmin':
    'The workout disappears from this list right away. It will only be removed from the watch at the next sync.',
  'workout.confirmDeleteBody.notOnGarmin':
    'This workout never reached Garmin, so it will be deleted without a trace.',
  'workout.confirmDeleteTemplateTitle': 'Delete "{title}" from the library?',
  'workout.confirmDeleteTemplateBody':
    'Sessions already scheduled on the calendar stay — you are only deleting the template they came from.',
  'workout.library.heading': 'Workout library',
  'workout.library.newButton': '+ New',
  'workout.library.emptyBody':
    'The library is empty. Save sessions you repeat here — then drag them onto the calendar.',
  'workout.library.emptyWriteHint': ' Turn on workout writing in Settings to add one.',
  'workout.library.dragHint': 'Drag a workout onto a day on the calendar, or use the "Schedule" button.',
  'workout.library.scheduleFor': 'Schedule for {date}',
  'workout.calendar.prevMonth': 'Previous month',
  'workout.calendar.nextMonth': 'Next month',
  'workout.calendar.srAuthored': ', {count} planned workouts',
  'workout.calendar.srDone': ', {count} done',
  'workout.calendar.srPlanned': ', {count} from the Garmin calendar',
  'workout.calendar.legendMine': 'Your plan',
  'workout.calendar.legendDone': 'Done',
  'workout.calendar.mon.short': 'Mo',
  'workout.calendar.mon.long': 'Monday',
  'workout.calendar.tue.short': 'Tu',
  'workout.calendar.tue.long': 'Tuesday',
  'workout.calendar.wed.short': 'We',
  'workout.calendar.wed.long': 'Wednesday',
  'workout.calendar.thu.short': 'Th',
  'workout.calendar.thu.long': 'Thursday',
  'workout.calendar.fri.short': 'Fr',
  'workout.calendar.fri.long': 'Friday',
  'workout.calendar.sat.short': 'Sa',
  'workout.calendar.sat.long': 'Saturday',
  'workout.calendar.sun.short': 'Su',
  'workout.calendar.sun.long': 'Sunday',

  /* ------------------------------------------------------------------ *
   * Season goals (spec 060)
   * ------------------------------------------------------------------ */
  'season.phase.done': 'After the race',
  'season.phase.raceWeek': 'Race week',
  'season.phase.taper': 'Taper',
  'season.phase.peak': 'Peak form',
  'season.phase.build': 'Build',
  'season.phase.base': 'Base',
  'season.phase.far': 'Far out',
  'season.verdict.past': "You're past this goal now.",
  'season.verdict.taperGood':
    "Load has dropped to {pct}% of its pre-taper level — that's a real taper. Recent fitness will have time to surface.",
  'season.verdict.taperBad':
    "Load is holding at {pct}% of its pre-taper level. This is an ordinary week wearing a taper's name — you'll start tired, not fit.",
  'season.verdict.atRisk':
    "Fitness is rising faster than the base can absorb. That's the most common route to an overuse injury — work in a lighter week before adding anything else to the plan.",
  'season.verdict.behindNoRoom':
    "The current pace won't reach the goal, and there's no time left to build. A more modest goal is more realistic than a plan that won't close the gap.",
  'season.verdict.behindRamp':
    "The current pace won't reach the goal. You need roughly {ramp} CTL points a week — add it gradually, not in one hard week.",
  'season.verdict.ahead':
    "You're ahead of plan. There's no reason to add more — extra fitness built too early usually ends in overtraining, not a better race.",
  'season.verdict.onTrack':
    'The current pace reaches the goal by the start of the taper. Keep the direction and mind the easier weeks.',
  'season.verdict.unknown':
    'Not enough continuous training history to judge the trajectory to this goal. Indicators built from an incomplete base only alarm.',
  'season.priorityLabel.a': 'Goal A',
  'season.priorityLabel.b': 'Goal B',
  'season.priorityLabel.c': 'Goal C',
  'season.priorityLabel.fallback': 'Goal',
  'season.band.onTrack': 'On track',
  'season.band.ahead': 'Ahead of plan',
  'season.band.behind': 'Behind plan',
  'season.band.atRisk': 'Overload risk',
  'season.band.unknown': 'Not assessed',
  'season.daysAgo': '{count} days ago',
  'season.today': 'today',
  'season.daysUntil': 'in {count} days',
  'season.stat.formToday': 'Fitness today',
  'season.stat.targetAtTaper': 'Target at taper start',
  'season.stat.reaching': "You'll reach",
  'season.stat.reachingHint': 'At the current pace, counting to the start of the taper — not race day.',
  'season.stat.paceNow': 'Current pace',
  'season.stat.ctlPerWeekUnit': 'CTL/wk',
  'season.stat.needed': 'Needed: {value} CTL/wk',
  'season.progressLabel': 'Progress to target fitness',
  'season.taperLabel': 'Taper',
  'season.taperHint': 'Last 7 days: {recent} TSS/day versus {baseline} in the four weeks before that.',
  'season.predictionLabel': 'Time prediction',
  'season.predictionFrom': 'From your result over {label}',
  'season.predictionUnconfident':
    'The extrapolation is a stretch — treat this number as a direction, not a forecast.',
  'season.predictionCriticalSpeed':
    'The critical-speed model gives {time}; the gap between the two methods is itself informative.',
  'season.gapTarget': 'Target {time} —',
  'season.gapAhead': 'the forecast is {time} faster',
  'season.gapBehind': '{time} short',
  'season.importedFromGarmin': 'Imported from the Garmin calendar.',
  'season.deleteGoal': 'Delete goal',
  'season.pageTitle': 'Season goals',
  'season.pageSubtitle':
    'The only place in the app that looks forward — everything else describes what already happened',
  'season.explainLabel': 'How does this work?',
  'season.explainTitle': 'How season goals work',
  'season.explainBody':
    "Give a date and a sport, and the countdown, phase and fitness trajectory are calculated from data already here. Goals with no target fitness still make sense — you get the countdown and the phase, just without a verdict on whether you'll make it.",
  'season.suggestionsTitle': 'Races from the Garmin calendar',
  'season.suggestionsSubtitle': 'We already sync these — one click turns one into a goal',
  'season.addAsGoal': 'Add as goal',
  'season.emptyTitle': 'Nothing here yet',
  'season.emptyBody':
    "You don't have a goal yet. Add a race, or a date you want to be in shape for — from that moment every number in the app gets a direction.",
  'season.noHistoryTitle': 'No training history',
  'season.noHistoryBody':
    'Goals are saved, but without synced activities there is nothing to calculate a trajectory from.',
  'season.pastHeading': 'Behind you',
  'season.deleteFailed': "Couldn't delete the goal.",
  'season.deleted': 'Goal deleted.',
  'season.networkError': "Couldn't connect to the server.",
  'season.addFailed': "Couldn't add the goal.",
  'season.adopted': 'Race added as a goal.',
  'season.form.addGoal': 'Add goal',
  'season.form.dateLabel': 'Date',
  'season.form.dateHelp': 'Race day, or the day you want to be in shape for.',
  'season.form.sportLabel': 'Sport',
  'season.form.sportHelp': 'The trajectory is calculated from fitness in this sport.',
  'season.form.kindLabel': 'Kind',
  'season.form.kindRace': 'Race',
  'season.form.kindFitness': 'Fitness',
  'season.form.priorityLabel': 'Priority',
  'season.form.priorityHelp': 'A is the season goal; B and C are races along the way.',
  'season.form.distanceLabel': 'Distance (km)',
  'season.form.distanceHelp': 'Needed to calculate a time prediction.',
  'season.form.distancePlaceholder': '21.1',
  'season.form.targetTimeLabel': 'Target time',
  'season.form.targetTimeHelp': 'Format h:mm:ss, e.g. 1:30:00.',
  'season.form.targetCtlLabel': 'Target fitness (CTL)',
  'season.form.targetCtlHelp':
    'Optional. Without it you get the countdown and phase, but no trajectory assessment.',
  'season.form.namePlaceholder': 'e.g. Warsaw Marathon',
  'season.form.saving': 'Saving…',
  'season.form.saveGoal': 'Save goal',
  'season.form.errorDistance': 'Distance must be a number of kilometres.',
  'season.form.errorTime': 'Enter the target time as h:mm:ss.',
  'season.form.errorCtl': 'Target fitness must be a number.',
  'season.form.saveFailed': "Couldn't save the goal.",
  'season.form.added': 'Goal added.',

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
  'running.mileage.chartLabel': 'Distance',
  'running.curve.explainLabel': 'How do we calculate critical pace?',
  'running.curve.explainTitle': 'Where critical pace comes from',
  'running.efficiency.explainLabel': 'How do we calculate aerobic efficiency?',
  'running.efficiency.explainTitle': 'Where aerobic efficiency comes from',
  'running.predictions.basisMeasured': 'a measured segment',
  'running.predictions.basisProjected': 'projected from the whole run',
  'running.predictions.noChangeValue': 'no change',
  'running.predictions.deltaFlat': '{label}: no change since {date}',
  'running.predictions.deltaChanged': '{label}: {direction} by {value} vs {date}',
  'running.predictions.faster': 'faster',
  'running.predictions.slower': 'slower',
  'running.predictions.criticalPaceInline': 'from critical pace {value}',
  'running.predictions.extrapolationFactor': 'extrapolation ×{value}',
  'running.predictions.noRecordNearby':
    'Critical-speed model only — no personal best is close enough to this distance.',
  'running.predictions.explainLabel': 'How do we calculate these predictions?',
  'running.predictions.explainTitle': 'Where these predictions come from',
  'running.predictions.explainBody':
    "The big number is Riegel's law applied to your closest-performing distance — the further the " +
    'extrapolation, the less it means, which is why we show its multiple and refuse to compute it at ' +
    "all beyond four times. The marker beside the distance compares today's prediction with the same " +
    'prediction computed from results as they stood 90 days ago; when there is nothing to compare ' +
    'against, the marker is simply absent. Distances neither method has anything to say about do not ' +
    'appear here. Neither method knows anything about fuelling, heat, or whether you have ever run the ' +
    'distance.',
  'running.profile.title': 'Runner profile',
  'running.profile.explainLabel': 'What does this profile show?',
  'running.profile.explainTitle': 'Where this profile comes from',
  'running.profile.explainBody': 'Five axes calculated from your synced runs.',
  'running.profile.radarAriaLabel': 'Runner profile — five axes',
  'running.profile.yourType': 'Your type',
  'running.profile.strengthLabel': 'Strength:',
  'running.profile.weaknessLabel': 'To improve:',
  'running.profile.noData': 'no data',
  'running.profile.windowWeeks': 'come from the last {weeks} weeks',
  'running.profile.windowPending': 'only apply once a few weeks of history have built up',
  'running.profile.scale':
    'Reference scale: 0 is beginner level, 100 is elite — this measures the SHAPE of the profile, not a ' +
    'fitness test. Pace axes come from your personal bests, while volume and consistency {window}. ' +
    'A dashed axis means no data, not zero.',

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
  'volume.sportFilter.all': 'All',
  'volume.yoy.subtitleWithSport':
    'Cumulative kilometres — {sport}. Each year measured on the same day of the season, otherwise the ' +
    'comparison would mean nothing.',
  'volume.yoy.byKmLead': 'by',
  'volume.yoy.byKmTrail': 'on the same day of the year.',
  'volume.yoy.emptySport': 'No activity in this sport in recent years.',
  'volume.yoy.sportAriaLabel': 'Sport on the year-on-year chart',
  'volume.period.last12': 'Last 12 months',
  'volume.period.last12Short': '12 mo.',
  'volume.period.last12Lower': 'the last 12 months',
  'volume.period.sectionTitle': 'Months and consistency',
  'volume.period.ariaLabel': 'Period',
  'volume.monthly.subtitleFor': '{period}, split by sport.',
  'volume.monthly.partialCaveat': 'The current month is incomplete.',
  'volume.grid.titleWithPeriod': 'Consistency · {period}',
  'volume.grid.subtitleGeneric':
    'Every day as one square — streaks, gaps and seasonality show up here immediately, which no weekly ' +
    'chart will do',
  'volume.grid.noteWithPeriod':
    'The shade depends on how big a day was relative to your other days in this period, not to the ' +
    'biggest one — otherwise a single long run would wash out the whole year. A day with no activity is ' +
    'an empty square, not the palest shade.',

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
  'weeklySummary.title': 'Weekly summary',
  'weeklySummary.subtitle': 'A fixed 12-week window — independent of the range picked at the top of the page',
  'weeklySummary.sportAriaLabel': 'Sport',
  'weeklySummary.thisWeekHeading': 'This week',
  'weeklySummary.thisWeekCaption': 'since Monday {weekStart} · {days} of 7 days · {label}',
  'weeklySummary.trendHeading': 'Last {weeks} weeks',
  'weeklySummary.emphasisLabel': 'current week (in progress)',
  'weeklySummary.currentWeekDayWord': { one: 'day', other: 'days' },
  'weeklySummary.trendCaption':
    'The last point is the current, incomplete week: {value} after {days} {dayWord}.',
  'weeklySummary.moreLink': 'Full volume view →',
  'weeklySummary.emptyBody': 'No training from the last {weeks} weeks. Run a sync under',
  'weeklySummary.emptyBodyTail': ', and cycling, running and walking will appear here automatically.',

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
  'page.updatedLabel': 'Updated {time}',
  'page.garminNotConnectedBody':
    "We don't see a Garmin connection, so there is nothing to show. Reconnect your account in Settings.",
  'page.homeHeadTitle': 'OpenVitals — your Garmin data, connected to AI',

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
  'login.note': 'An account is created by this install’s administrator.',
  'login.continueWithGoogle': 'Continue with Google',
  'login.identifierLabel': 'Username or email',
  'login.passwordLabel': 'Password',
  'login.signInButton': 'Sign in',
  'login.orDivider': 'or',
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
  'activities.pagesAriaLabel': 'Pages',
  'activities.card.distance': 'Distance',
  'activities.card.time': 'Time',

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
  'power.riderTypeTitle': 'Rider-type analysis',
  'power.riderTypeSubtitleWeight': 'Weight {weight} kg · W/kg',
  'power.riderTypeSubtitleUnknown': 'Weight unknown · watts',
  'power.riderRadarAriaLabel': 'Rider-type radar',
  'power.ftpZonesTitle': 'FTP and power zones',
  'power.ftpEstimated': 'estimated',
  'power.best20MinLabel': 'Est. 20 min',
  'power.best60MinLabel': 'Best 60 min',
  'power.yearlyBestsTitle': 'Best results by year',
  'power.yearColumnHeader': 'Year',
  'power.curveLabel': 'Power curve',
  'power.allTimeSeriesName': 'Record',

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
  'timelineView.nextHeading': "What's next",
  'timelineView.hiddenCount': '{count} less notable hidden',
  'timelineView.planFallback': 'plan',
  'timelineView.plannedNotSyncedBodyShort':
    "We don't fetch your Garmin training calendar yet, so there is nothing to show here — rather than guess what you have planned.",

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

  /* ------------------------------------------------------------------ *
   * i18n audit (this pass): the activity-detail cards and their pure builders that were still
   * rendering literal Polish instead of calling i18n.t(). Grouped by component/module below.
   * ------------------------------------------------------------------ */
  'detail.tilesAriaLabel': 'Key numbers',
  'detail.tile.distance': 'Distance',
  'detail.tile.movingTime': 'Moving time',
  'detail.tile.calories': 'Calories',
  'detail.mapTitle': 'Route',
  'detail.streamsTitle': 'Course',
  'detail.stravaLink': 'View on Strava →',

  /* ---- ActivityZones.svelte: card chrome that was still hardcoded ---- */
  'zones.title': 'Intensity zones',
  'zones.powerTableTitle': 'Best power',
  'zones.powerTableSubtitle': 'Highest average power for each duration',
  'zones.hrBlockTitle': 'Heart rate',
  'zones.powerBlockTitle': 'Power',
  'zones.donutAriaLabel': 'Time distribution across power zones',
  'zones.hrBarLabel': 'Zone {zone}',

  /* ---- ActivityStreamsPanel.svelte ---- */
  'streams.axis.time': 'Time',
  'streams.axis.distance': 'Distance',
  'streams.axisAriaLabel': "Charts' horizontal axis",
  'streams.hint': 'Hover any chart — the same moment is marked on all of them. Click to pin it in place.',
  'streams.viewMode.stacked': 'One by one',
  'streams.viewMode.combined': 'All in one',
  'streams.viewModeAriaLabel': 'Chart layout',

  /* ---- activity-charts.ts: chart specs passed as props into TrendChart ---- */
  'chart.section.effort': 'Effort',
  'chart.section.terrain': 'Terrain and conditions',
  'chart.section.physiology': 'Physiology',
  'chart.section.dynamics': 'Running dynamics',
  'chart.heartRate.title': 'Heart rate',
  'chart.pace.title': 'Pace',
  'chart.pace.note': 'Higher on the chart means slower.',
  'chart.speed.title': 'Speed',
  'chart.gradeAdjustedPace.title': 'Grade-adjusted pace',
  'chart.gradeAdjustedPace.note':
    'The pace this effort would be worth on flat ground. Faster than actual uphill, slower downhill.',
  'chart.power.title': 'Power',
  'chart.cadence.title': 'Cadence',
  'chart.elevation.title': 'Elevation',
  'chart.grade.title': 'Grade',
  'chart.temperature.title': 'Temperature',
  'chart.cardiacCost.title': 'Cardiac cost',
  'chart.cardiacCost.note':
    'Heartbeats per kilometre. Lower is cheaper. Rises when heart rate drifts at the same pace.',
  'chart.respirationRate.title': 'Breathing',
  'chart.performanceCondition.title': 'Performance condition',
  'chart.verticalRatio.title': 'Vertical ratio',
  'chart.verticalOscillation.title': 'Vertical oscillation',
  'chart.groundContactTime.title': 'Ground contact time',
  'chart.groundContactBalance.title': 'Ground contact balance',
  'chart.groundContactBalance.note': '50% = even between legs.',
  'chart.strideLength.title': 'Stride length',
  'chart.stamina.title': 'Stamina',
  'chart.stamina.current': 'Available',
  'chart.stamina.potential': 'Potential',
  'chart.unit.stepsPerMin': 'steps/min',
  'chart.unit.rpm': 'rpm',
  'chart.unit.beatsPerKm': 'beats/km',
  'chart.unit.breathsPerMin': 'breaths/min',
  'chart.unit.points': 'pts',
  'chart.unit.metresAsl': 'm asl',

  /* ---- StatSections.svelte / activity-stat-groups.ts ---- */
  'stat.noDataHint': 'No data: {hint}',
  'stat.timing.title': 'Time and motion',
  'stat.timing.duration': 'Duration',
  'stat.timing.moving': 'Moving',
  'stat.timing.elapsed': 'Total time',
  'stat.timing.idle': 'Idle',
  'stat.timing.run': 'Running',
  'stat.timing.walk': 'Walking',
  'stat.timing.stand': 'Standing',
  'stat.pace.title': 'Pace and speed',
  'stat.pace.avgPace': 'Average pace',
  'stat.pace.movingPace': 'Moving pace',
  'stat.pace.bestPace': 'Best pace',
  'stat.pace.gap': 'Grade-adjusted pace',
  'stat.pace.avgSpeed': 'Average speed',
  'stat.pace.maxSpeed': 'Max speed',
  'stat.pace.avgPaceRide': 'Average pace',
  'stat.elevation.title': 'Elevation',
  'stat.elevation.gain': 'Total ascent',
  'stat.elevation.loss': 'Total descent',
  'stat.elevation.min': 'Lowest',
  'stat.elevation.max': 'Highest',
  'stat.hr.title': 'Heart rate',
  'stat.hr.avg': 'Average',
  'stat.hr.max': 'Maximum',
  'stat.power.title': 'Power',
  'stat.power.avg': 'Average',
  'stat.power.max': 'Maximum',
  'stat.power.np': 'Normalized',
  'stat.dynamics.title': 'Running dynamics',
  'stat.dynamics.avgCadence': 'Average cadence',
  'stat.dynamics.maxCadence': 'Max cadence',
  'stat.dynamics.stride': 'Stride length',
  'stat.dynamics.vRatio': 'Vertical ratio',
  'stat.dynamics.vOsc': 'Vertical oscillation',
  'stat.dynamics.gctBalance': 'Contact balance',
  'stat.dynamics.gct': 'Ground contact time',
  'stat.cadence.title': 'Cadence',
  'stat.cadence.avg': 'Average',
  'stat.cadence.max': 'Maximum',
  'stat.calories.title': 'Calories and hydration',
  'stat.calories.total': 'Calories',
  'stat.calories.active': 'Active',
  'stat.calories.resting': 'Resting',
  'stat.calories.sweat': 'Sweat loss',
  'stat.trainingEffect.title': 'Training effect',
  'stat.trainingEffect.aerobic': 'Aerobic',
  'stat.trainingEffect.anaerobic': 'Anaerobic',
  'stat.trainingEffect.benefit': 'Primary benefit',
  'stat.trainingEffect.load': 'Load',
  'stat.trainingEffect.rpe': 'Perceived effort',
  'stat.trainingEffect.feel': 'Feel',
  'stat.trainingEffect.execution': 'Execution score',
  'stat.physiology.title': 'Physiology',
  'stat.physiology.respAvg': 'Breathing — average',
  'stat.physiology.respMin': 'Breathing — min.',
  'stat.physiology.respMax': 'Breathing — max.',
  'stat.physiology.staminaBegin': 'Stamina at start',
  'stat.physiology.staminaEnd': 'Stamina at end',
  'stat.physiology.staminaMin': 'Minimum stamina',
  'stat.physiology.bodyBattery': 'Body Battery',
  'stat.physiology.stressAvg': 'Stress — average',
  'stat.physiology.stressMax': 'Stress — max.',
  'stat.physiology.stressDiff': 'Stress — change',
  'stat.temperature.title': 'Temperature',
  'stat.temperature.avg': 'Average',
  'stat.temperature.min': 'Minimum',
  'stat.temperature.max': 'Maximum',
  'stat.intensity.title': 'Intensity minutes',
  'stat.intensity.moderate': 'Moderate',
  'stat.intensity.vigorous': 'Vigorous',
  'stat.intensity.total': 'Total (2× weighted)',
  'stat.hint.gradeAdjusted':
    'Garmin does not provide grade-adjusted pace — only Strava computes it, from its own model.',
  'stat.hint.avgTemperature':
    'Garmin only reports a minimum and a maximum. We compute the average from the temperature stream, and this device did not record one.',
  'stat.hint.runWalk':
    "The run/walk split comes from Garmin's own classification (typed splits). This activity has none — usually because the sport or the watch does not generate them.",
  'stat.hint.selfEvaluation':
    'Post-workout feel is entered manually on the watch or in Garmin Connect. This activity has no such entry.',
  'stat.hint.stamina': 'Stamina is only reported by newer watches, and only for some sports.',
  'stat.hint.executionScore':
    'Garmin only returns an execution score for sessions run against a planned workout. This activity has none.',

  /* ---- ActivityFlags.svelte / activity-highlights.ts ---- */
  'flags.title': 'Worth a look',
  'flags.subtitle': 'Records, and values that look like a measurement error',
  'flags.record': 'Record',
  'flags.notable': 'Notable',
  'flags.highlightsAriaLabel': 'Highlighted results',
  'flags.suspectsAriaLabel': 'Values that look like an error',
  'flags.suspectSevere': 'Suspect value',
  'flags.suspectMild': 'Worth checking',
  'flags.rankOf': '{rank} of {outOf} comparable sessions',
  'highlight.metric.distance': 'Distance',
  'highlight.metric.duration': 'Moving time',
  'highlight.metric.elevation': 'Elevation gain',
  'highlight.metric.pace': 'Average pace',
  'highlight.metric.speed': 'Average speed',
  'highlight.metric.load': 'Training load',
  'highlight.metric.calories': 'Calories',
  'highlight.metric.normPower': 'Normalized power',
  'highlight.tiedAllTime': 'Tied the best result on record',
  'highlight.tiedWindow': 'Tied the best result in the last {span}',
  'highlight.recordAllTime': 'Record — the best result on record',
  'highlight.recordWindow': 'The best result in the last {span}',
  'highlight.bestSince': 'Best in {span}',
  'highlight.rankAllTime': '#{rank} best result on record',
  'highlight.rankWindow': '#{rank} best result in the last {span}',
  'highlight.months': {
    one: '{count} month',
    other: '{count} months'
  },
  'highlight.span.years': '{years} years',
  'highlight.span.syncedHistory': 'your synced history',
  'suspect.label.maxSpeed': 'Max speed',
  'suspect.label.elevation': 'Elevation gain',
  'suspect.label.maxHr': 'Max heart rate',
  'suspect.label.distanceTime': 'Distance and time',
  'suspect.label.movingTime': 'Moving time',
  'suspect.label.cadence': 'Cadence',
  'suspect.zeroSamples': '{count} zero samples',
  'suspect.speedCeiling':
    'Above {ceiling} km/h for this sport — almost always a GPS spike, not a real speed. Averages derived from the speed stream will be inflated by it too.',
  'suspect.speedSpike':
    '{ratio}× the average of {avg} km/h. Usually a single GPS spike — coming out of a tunnel or tree cover, say.',
  'suspect.elevationPerKm':
    '{perKm} m per kilometre. Above {ceiling} m/km is usually barometer drift or GPS-derived elevation, not a climb that steep.',
  'suspect.maxHrCeiling':
    '{ceiling} bpm or more is almost always a strap artefact — usually picked-up cadence, or noise at the start before the strap made contact.',
  'suspect.hrSpike':
    '{gap} bpm above the {avg} bpm average. For a steady session, a gap like that is more likely a single spike than real effort.',
  'suspect.speedMismatch':
    'Distance divided by time gives {implied} km/h, but the watch reports an average of {avg} km/h — a {drift}% mismatch. Usually means part of the recording is missing, or distance came from a different source than speed.',
  'suspect.movingOverElapsed':
    "Moving time is longer than total elapsed time, which isn't possible. Usually the recording was stitched together after a pause or resume.",
  'suspect.cadenceGap':
    'The longest run of zeros is {gap} samples in a row. At a one-second recording rate that is about {minutes} min with no signal — usually the sensor dropped out, which understates the average cadence.',

  /* ---- ActivityEfficiency.svelte ---- */
  'efficiency.title': 'Aerobic efficiency',
  'efficiency.subtitle': 'What one heartbeat cost — and whether that cost rose during the session',
  'efficiency.shape.even.label': 'Even',
  'efficiency.shape.even.text':
    'Both halves at a similar pace, without big swings. This is what a well-paced steady session looks like.',
  'efficiency.shape.negativeSplit.label': 'Negative split',
  'efficiency.shape.negativeSplit.text':
    'The second half was faster than the first — the pacing racers aim for: a controlled start, a stronger finish.',
  'efficiency.shape.faded.label': 'Faded',
  'efficiency.shape.faded.text':
    'The second half was clearly slower. A classic too-fast start — or a distance still beyond your current fitness.',
  'efficiency.shape.variable.label': 'Variable pace',
  'efficiency.shape.variable.text':
    'A wide spread of pace between segments. This is what interval work or a very rolling route looks like — the half-by-half balance means nothing here.',
  'efficiency.decouplingLabelPower': 'Heart-rate/power decoupling',
  'efficiency.decouplingLabelPace': 'Heart-rate/pace decoupling',
  'efficiency.decoupling.coupled.label': 'Coupled',
  'efficiency.decoupling.coupled.text':
    'Pace-per-heartbeat held steady in the second half (up to {limit}% counts as stable here). This is what a well-paced aerobic effort looks like.',
  'efficiency.decoupling.drifted.label': 'Drifted',
  'efficiency.decoupling.drifted.text':
    'The second half cost more heartbeats for the same output. Typical causes: too fast a start, heat, not enough fuel, or a distance still beyond your aerobic fitness.',
  'efficiency.decoupling.accelerated.label': 'Accelerated',
  'efficiency.decoupling.accelerated.text':
    'The second half was cheaper than the first — usually means a very easy start, or a long warm-up included in the recording.',
  'efficiency.decoupling.meta':
    'Second half vs first, {samples} samples per half. Computed from the whole recording — this number is meaningless for interval training.',
  'efficiency.paceLabel': 'Pace shape',
  'efficiency.secondHalfUnit': 'second half',
  'efficiency.pacing.meta':
    'Halves split by DISTANCE, not time — otherwise fading would be understated. {first} vs {second} min/km. Pace spread across {chunks} segments: {variability}%.',
  'efficiency.efLabel': 'Efficiency factor',
  'efficiency.efText':
    'Metres per minute per heartbeat. Rises when the same pace costs fewer beats — a sign of aerobic fitness, independent of how hard the effort felt.',
  'efficiency.powerEfLabel': 'Power efficiency',
  'efficiency.powerEfUnit': 'W/bpm',
  'efficiency.powerEfText': 'Watts per heartbeat — the cycling equivalent of the above.',
  'efficiency.cardiacCostLabel': 'Cardiac cost',
  'efficiency.cardiacCostUnit': 'beats/km',
  'efficiency.cardiacCostText':
    'That is how many heartbeats one kilometre cost. Fewer on the same route means better fitness.',

  /* ---- ActivityBestEfforts.svelte ---- */
  'bestEfforts.title': 'Best efforts',
  'bestEfforts.subtitle':
    'The fastest stretch of this activity at every distance — even one buried inside a longer session',
  'bestEfforts.explainLabel': 'How do we work these out?',
  'bestEfforts.col.distance': 'Distance',
  'bestEfforts.col.time': 'Time',
  'bestEfforts.col.pace': 'Pace',
  'bestEfforts.col.start': 'Start',
  'bestEfforts.col.measured': 'Measured',
  'bestEfforts.explainWindow':
    'The measurement window covers at least the target distance, which is why the "measured" column shows how many metres it actually spanned — pace is computed from that value, not the nominal distance.',
  'bestEfforts.explainOvershoot':
    'In this recording the windows clearly overshoot the distance, which means the watch sampled infrequently.',
  'bestEfforts.explainStart': '"Start" is the time from the beginning of the activity.',

  /* ---- ActivityClimbs.svelte ---- */
  'climbs.title': 'Climbs',
  'climbs.subtitle':
    'Not "how much elevation", but "what did I actually climb" — with VAM, the climbing rate',
  'climbs.hardest': 'Hardest: {label}',
  'climbs.summaryUnit': 'of climbing',
  'climbs.summaryShare': ' · {pct}% of this activity’s total elevation gain',
  'climbs.count': {
    one: 'climb',
    other: 'climbs'
  },
  'climbs.col.gain': 'Elevation gain',
  'climbs.col.length': 'Length',
  'climbs.col.grade': 'Grade',
  'climbs.col.time': 'Time',
  'climbs.col.vam': 'VAM',
  'climbs.col.start': 'Start',
  'climbs.col.category': 'Category',
  'climbs.explainLabel': 'How do we work out climbs?',
  'climbs.explain':
    'A climb is a continuous rise of at least 30 m at an average grade of 2% or more; short dips inside it do not break it, because real roads have false flats. VAM is computed from the time of the whole climb — stopping halfway genuinely lowers the climbing rate. Barometer elevation drifts, and GPS elevation drifts more, so treat categories as approximate.',

  /* ---- ActivityLapsPanel.svelte / activity-laps.ts ---- */
  'laps.splitsTitle': 'Running, walking and standing',
  'laps.splitsSubtitle': "Garmin's classification — share of time",
  'laps.splitsAriaLabel': 'Time split between running, walking and standing',
  'laps.title': 'Laps',
  'laps.subtitle': '{count} laps recorded by the watch',
  'laps.caption': 'Statistics for each lap',
  'laps.col.index': 'No.',
  'laps.col.distance': 'Distance',
  'laps.col.duration': 'Time',
  'laps.col.pace': 'Pace',
  'laps.col.speed': 'Speed',
  'laps.col.avgHr': 'Avg. HR',
  'laps.col.maxHr': 'Max HR',
  'laps.col.avgPower': 'Avg. power',
  'laps.col.cadence': 'Cadence',
  'laps.col.elevation': 'Ascent',
  'laps.col.calories': 'Calories',

  /* ---- ActivityMatchedRoute.svelte ---- */
  'matchedRoute.found': {
    one: 'Found {count} earlier run of this route',
    other: 'Found {count} earlier runs of this route'
  },
  'matchedRoute.fastestEver.label': 'Fastest ever',
  'matchedRoute.fastestEver.text': 'This is the fastest run of this route among the ones we could match.',
  'matchedRoute.rankLabel': '#{rank} fastest',
  'matchedRoute.withinRange': "This run's pace sits within the rest.",
  'matchedRoute.gapToBest': 'Off the best run by {gap} per kilometre.',
  'matchedRoute.col.date': 'Date',
  'matchedRoute.col.pace': 'Pace',
  'matchedRoute.col.time': 'Time',
  'matchedRoute.col.distance': 'Distance',
  'matchedRoute.col.hr': 'Heart rate',
  'matchedRoute.col.overlap': 'Overlap',
  'matchedRoute.thisActivity': 'this activity',
  'matchedRoute.explainLabel': 'How do we match routes?',
  'matchedRoute.explain':
    'Routes are matched by the overlap of a grid of roughly 50-metre cells, at a similar length — this is probably the same route, not proof. The "overlap" column shows how much of it matched. Direction does not matter, so the same route run backwards still matches. Compared against {count} recorded tracks of the same sport.',
  'matchedRoute.emptyNoGps':
    'This session has no recorded GPS track, so it cannot be matched to earlier runs. Try the {similarTab} tab.',
  'matchedRoute.emptyNoMatch':
    'No earlier runs of this route were found. Routes are matched by GPS overlap, so the first time on a new road never has anything to match against.',

  /* ---- SimilarActivities.svelte ---- */
  'similar.title': 'Compare with other sessions',
  'similar.subtitle': 'Two ways: a similar effort, or exactly the same route.',
  'similar.tab.effort': 'Similar effort',
  'similar.tab.route': 'Same route',
  'similar.tabsAriaLabel': 'Comparison method',
  'similar.emptyNoAxis':
    'This session has no distance or duration, so it cannot be compared with other efforts. Try the {routeTab} tab.',
  'similar.emptyNoMatch':
    'No similar sessions. We looked for sessions of the same sport with distance and duration within ±{tolerance}% — none of the {compared} were a match. This session was unusual for you.',
  'similar.comparedSessions': {
    one: '{count} comparable session',
    other: '{count} comparable sessions'
  },
  'similar.scope': '{matches} within ±{tolerance}% · compared {compared}{recent}',
  'similar.matches': {
    one: '{count} match',
    other: '{count} matches'
  },
  'similar.comparedSessionsShort': {
    one: '{count} session',
    other: '{count} sessions'
  },
  'similar.recentOnly': ' (most recent)',
  'similar.col.date': 'Date',
  'similar.col.distance': 'Distance',
  'similar.col.time': 'Time',
  'similar.col.pace': 'Pace',
  'similar.col.comparison': 'Today vs then',
  'similar.metric.pace': 'pace',
  'similar.metric.hr': 'heart rate',
  'similar.metric.power': 'power',
  'similar.delta.sameValue': 'unchanged',
  'similar.delta.sameLabel': '{metric} unchanged versus this session',
  'similar.delta.lower': "today's {metric} is lower by {value} than in this session",
  'similar.delta.higher': "today's {metric} is higher by {value} than in this session",

  /* ---- TrainingVerdict.svelte / activity-comparison.ts / activity-comparison.format.ts ---- */
  'verdict.title': 'Training verdict',
  'verdict.subtitle': 'Against your own sessions from the last 6 weeks',
  'verdict.empty': 'Not enough data to score this session.',
  'verdict.load': 'Load',
  'verdict.recentNorm': '6-wk norm',
  'verdict.recentComparable': '{count} comparable',
  'verdict.formBefore': 'Form before',
  'verdict.noHistory': 'no history',
  'verdict.fitness': 'Fitness (CTL)',
  'verdict.dayBefore': 'the evening before',
  'verdict.loadRatio': 'session = {ratio}× CTL',
  'verdict.vsNorm': 'vs. norm',
  'verdict.ftpLine': 'FTP {ftp} W{estimated}',
  'verdict.ftpEstimatedSuffix': ' (estimated from the power curve)',
  'verdict.ftpMissing': 'Set your FTP in settings to see IF and TSS.',
  'verdict.method.garmin': 'load from Garmin',
  'verdict.method.power': 'from power (TSS)',
  'verdict.method.hr': 'estimated from heart rate',
  'verdict.method.none': 'no source',
  'verdict.work': 'Work',
  'verdict.plannedLabel': 'Planned session',
  'verdict.plannedNoneScheduled':
    'Nothing was scheduled in the calendar for this day in this sport — this session was off-plan.',
  'verdict.plannedNotSynced':
    "We don't have a synced training calendar around this date, so we don't know whether this session followed a plan.",
  'verdict.band.fresh': 'fresh',
  'verdict.band.optimal': 'optimal form',
  'verdict.band.neutral': 'balanced',
  'verdict.band.fatigued': 'fatigued',
  'verdict.band.veryFatigued': 'very fatigued',
  'verdict.easy': 'Lighter than usual',
  'verdict.steady': 'A typical session',
  'verdict.hard': 'Harder than usual',
  'verdict.peak': 'The hardest in weeks',
  'verdict.unknown': 'Nothing to compare against',
  'verdict.summary.noLoad':
    "This activity's load can't be scored — there is neither a Garmin load nor a heart-rate recording.",
  'verdict.summary.firstSession':
    'This is the first comparable session in the last 6 weeks, so there is nothing yet to measure it against.',
  'verdict.summary.noNorm': 'No reliable norm from the last 6 weeks.',
  'verdict.summary.typical': 'Load in line with {norm}.',
  'verdict.summary.harder': '{pct}% harder than {norm}.',
  'verdict.summary.lighter': '{pct}% lighter than {norm}.',
  'verdict.summary.norm': 'a typical session from the last 6 weeks ({count} comparable)',
  'verdict.summary.form': 'You went into it with a form of {sign}{value} ({band}).',

  /* ---- activity-format.ts: shared enum dictionaries (training-effect benefit, typed-split class) ---- */
  'benefit.recovery': 'Recovery',
  'benefit.base': 'Aerobic base',
  'benefit.tempo': 'Tempo',
  'benefit.threshold': 'Lactate threshold',
  'benefit.vo2max': 'VO2 max',
  'benefit.anaerobicCapacity': 'Anaerobic capacity',
  'benefit.anaerobic': 'Anaerobic',
  'benefit.speed': 'Speed',
  'benefit.sprint': 'Sprint',
  'benefit.maintaining': 'Maintaining',
  'benefit.impactNone': 'No impact',
  'benefit.unknown': 'Unknown',
  'benefit.noBenefit': 'No clear benefit',
  'split.run': 'Running',
  'split.walk': 'Walking',
  'split.stand': 'Standing',
  'split.interval': 'Interval',
  'split.rest': 'Rest',
  'split.otherRest': 'Rest',
  'split.warmup': 'Warm-up',
  'split.cooldown': 'Cooldown',
  'split.fallback': 'Segment',

  /* ---- modules/best-efforts (all-time PR leaderboard, distinct from the per-activity card above) ---- */
  'records.title': 'Personal bests',
  'records.subtitle':
    'The fastest stretches across your whole running history — including ones buried inside longer sessions.',
  'records.pr': 'PR',
  'records.prAriaLabel': 'Personal best',
  'records.rankAriaLabel': '#{rank} best result',
  'records.explainLabel': 'How do we work out these records?',
  'records.explain':
    'A stretch is the fastest window covering at least the given distance, found within the recorded pace of the whole session — so a 5 km inside a long run counts the same as a 5 km race. We show up to {topN} best results per distance; click a row to open that activity.',
  'records.empty':
    'No records yet. Stretches are computed from recorded running pace — they will show up here once a sync fetches and processes activity streams (the',

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
  'insights.anomalySd': '±{sd} SD',
  'insights.correlationMeta': 'r = {r} · {days} days',
  'insights.correlationHigher': 'More “{a}” usually comes with higher “{b}”.',
  'insights.correlationLower': 'More “{a}” usually comes with lower “{b}”.',

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
  'readiness.explainLabel': 'How do we calculate this score?',

  'readiness.title': 'Readiness',
  'readiness.subtitle': 'How ready you are to train today, and when you will be back at full strength',
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
  'plan.strip.title': 'Workout structure',
  'plan.strip.plannedLabel': 'Planned',
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
  'auth.noAccountForGoogleEmail':
    'No account found for this Google account. Ask an admin to create one for you.',
  'auth.invalidCredentials': 'Invalid username, email, or password.',

  'onboarding.title': 'Create the admin account',
  'onboarding.subtitle': 'A one-time step — create the first account to start using OpenVitals.',
  'onboarding.emailLabel': 'Email',
  'onboarding.usernameLabel': 'Username',
  'onboarding.passwordLabel': 'Password',
  'onboarding.confirmPasswordLabel': 'Confirm password',
  'onboarding.submit': 'Create admin account',
  'onboarding.error.invalid_email': 'Enter a valid email address.',
  'onboarding.error.email_taken': 'This email is already in use.',
  'onboarding.error.invalid_username':
    'Username must be 3-32 characters: lowercase letters, digits, "_" or "-".',
  'onboarding.error.username_taken': 'This username is already taken.',
  'onboarding.error.invalid_password': 'Password must be 10-72 bytes.',
  'onboarding.error.password_mismatch': 'Passwords do not match.',

  'admin.users.navLabel': 'Admin',
  'admin.users.pageTitle': 'Users',
  'admin.users.newUserButton': 'New user',
  'admin.users.tableCaption': 'Every account on this install',
  'admin.users.colUsername': 'Username',
  'admin.users.colEmail': 'Email',
  'admin.users.colName': 'Name',
  'admin.users.colAdmin': 'Role',
  'admin.users.colMethods': 'Sign-in',
  'admin.users.colCreated': 'Created',
  'admin.users.colActions': 'Actions',
  'admin.users.adminBadge': 'Admin',
  'admin.users.memberBadge': 'Member',
  'admin.users.passwordBadge': 'Password',
  'admin.users.googleBadge': 'Google',
  'admin.users.createTitle': 'New user',
  'admin.users.editTitle': 'Edit user',
  'admin.users.emailLabel': 'Email',
  'admin.users.usernameLabel': 'Username',
  'admin.users.initialPasswordLabel': 'Initial password (optional)',
  'admin.users.resetPasswordLabel': 'New password (optional)',
  'admin.users.resetPasswordHelp': 'Fill in to set a new password for this user.',
  'admin.users.isAdminLabel': 'Admin',
  'admin.users.deleteConfirmTitle': 'Delete this user?',
  'admin.users.deleteConfirmBody':
    "{username}'s account will be deleted along with their sessions. This cannot be undone.",
  'admin.users.lastAdminTitle': 'Cannot remove the sole admin',
  'admin.users.lastAdminBody':
    'This user is the only admin. Make another account an admin before deleting this one or removing its admin role.',
  'admin.users.error.invalid_email': 'Enter a valid email address.',
  'admin.users.error.email_taken': 'This email is already in use.',
  'admin.users.error.invalid_username':
    'Username must be 3-32 characters: lowercase letters, digits, "_" or "-".',
  'admin.users.error.username_taken': 'This username is already taken.',
  'admin.users.error.invalid_password': 'Password must be 10-72 bytes.',
  'admin.users.saveErrorBanner': 'Could not save the changes. Check the fields below.',

  'account.title': 'My account',
  'account.subtitle': 'How you sign in, and this account’s password',
  'account.usernameLabel': 'Username',
  'account.emailLabel': 'Email',
  'account.passwordStatusLabel': 'Password',
  'account.passwordSet': 'Set',
  'account.passwordNotSet': 'Not set',
  'account.googleStatusLabel': 'Google',
  'account.googleLinked': 'Linked',
  'account.googleNotLinked': 'Not linked',
  'account.setPasswordTitle': 'Set a password',
  'account.changePasswordTitle': 'Change password',
  'account.currentPasswordLabel': 'Current password',
  'account.newPasswordLabel': 'New password',
  'account.confirmPasswordLabel': 'Confirm new password',
  'account.password.saved': 'Password saved.',
  'account.password.error.wrongCurrent': 'Your current password is incorrect.',
  'account.password.error.mismatch': 'Passwords do not match.',
  'account.password.error.invalid': 'Password must be 10-72 bytes.',
  'account.password.error.network': 'Network error. Please try again.',
  'account.sessions.title': 'Active sessions',
  'account.sessions.subtitle': 'Devices you are currently signed in on',
  'account.sessions.tableCaption': 'Your own active sessions',
  'account.sessions.colDevice': 'Device',
  'account.sessions.colIp': 'IP address',
  'account.sessions.colCreated': 'Signed in',
  'account.sessions.colExpires': 'Expires',
  'account.sessions.colActions': 'Actions',
  'account.sessions.thisDevice': 'This device',
  'account.sessions.revokeButton': 'Sign out this device',
  'account.sessions.revokeOthersButton': 'Sign out other devices',
  'account.sessions.revokeOthersConfirmTitle': 'Sign out every other device?',
  'account.sessions.revokeOthersConfirmBody':
    'Every other active session will be ended. This device stays signed in.',
  'account.sessions.revokeFailed': 'Could not sign out that device.',
  'account.sessions.revokedOthers': 'Signed out {count} other device(s).',

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
  'insights.noChartData': 'No data in this range.',

  /* ------------------------------------------------------------------ *
   * Where the intensity zones come from (spec 086)
   * ------------------------------------------------------------------ */
  'zones.explainLabel': 'Where do these zones come from?',
  'zones.explainTitle': 'Where these zones come from',
  'zones.subtitleDefault': 'Time spent in zones',
  'zones.subtitleEstimated': "Heart-rate zones estimated from this activity's maximum",
  'zones.subtitleConfigured': 'Heart-rate zones taken from the maximum in your profile',
  'zones.hrGarmin':
    'Heart rate: these are your own zones, configured in Garmin Connect — we do not define them here. Garmin sends only the time spent in each one, never the boundaries in beats per minute, which is why the bars can say no more than "Zone 1–5".',
  'zones.hrEstimatedIntro':
    'Heart rate: Garmin sent no time-in-zone for this activity, so we split the heart-rate trace ourselves, by percentage of maximum heart rate:',
  'zones.hrBand': 'Zone {zone} — {range} of maximum heart rate',
  'zones.hrEstimatedMax':
    'The maximum we use is the highest heart rate recorded in this session, not a figure from your profile. So the top zone is all but guaranteed, and the whole split is only as good as that assumption.',
  'zones.hrConfiguredMax':
    "The maximum we use is the {maxHr} bpm saved in your profile, not this session's own peak — which is what makes zones comparable between one session and the next.",
  'zones.hrSetInSettings':
    'Save your maximum heart rate under Settings → Athlete → Profile, and the split stops depending on how hard you happened to go that day.',
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
  'zones.ftpSetInSettings':
    'Save your FTP under Settings → Athlete → Profile, and the zones, IF and TSS are all taken from one fixed number instead.',

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
  'data.summary.streamsEfforts': '{count} best efforts computed',
  'data.summary.streamsEffortsPending': '{count} best efforts queued',
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
  'data.syncTitle': 'Sync',
  'data.stop': 'Stop',
  'data.downloadingStep': 'Fetching: {step}',
  'data.syncingEllipsis': 'Syncing…',
  'data.runOk': 'ok',
  'data.watchBehindLead': 'Garmin has data only up to',
  'data.staleYesterday': 'yesterday',
  'data.staleDaysAgo': '{days} days ago',
  'data.watchBehindRest':
    '. The sync already pulled everything Garmin has — the missing days are not on its side. Open the Garmin Connect app on your phone and sync your watch, then run a sync here.',
  'data.backfillComplete': 'The daily metrics history is complete.',
  'data.logTitle': 'Sync log ({count})',
  'data.logFilterAriaLabel': 'Log filter',
  'data.tile.earliest': 'Data since',
  'data.tile.weightCount': 'Weight readings',
  'data.tile.storageSize': 'Stored size',
  'data.storageLineWithPlan':
    'Stored: {metricDays} days of metrics · {activities} activities ({withGps} with GPS, {withWorkoutId} from plan) · {streams} route streams · {weight} weight readings',
  'data.planInfoLabel': 'What does "from plan" mean?',
  'data.planInfoBody':
    '"From plan" = activities started from a scheduled workout on the watch. Only these are linked to the plan by id; the rest are matched approximately.',
  'data.coverageTitle': 'Daily data coverage',
  'data.metricHeader': 'Metric',
  'data.fromHeader': 'From',
  'data.toHeader': 'To',
  'data.phaseOk': 'OK',

  /* ------------------------------------------------------------------ *
   * Settings: version/update card (spec 068), integrations panel (spec 017)
   * ------------------------------------------------------------------ */
  'version.subtitle': 'Is this install running the latest code',
  'version.checking': 'Checking…',
  'version.checkNow': 'Check for updates',
  'version.runningLabel': 'Running version',
  'version.status': 'Status',
  'version.asking': 'Asking GitHub…',
  'version.checkFailed': 'Check failed',
  'version.notConfigured': 'Check not configured',
  'version.notConfiguredHintLead': 'Set',
  'version.notConfiguredHintMid': 'in',
  'version.notConfiguredHintTail': '— the repository is private.',
  'version.unreachable': 'GitHub unreachable',
  'version.retryLater': 'Try again shortly.',
  'version.behindBadge': 'A newer version is available',
  'version.upToDate': 'Up to date',
  'version.latestCommit': 'Latest commit',
  'version.whatNext': 'What next',
  'version.manualDeployHint':
    'Deployment is manual: update the code on the NAS and restart the stack. This card only informs — the app deliberately never updates itself.',

  'integrations.stravaTitle': 'Strava',
  'integrations.stravaSubtitle': 'Link your Garmin activities to their Strava counterparts.',
  'integrations.withingsTitle': 'Withings',
  'integrations.withingsSubtitle': 'Import weight readings from your Withings account into local storage.',
  'integrations.connected': 'Connected',
  'integrations.notConnected': 'Not connected',
  'integrations.linkedActivities': 'Linked activities: {count}',
  'integrations.weightReadings': 'Weight readings: {count}',
  'integrations.linkActivities': 'Link activities',
  'integrations.importWeight': 'Import weight',
  'integrations.disconnect': 'Disconnect',
  'integrations.connectStrava': 'Connect to Strava',
  'integrations.connectWithings': 'Connect to Withings',
  'integrations.weightImported': 'Imported {count} weight readings.',
  'integrations.activitiesScanned': 'Scanned {scanned}, matched {matched} activities.',
  'integrations.syncFailed': 'Sync failed.',
  'integrations.demoLabel': 'What does "demo data" mean?',
  'integrations.demoNote':
    'Integrations currently run on demo data. Once API keys (Strava, Withings) are added to the server config, they connect to real accounts — no code changes needed.',

  'features.saveFailed': 'Could not save the setting.',
  'features.networkError': 'Could not reach the server. Please try again.',
  'features.autoSync.title': 'Automatic data sync',
  'features.autoSync.summary':
    'Pull new data from Garmin in the background, without opening the app. When off, refresh data ' +
    'by hand on the "Your data" page.',
  'features.workoutWrite.title': 'Write workouts to Garmin',
  'features.workoutWrite.summary':
    'Let this app write workouts to your Garmin account. It is the only feature that changes ' +
    'anything there. When off, you cannot build a session here and nothing reaches the watch.',
  'features.workoutAutoPush.title': 'Send workouts automatically',
  'features.workoutAutoPush.summary':
    'On every sync, send scheduled sessions to the Garmin calendar. When off, a workout reaches the ' +
    'watch only after clicking "Send to Garmin" in the plan.',
  'features.mcp.title': 'MCP server',
  'features.mcp.summary':
    'Share your data with AI clients at your personal MCP address. When off, the address stops ' +
    'responding, but the token stays the same.',
  'features.error.badRequest': 'Expected fields { featureId, enabled }.',
  'features.error.unknown': 'Unknown feature.',

  /* ------------------------------------------------------------------ *
   * Training block: current week card (spec 073)
   * ------------------------------------------------------------------ */
  'block.title': 'Current week',
  'block.emptyState':
    'No training block covers today. A block is a named run of weeks with volume targets, paces and standing rules — so the assistant does not have to re-derive your stage every conversation.',
  'block.weekOf': 'week {weekNumber} of {weeks}',
  'block.sorenessBannerTitle': 'Soreness reported last week',
  'block.sorenessBody':
    '{soreness}/10{location}, {day}. With that signal, the safer choice is to trim volume, not add to it.',
  'block.tile.actual': 'Volume this week',
  'block.tile.target': 'Week target',
  'block.tile.remaining': 'Remaining',
  'block.progressLabel': 'Volume target progress',
  'block.sessionsTitle': 'Sessions this week',
  'block.noSessions': 'No session scheduled for this week yet.',
  'block.push.pushed': 'on the watch',
  'block.push.pending': 'awaiting push',
  'block.push.failed': 'push failed',
  'block.push.unsupported': "Garmin won't accept it",
  'block.pacesTitle': 'Block paces',
  'block.pace.easy': 'Easy',
  'block.pace.long': 'Long',
  'block.pace.threshold': 'Threshold',
  'block.pace.interval': 'Interval',
  'block.pace.goal': 'Goal',
  'block.constraintsTitle': 'Standing rules',
  'block.goalLabel': 'Goal:',
  'block.goalDaysOut': 'in {days} days',
  'block.goalPast': 'already past',

  /* ------------------------------------------------------------------ *
   * Landing page (logged out)
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
  'garminReadiness.basis': "Garmin's score, 0–100",
  'garminReadiness.factorsAriaLabel': "Garmin's readiness factors",
  'garminReadiness.asOf': 'as of {day}',

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
  'condition.state.rested': 'Rested',
  'condition.state.steady': 'Steady',
  'condition.state.strained': 'Strained',
  'condition.state.unknown': 'Not scored',
  'condition.title': 'Recovery',
  'condition.subtitle': 'Your readiness, last night, and your recovery channels, against your own baseline',
  'condition.notConnected': 'Connect your Garmin account to see your recovery.',
  'condition.connectCta': 'Connect in Settings →',
  'condition.noScore': 'Not enough data to calculate a score yet.',
  'condition.recoveredLabel': 'fully recovered, per Garmin',
  'condition.recoveryLabel': 'to full recovery, per Garmin',
  'condition.recoveryLabelStale': 'to full recovery, per Garmin — as of {day}',
  'condition.recoveryEndLabel': 'full recovery: {when}',
  'condition.noGarminScore': "Garmin hasn't sent a readiness score for this account.",
  'condition.lastNightTitle': 'Last night',
  'condition.sleepLabel': 'sleep',
  'condition.readout.sleepScore': 'Sleep score',
  'condition.readout.efficiency': 'Efficiency',
  'condition.readout.bedTime': 'Bedtime',
  'condition.readout.wakeTime': 'Wake time',
  'condition.stage.deep': 'Deep',
  'condition.stage.rem': 'REM',
  'condition.stage.light': 'Light',
  'condition.stage.awake': 'Awake',
  'condition.sleepStagesAriaLabel': 'Sleep stages',
  'condition.channelsTitle': 'Recovery channels',
  'condition.channelsSubtitle': 'vs your last {days} days',
  'condition.channelDelta': '{delta} vs {baseline}',
  'condition.batteryPeriod': 'last 24 hours',
  'condition.staleBanner':
    'Garmin has no data newer than {day} — everything below describes that day, not today. Our sync has already pulled everything Garmin has: sync your watch with the Garmin Connect app on your phone.',
  'condition.readyLabel': 'ready',

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
  'sport.other': 'Other',

  /* ------------------------------------------------------------------ *
   * lib/server/analytics — pure compute modules (spec 076 backfill).
   * ------------------------------------------------------------------ */
  'runnerProfile.axis.speed.label': 'Speed',
  'runnerProfile.axis.speed.hint': 'Your best 1 km — what you have over a short stretch.',
  'runnerProfile.axis.tempo.label': 'Tempo',
  'runnerProfile.axis.tempo.hint': 'Your best 5 km — pace around threshold.',
  'runnerProfile.axis.endurance.label': 'Endurance',
  'runnerProfile.axis.endurance.hint': 'Your best long distance: 10 km, half marathon, marathon.',
  'runnerProfile.axis.volume.label': 'Volume',
  'runnerProfile.axis.volume.hint': 'Average weekly distance.',
  'runnerProfile.axis.consistency.label': 'Consistency',
  'runnerProfile.axis.consistency.hint': 'How often and how evenly you run.',

  'runnerProfile.archetype.speedster.label': 'Speedster',
  'runnerProfile.archetype.speedster.summary':
    'Short efforts come easier to you than long ones. You gain the most by adding easy kilometres — a ' +
    'bigger base also lifts your 5 km and 10 km pace.',
  'runnerProfile.archetype.diesel.label': 'Distance runner',
  'runnerProfile.archetype.diesel.summary':
    'You hold pace over the long distance; short efforts are the weaker side. One session of fast ' +
    'reps a week adds speed without touching your volume.',
  'runnerProfile.archetype.grinder.label': 'Mileage machine',
  'runnerProfile.archetype.grinder.summary':
    'Consistency and volume are your foundation — you run steadily and a lot. That is the best possible ' +
    'starting point for working on pace.',
  'runnerProfile.archetype.allrounder.label': 'All-rounder',
  'runnerProfile.archetype.allrounder.summary':
    'No axis stands out: you have speed, distance and consistency alike. Progress will come from ' +
    'choosing a goal, not from patching a gap.',
  'runnerProfile.archetype.beginner.label': 'Just starting',
  'runnerProfile.archetype.beginner.summary':
    'The base is still building, so it is too early for verdicts. Consistency will do more right now ' +
    'than any speed session.',
  'runnerProfile.archetype.unknown.label': 'Not enough data',
  'runnerProfile.archetype.unknown.summary':
    'Not enough synced runs to name your type yet. The radar will fill in on its own as more sessions ' +
    'and longer distances come in.',

  'runnerProfile.distanceName.1k': '1 km',
  'runnerProfile.distanceName.5k': '5 km',
  'runnerProfile.distanceName.10k': '10 km',
  'runnerProfile.distanceName.half': 'half marathon',
  'runnerProfile.distanceName.marathon': 'marathon',

  'runnerProfile.basis.noRunAt': 'no run at {distance}',
  'runnerProfile.basis.bestAt': 'best {distance}',
  'runnerProfile.basis.noLongRun': 'no run of 10 km or longer',
  'runnerProfile.basis.tooShortHistory': 'too little running history (min. {weeks} wk)',
  'runnerProfile.basis.recentWeeks': 'last {weeks} wk',
  'runnerProfile.basis.activeWeeksOfTotal': '{active} of {total} wk with a run',
  'runnerProfile.readout.kmPerWeek': '{value} km/wk',
  'runnerProfile.readout.runsPerWeek': '{value} runs/wk',

  'powerProfile.rider.sprint': 'Sprint (5 s)',
  'powerProfile.rider.punch': 'Punch (1 min)',
  'powerProfile.rider.climb': 'VO2/Climb (5 min)',
  'powerProfile.rider.tt': 'Threshold/TT (20 min)',
  'powerProfile.rider.endurance': 'Endurance (60 min)',

  'powerProfile.zone.recovery': 'Recovery',
  'powerProfile.zone.endurance': 'Endurance',
  'powerProfile.zone.tempo': 'Tempo',
  'powerProfile.zone.threshold': 'Threshold',
  'powerProfile.zone.vo2max': 'VO2max',
  'powerProfile.zone.anaerobic': 'Anaerobic',
  'powerProfile.zone.neuromuscular': 'Neuromuscular',

  'runningProfile.distance.half': 'Half marathon',
  'runningProfile.distance.marathon': 'Marathon',

  'loadRisk.advice.detraining':
    'Load has dropped clearly below what you are trained for. Unless this is a planned taper or ' +
    'illness, get back to regular sessions — aerobic fitness fades faster than it builds.',
  'loadRisk.advice.steady':
    'Last week’s load sits within what you are trained for. This is a range you can safely build in.',
  'loadRisk.advice.building':
    'You are building fitness at a sensible pace — load is rising but not outrunning your base. Keep ' +
    'this direction and mind your recovery weeks.',
  'loadRisk.advice.overreaching':
    'Last week is clearly stronger than your base. One such week is a normal stimulus; two or three in ' +
    'a row is the most common route to an overuse injury.',
  'loadRisk.advice.spike':
    'Load spike: last week far exceeds what you are trained for. The safest move is a lighter week ' +
    'before the normal plan resumes.',
  'loadRisk.advice.notEnoughHistory':
    'Not enough history to judge how fast load is building. About four weeks of continuous data are ' +
    'needed — before that, indicators built on an incomplete base only alarm you.',

  'trainingLoad.recommendation.fresh': 'You are fresh — a good moment for a hard session or a race.',
  'trainingLoad.recommendation.optimal': 'Form is optimal — keep the current training load.',
  'trainingLoad.recommendation.neutral': 'A balance between fatigue and form — continue the current plan.',
  'trainingLoad.recommendation.fatigued': 'Clear fatigue — consider a recovery day or an easier session.',
  'trainingLoad.recommendation.veryFatigued': 'Very high fatigue — schedule rest to avoid overtraining.',
  'trainingLoad.recommendation.noData':
    'Not enough data to judge your form. Sync more sessions with power or heart-rate data.',

  'intensityMix.advice.onModel':
    'The intensity split matches the polarised model — most time easy, the rest genuinely hard. This ' +
    'is the best-documented way to build endurance.',
  'intensityMix.advice.tooHard':
    'Too little of your training is easy. The most common self-coaching mistake: easy runs drift to a ' +
    'medium pace, and hard sessions stop being hard. Slow down the easy sessions instead of cutting them.',
  'intensityMix.advice.tooEasy':
    'Almost all of your training is easy. Your aerobic base is growing, but without regular hard ' +
    'stimulus race pace usually stalls. One or two intense sessions a week is enough.',
  'intensityMix.advice.unknown':
    'Intensity cannot be classified without a max heart rate. Set it in settings, or sync a session ' +
    'with heart-rate data.',

  /* ------------------------------------------------------------------ *
   * Journal — the daily check-in and session RPE (spec 062 / 080)
   * ------------------------------------------------------------------ */
  'journal.checkIn.title': 'How are you feeling today?',
  'journal.checkIn.infoLabel': 'What is this check-in for?',
  'journal.checkIn.why':
    "Your watch can't measure this, and it's the earliest signal you have. Nothing is required — fill in as much as you like.",
  'journal.checkIn.painLabel': 'Pain / soreness',
  'journal.checkIn.painAriaLabel': 'Pain or soreness on a scale of 1–10',
  'journal.checkIn.soreness.1': 'no trace',
  'journal.checkIn.soreness.2': 'barely there',
  'journal.checkIn.soreness.3': 'mild soreness',
  'journal.checkIn.soreness.4': 'noticeable soreness',
  'journal.checkIn.soreness.5': 'every step',
  'journal.checkIn.soreness.6': 'hurts',
  'journal.checkIn.soreness.7': 'hurts a lot',
  'journal.checkIn.soreness.8': 'uphill effort',
  'journal.checkIn.soreness.9': 'barely moving',
  'journal.checkIn.soreness.10': 'can’t move',
  'journal.checkIn.whereLabel': 'Where does it hurt?',
  'journal.checkIn.whereHelp': 'One spot is enough — that is the one that comes back in correlations.',
  'journal.checkIn.wherePlaceholder': 'e.g. left knee',
  'journal.checkIn.moodLabel': 'Mood',
  'journal.checkIn.moodAriaLabel': 'Mood on a scale of 1–10',
  'journal.checkIn.mood.1': 'terrible',
  'journal.checkIn.mood.2': 'very poor',
  'journal.checkIn.mood.3': 'poor',
  'journal.checkIn.mood.4': 'off',
  'journal.checkIn.mood.5': 'average',
  'journal.checkIn.mood.6': 'fine',
  'journal.checkIn.mood.7': 'good',
  'journal.checkIn.mood.8': 'very good',
  'journal.checkIn.mood.9': 'great',
  'journal.checkIn.mood.10': 'best ever',
  'journal.checkIn.illnessLabel': 'Illness',
  'journal.checkIn.injuryLabel': 'Injury',
  'journal.checkIn.noteLabel': 'Note',
  'journal.checkIn.noteHelp': 'Sleep, stress, weather, shoes — anything that explains this day later.',
  'journal.checkIn.notePlaceholder': 'anything worth remembering',
  'journal.checkIn.savedBadge': 'Saved',
  'journal.checkIn.statusDirty': 'Unsaved changes',
  'journal.checkIn.statusSaved': "Today's entry is saved — you can still change it.",
  'journal.checkIn.statusEmpty': 'Nothing saved yet today.',
  'journal.checkIn.saving': 'Saving…',
  'journal.checkIn.toastSaved': 'Saved',
  'journal.checkIn.toastError': 'Could not save the entry',

  'journal.rpe.title': 'How hard was it?',
  'journal.rpe.subtitle': 'RPE — perceived effort, 1–10',
  'journal.rpe.label': 'RPE',
  'journal.rpe.ariaLabel': 'RPE on a scale of 1–10',
  'journal.rpe.hint.1': 'very light',
  'journal.rpe.hint.3': 'light',
  'journal.rpe.hint.5': 'moderate',
  'journal.rpe.hint.7': 'hard',
  'journal.rpe.hint.9': 'very hard',
  'journal.rpe.hint.10': 'maximal',
  'journal.rpe.why':
    'Your call, not the watch’s. A rep that felt like a nine says more than an average heart rate.',
  'journal.rpe.toastRemoved': 'RPE removed',
  'journal.rpe.toastSaved': 'RPE {value} saved',
  'journal.rpe.toastError': 'Could not save RPE',

  'journal.error.expectedJson': 'expected a JSON object',
  'journal.error.dayFormat': 'date must be in YYYY-MM-DD format',
  'journal.error.futureDay': 'cannot log an entry from the future',
  'journal.error.activityIdText': 'activity id must be text',
  'journal.error.numberField': '{label} must be a number',
  'journal.error.integerField': '{label} must be a whole number',
  'journal.error.scoreRange': '{label} must be on a {min}–{max} scale',
  'journal.error.textField': '{label} must be text',
  'journal.error.tooLong': '{label} is too long',
  'journal.error.boolField': '{label} must be true or false',
  'journal.error.emptyEntry': 'an entry must contain at least one field',
  'journal.error.noSuchActivity': 'no such activity',
  'journal.error.activityDayMismatch': 'that activity is from {activityDay}, but the entry is for {entryDay}',
  'journal.error.noSuchEntry': 'no entry with that id',
  'journal.field.rpe': 'RPE',
  'journal.field.soreness': 'pain/soreness',
  'journal.field.mood': 'mood',
  'journal.field.location': 'location',
  'journal.field.note': 'note',
  'journal.field.illness': 'illness',
  'journal.field.injury': 'injury'
};
