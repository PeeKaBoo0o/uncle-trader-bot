/**
 * Chart theme & config constants.
 * Single source of truth for all chart styling.
 */
export const CHART_COLORS = {
  bg: '#0d1117',
  grid: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.06)',
  text: '#8b949e',
  crosshair: 'rgba(255,255,255,0.15)',
  crosshairLabel: '#1f2937',
  candleUp: '#26a69a',
  candleDown: '#ef5350',
  volumeUp: 'rgba(38,166,154,0.25)',
  volumeDown: 'rgba(239,83,80,0.25)',
  rsi: '#ab47bc',
  ma9: '#42a5f5',
  bbBand: 'rgba(66,165,245,0.3)',
  ema50: '#ab47bc',
} as const;

export const CHART_FONT = "'JetBrains Mono', monospace";

export interface ChartDimensions {
  mainHeight: number;
  rsiHeight: number;
  barSpacing: number;
  minBarSpacing: number;
  rightOffset: number;
}

export const DEFAULT_DIMENSIONS: ChartDimensions = {
  mainHeight: 380,
  rsiHeight: 100,
  barSpacing: 4,
  minBarSpacing: 2,
  rightOffset: 3,
};
