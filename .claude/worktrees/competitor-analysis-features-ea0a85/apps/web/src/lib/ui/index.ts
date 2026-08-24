// OpenVitals shared design system — presentational components + toast store.
// Compose pages from these; never inline bespoke UI (AGENTS.md §6).

export { default as Button } from './Button.svelte';
export { default as Card } from './Card.svelte';
export { default as Input } from './Input.svelte';
export { default as Field } from './Field.svelte';
export { default as Badge } from './Badge.svelte';
export { default as SegmentedControl } from './SegmentedControl.svelte';
export { default as SubNav } from './SubNav.svelte';
export { default as FilterChips } from './FilterChips.svelte';
export { default as Banner } from './Banner.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as Skeleton } from './Skeleton.svelte';
export { default as StatTile } from './StatTile.svelte';
export { default as Icon } from './Icon.svelte';
export { default as IconButton } from './IconButton.svelte';
export { default as InfoPopover } from './InfoPopover.svelte';
export { default as StackedBar } from './StackedBar.svelte';
export { default as Sparkline } from './Sparkline.svelte';
export { default as BarChart } from './BarChart.svelte';
export { default as RadarChart } from './RadarChart.svelte';
export { default as TrendChart } from './TrendChart.svelte';
export { default as ChartTooltip } from './ChartTooltip.svelte';
export { default as ChartLegend } from './ChartLegend.svelte';
export { default as FloatingReadout } from './FloatingReadout.svelte';
export { default as Table } from './Table.svelte';
export { default as Toast } from './Toast.svelte';
export { default as ToastContainer } from './ToastContainer.svelte';
export { default as Spinner } from './Spinner.svelte';
export { default as ThemeToggle } from './ThemeToggle.svelte';
export { default as Toggle } from './Toggle.svelte';
export { default as RankMedal } from './RankMedal.svelte';
export { default as DeltaBadge } from './DeltaBadge.svelte';
export { default as RangeBadge } from './RangeBadge.svelte';
export { default as RangeSwitch } from './RangeSwitch.svelte';
export { default as AppShell } from './AppShell.svelte';
export { default as NavLinks } from './NavLinks.svelte';
export { default as LogoutButton } from './LogoutButton.svelte';
export { default as SidebarToggle } from './SidebarToggle.svelte';

export {
  DEFAULT_SIDEBAR_STATE,
  SIDEBAR_PREF_KEY,
  SIDEBAR_STATES,
  nextSidebarState,
  readSidebarState,
  showsLabels,
  toggleLabel,
  writeSidebarState
} from './sidebar-state';
export type { SidebarState } from './sidebar-state';

export {
  activeIndex,
  bandIndex,
  clampIndex,
  edgeDefinedIndex,
  localX,
  nearestDefinedIndex,
  nearestPointIndex,
  stepDefinedIndex,
  stepIndex,
  tooltipAlign
} from './chart-interaction';
export type { PointAxis, BandAxis, TooltipAlign } from './chart-interaction';
export {
  AXIS_GAP,
  SERIES_COLORS,
  TICK_GAP,
  axisLabelIndices,
  decimalsFor,
  definedMask,
  estimateTextWidth,
  formatTickValue,
  maxTextWidth,
  niceStep,
  niceTicks,
  resolveSeries,
  seriesColor,
  seriesLength,
  textAnchorAt
} from './chart-axis';
export type { ChartSeries, ResolvedSeries } from './chart-axis';
export type { ChartTooltipRow } from './ChartTooltip.svelte';
export type { FloatingReadoutItem } from './FloatingReadout.svelte';
export type { ChartLegendItem } from './ChartLegend.svelte';
export type { FilterChipOption } from './FilterChips.svelte';
export type { StackedBarSegment } from './StackedBar.svelte';
export type { RadarAxis } from './RadarChart.svelte';
export type { DeltaArrow, DeltaDirection } from './DeltaBadge.svelte';
export { readoutStep } from './readout-fit';
export type { ReadoutStep } from './readout-fit';
export { readBoolPref, readEnumPref, writeBoolPref, writePref } from './pref';
export type { PrefStorage } from './pref';
export { ICONS, ICON_NAMES, isIconName } from './icons';
export type { IconGlyph, IconName } from './icons';

export { toasts } from './toast';
export type { Toast as ToastData, ToastTone, ToastOptions, ToastStore } from './toast';
export type { FieldControl } from './Field.svelte';
