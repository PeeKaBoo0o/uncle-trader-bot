export interface LogicalRangeSnapshot {
  from: number;
  to: number;
}

export const HISTORY_LOAD_TRIGGER_BARS = 25;
const DEFAULT_VISIBLE_BARS = 160;
const LIVE_EDGE_THRESHOLD_BARS = 12;
const LIVE_RIGHT_OFFSET_BARS = 8;

export function getInitialLogicalRange(totalBars: number): LogicalRangeSnapshot {
  const to = Math.max(0, totalBars - 1) + LIVE_RIGHT_OFFSET_BARS;
  const from = Math.max(0, to - DEFAULT_VISIBLE_BARS);

  return { from, to };
}

export function shiftLogicalRange(
  range: LogicalRangeSnapshot,
  shiftByBars: number,
): LogicalRangeSnapshot {
  return {
    from: range.from + shiftByBars,
    to: range.to + shiftByBars,
  };
}

export function isNearRightEdge(
  range: LogicalRangeSnapshot,
  totalBars: number,
  thresholdBars = LIVE_EDGE_THRESHOLD_BARS,
): boolean {
  if (totalBars <= 0) return true;

  const latestLogicalIndex = totalBars - 1;
  return latestLogicalIndex - range.to <= thresholdBars;
}

export function alignRangeToLiveEdge(
  range: LogicalRangeSnapshot,
  totalBars: number,
): LogicalRangeSnapshot {
  const width = Math.max(40, range.to - range.from);
  const to = Math.max(0, totalBars - 1) + LIVE_RIGHT_OFFSET_BARS;

  return {
    from: to - width,
    to,
  };
}