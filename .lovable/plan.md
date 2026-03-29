

## Problem

The RZ bands are overlapping the entire chart because `AreaSeries` in Lightweight Charts fills from the data line **all the way down to the bottom** of the chart. This means:
- Bear zone (upper): red area fills from up1 down to the very bottom, covering everything
- Bull zone (lower): teal area fills from lo9 down to the bottom, creating a massive fill

In the TradingView reference images, the bands are **narrow strips** — color only appears BETWEEN the boundary lines (up1↔up5, up5↔up9, lo9↔lo5, lo5↔lo1).

## Solution: Masking technique

Since Lightweight Charts has no native "fill between two series" feature, we use **stacked AreaSeries with masking** — layering areas where inner layers use the chart background color (`#0d1117`) to "cut off" the fill below them.

### Bear Zone (upper) — 3 layers, rendered in order:
1. **up1** AreaSeries — outer bear color (`#56202d`, 80% opacity) — fills from up1 downward
2. **up5** AreaSeries — inner bear color (`#3f1d29`, 40% opacity) — covers outer color below up5
3. **up9** AreaSeries — **chart background color** (`#0d1117`, fully opaque) — masks everything below up9

Result: outer color visible only between up1↔up5, inner color only between up5↔up9.

### Bull Zone (lower) — 3 layers, rendered in order:
1. **lo9** (highest of lower lines) AreaSeries — inner bull color (`#113135`) — fills from lo9 down
2. **lo5** AreaSeries — outer bull color (`#0f3e3f`) — covers inner below lo5
3. **lo1** (lowest) AreaSeries — **chart background color** — masks everything below lo1

Result: inner color visible only between lo9↔lo5, outer color only between lo5↔lo1.

### File change
- **`src/components/indicators/TradingChart.tsx`** (lines ~486–540): Replace current RZ band rendering with the masking approach described above. Each AreaSeries uses `topColor` and `bottomColor` set to the same solid color, with `lineColor: 'transparent'`. The masking layers use `topColor: '#0d1117'` and `bottomColor: '#0d1117'` to erase the fill below.

### Important details
- Masking layers must be rendered AFTER the colored layers (later series are drawn on top)
- The mean line (dashed) remains unchanged
- No changes needed to the backend edge function or hook — only the chart rendering logic

