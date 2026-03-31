/**
 * ChartCore — Production-grade candlestick chart module.
 * 
 * Architecture:
 * - Chart lifecycle managed via refs (no full rebuild on tick updates)
 * - Overlay rendering delegated to pure functions in overlays.ts
 * - Exchange-agnostic data interface via OHLCV type
 * - Scroll/zoom state preserved across indicator data refreshes
 * - ResizeObserver for responsive behavior
 */
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  createChart, ColorType, CrosshairMode, IChartApi,
  CandlestickSeries, LineSeries, HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { Candle, Indicators, Zone } from '@/hooks/useMarketData';
import type { SmcAnalysis } from '@/hooks/useSmcAnalysis';
import type { AlphaNetData } from '@/hooks/useAlphaNet';
import type { MatrixData } from '@/hooks/useMatrixIndicator';
import type { EngineData } from '@/hooks/useEngineIndicator';
import type { TpSlData } from '@/hooks/useTpSlIndicator';
import type { BuySellData } from '@/hooks/useBuySellSignal';
import type { OscillatorMatrixData } from '@/hooks/useOscillatorMatrix';
import type { ProEmaData } from '@/hooks/useProEma';
import type { SupportResistanceResult } from '@/hooks/useSupportResistance';
import type { WyckoffResult } from '@/hooks/useWyckoff';
import { CHART_COLORS, CHART_FONT, DEFAULT_DIMENSIONS } from './chartConfig';
import {
  renderBaseIndicators, renderZones, renderTrendlines,
  renderAlphaNetBands, renderAlphaNetOverlays,
  renderLiquidityHunter, renderSmcAnalysis, renderMatrix,
  renderEngine, renderTpSl, renderBuySell, renderOscillatorOverlay,
  renderProEma, renderSupportResistancePro, renderWyckoff,
  type AITrendline,
} from './overlays';

const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

export interface ChartCoreProps {
  candles: Candle[];
  indicators: Indicators | null;
  zones: Zone[];
  trendline?: AITrendline | null;
  trendlineResistance?: AITrendline | null;
  signals?: { time: number; type: 'buy' | 'sell' }[];
  enabledIndicators: string[];
  height?: number;
  label?: string;
  scanning?: boolean;
  scanLabel?: string;
  timeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  smcAnalysis?: SmcAnalysis | null;
  alphaNetData?: AlphaNetData | null;
  matrixData?: MatrixData | null;
  engineData?: EngineData | null;
  tpSlData?: TpSlData | null;
  buySellData?: BuySellData | null;
  oscillatorData?: OscillatorMatrixData | null;
  proEmaData?: ProEmaData | null;
  srData?: SupportResistanceResult | null;
  wyckoffData?: WyckoffResult | null;
  onLoadMore?: () => void;
}

const ChartCore: React.FC<ChartCoreProps> = memo(({
  candles, indicators, zones, trendline, trendlineResistance, signals,
  enabledIndicators, height = DEFAULT_DIMENSIONS.mainHeight, label, scanning, scanLabel,
  timeframe, onTimeframeChange, smcAnalysis, alphaNetData, matrixData, engineData,
  tpSlData, buySellData, oscillatorData, proEmaData, srData, wyckoffData, onLoadMore,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const prevCandlesLenRef = useRef(0);
  // Preserve scroll position across rebuilds
  const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
  const isUserScrolledRef = useRef(false);

  const [crosshairData, setCrosshairData] = useState<{
    open: number; high: number; low: number; close: number;
    time: string; change: number; changePercent: number;
  } | null>(null);

  // ── Real-time tick update (no chart rebuild) ──
  useEffect(() => {
    if (!candleSeriesRef.current || !volSeriesRef.current || candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    try {
      candleSeriesRef.current.update({
        time: (lastCandle.time / 1000) as any,
        open: lastCandle.open, high: lastCandle.high,
        low: lastCandle.low, close: lastCandle.close,
      });
      volSeriesRef.current.update({
        time: (lastCandle.time / 1000) as any,
        value: lastCandle.volume,
        color: lastCandle.close >= lastCandle.open
          ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      });
    } catch { /* rebuild will handle */ }

    if (candles.length !== prevCandlesLenRef.current) {
      prevCandlesLenRef.current = candles.length;
    }
  }, [candles]);

  // ── Full chart build/rebuild ──
  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current || candles.length === 0) return;

    // Save scroll state before teardown
    if (chartRef.current && isUserScrolledRef.current) {
      try {
        const range = chartRef.current.timeScale().getVisibleLogicalRange();
        if (range) savedLogicalRangeRef.current = { from: range.from, to: range.to };
      } catch {}
    }

    // Teardown
    [chartRef, rsiChartRef].forEach(ref => {
      if (ref.current) { try { ref.current.remove(); } catch {} ref.current = null; }
    });
    if (!chartContainerRef.current || !rsiContainerRef.current) return;

    const { bg, grid, border, text, crosshair, crosshairLabel } = CHART_COLORS;

    // ═══════════ MAIN CHART ═══════════
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text,
        fontFamily: CHART_FONT,
        fontSize: 10,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: crosshair, width: 1, style: 2, labelBackgroundColor: crosshairLabel },
        horzLine: { color: crosshair, width: 1, style: 2, labelBackgroundColor: crosshairLabel },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.05, bottom: 0.2 },
        textColor: text,
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: DEFAULT_DIMENSIONS.rightOffset,
        barSpacing: DEFAULT_DIMENSIONS.barSpacing,
        minBarSpacing: DEFAULT_DIMENSIONS.minBarSpacing,
      },
      width: chartContainerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    const allMarkers: any[] = [];

    // ── Pre-candle overlays (AlphaNet bands) ──
    if (alphaNetData && enabledIndicators.includes('alphanet')) {
      renderAlphaNetBands(chart, alphaNetData);
    }

    // ── Candles ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.candleUp,
      downColor: CHART_COLORS.candleDown,
      borderUpColor: CHART_COLORS.candleUp,
      borderDownColor: CHART_COLORS.candleDown,
      wickUpColor: CHART_COLORS.candleUp,
      wickDownColor: CHART_COLORS.candleDown,
    });
    candleSeries.setData(candles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open, high: c.high, low: c.low, close: c.close,
    })));
    candleSeriesRef.current = candleSeries;

    // ── Volume ──
    const volSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false, lastValueVisible: false,
      priceScaleId: 'volume', priceFormat: { type: 'volume' },
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 }, borderVisible: false,
    });
    volSeries.setData(candles.map(c => ({
      time: (c.time / 1000) as any,
      value: c.volume,
      color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
    })));
    volSeriesRef.current = volSeries;
    prevCandlesLenRef.current = candles.length;

    // ── Indicator overlays ──
    renderBaseIndicators(chart, candles, indicators, enabledIndicators);
    renderZones(chart, candles, zones, enabledIndicators);
    renderTrendlines(chart, trendline, trendlineResistance);

    if (enabledIndicators.includes('liq_hunter')) {
      renderLiquidityHunter(chart, candleSeries, candles);
    }

    if (smcAnalysis && enabledIndicators.includes('liq_hunter')) {
      renderSmcAnalysis(chart, candleSeries, candles, smcAnalysis);
    }

    if (signals && signals.length > 0 && enabledIndicators.includes('momentum')) {
      signals.forEach(s => {
        const candle = candles.find(c => c.time === s.time);
        if (candle) {
          candleSeries.createPriceLine({
            price: candle.close,
            color: s.type === 'buy' ? '#26a69a' : '#ef5350',
            lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
            title: s.type === 'buy' ? '▲ BUY' : '▼ SELL',
          } as any);
        }
      });
    }

    if (alphaNetData && enabledIndicators.includes('alphanet')) {
      renderAlphaNetOverlays(chart, candles, alphaNetData, allMarkers);
    }

    if (matrixData && enabledIndicators.includes('matrix')) {
      renderMatrix(chart, candles, matrixData, allMarkers);
    }

    if (engineData && enabledIndicators.includes('engine')) {
      renderEngine(chart, candleSeries, candles, engineData, allMarkers);
    }

    if (tpSlData && enabledIndicators.includes('tp_sl') && tpSlData.barData.length > 0) {
      renderTpSl(candleSeries, candles, tpSlData, allMarkers);
    }

    if (buySellData && enabledIndicators.includes('buy_sell')) {
      renderBuySell(chart, candleSeries, candles, buySellData);
    }

    if (oscillatorData && enabledIndicators.includes('oscillator')) {
      renderOscillatorOverlay(candleSeries, candles, oscillatorData);
    }

    if (proEmaData && enabledIndicators.includes('pro_ema')) {
      renderProEma(chart, candleSeries, candles, proEmaData);
    }

    if (srData && enabledIndicators.includes('support_resistance')) {
      renderSupportResistancePro(chart, candleSeries, candles, srData, allMarkers);
    }

    if (wyckoffData && enabledIndicators.includes('wyckoff')) {
      renderWyckoff(chart, candleSeries, candles, wyckoffData, allMarkers);
    }

    // ── Crosshair ──
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        const last = candles[candles.length - 1];
        if (last) {
          const ch = last.close - last.open;
          setCrosshairData({
            open: last.open, high: last.high, low: last.low, close: last.close,
            time: '', change: ch,
            changePercent: last.open ? (ch / last.open) * 100 : 0,
          });
        }
        return;
      }
      const idx = candles.findIndex(c => Math.floor(c.time / 1000) === (param.time as number));
      if (idx >= 0) {
        const c = candles[idx];
        const ch = c.close - c.open;
        setCrosshairData({
          open: c.open, high: c.high, low: c.low, close: c.close,
          time: '', change: ch,
          changePercent: c.open ? (ch / c.open) * 100 : 0,
        });
      }
    });

    // ── Apply markers ──
    if (allMarkers.length > 0) {
      allMarkers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, allMarkers);
    }

    // ── Scroll restore or fit ──
    if (savedLogicalRangeRef.current && isUserScrolledRef.current) {
      chart.timeScale().setVisibleLogicalRange(savedLogicalRangeRef.current as any);
    } else {
      chart.timeScale().fitContent();
    }

    // Track user scroll
    let scrollTrackTimer: ReturnType<typeof setTimeout>;
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      clearTimeout(scrollTrackTimer);
      scrollTrackTimer = setTimeout(() => {
        isUserScrolledRef.current = true;
        if (range) savedLogicalRangeRef.current = { from: range.from, to: range.to };
      }, 100);

      // Load more history
      if (range && range.from < 10 && onLoadMore) {
        onLoadMore();
      }
    });

    // ═══════════ RSI CHART ═══════════
    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text, fontFamily: CHART_FONT, fontSize: 9,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: {
        borderColor: border, timeVisible: true, visible: true,
        rightOffset: 5, barSpacing: 8,
      },
      crosshair: {
        vertLine: { color: crosshair, width: 1, style: 2, labelBackgroundColor: crosshairLabel },
        horzLine: { color: crosshair, width: 1, style: 2, labelBackgroundColor: crosshairLabel },
      },
      width: rsiContainerRef.current.clientWidth,
      height: DEFAULT_DIMENSIONS.rsiHeight,
    });
    rsiChartRef.current = rsiChart;

    if (indicators) {
      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: CHART_COLORS.rsi, lineWidth: 2,
        priceLineVisible: true, lastValueVisible: true, title: 'RSI 14',
      });
      const rsiData = indicators.rsi
        .map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
        .filter(d => typeof d.value === 'number' && !isNaN(d.value));
      if (rsiData.length > 0) rsiSeries.setData(rsiData);

      [
        { price: 70, color: 'rgba(239,83,80,0.4)' },
        { price: 50, color: 'rgba(255,255,255,0.1)' },
        { price: 30, color: 'rgba(38,166,154,0.4)' },
      ].forEach(line => {
        rsiSeries.createPriceLine({
          price: line.price, color: line.color,
          lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '',
        } as any);
      });
    }

    rsiChart.timeScale().fitContent();

    // Sync timescales
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const range = rsiChart.timeScale().getVisibleLogicalRange();
      if (range) chart.timeScale().setVisibleLogicalRange(range);
    });

    // ── ResizeObserver ──
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      if (rsiContainerRef.current) rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
    });
    if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(scrollTrackTimer);
      try { chart.remove(); } catch {}
      try { rsiChart.remove(); } catch {}
      chartRef.current = null;
      rsiChartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length, indicators, zones, trendline, trendlineResistance, signals, enabledIndicators, height, smcAnalysis, alphaNetData, matrixData, engineData, tpSlData, buySellData, oscillatorData, proEmaData, srData, wyckoffData]);

  // ── Reset scroll state on pair/timeframe change ──
  useEffect(() => {
    isUserScrolledRef.current = false;
    savedLogicalRangeRef.current = null;
  }, [timeframe, label]);

  // ── Render ──
  const lastCandle = candles[candles.length - 1];
  const isUp = crosshairData ? crosshairData.change >= 0 : (lastCandle ? lastCandle.close >= lastCandle.open : true);

  const formatNum = useCallback((n: number) => {
    if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
  }, []);

  return (
    <div className="relative bg-[#0d1117] rounded-xl overflow-hidden border border-foreground/5">
      {/* ── OHLC Legend Bar ── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-foreground/5 bg-[#0d1117]">
        {label && (
          <span className="text-xs font-bold text-foreground font-mono tracking-wide">{label}</span>
        )}
        {(crosshairData || lastCandle) && (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-muted-foreground/60">O</span>
            <span className={isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{formatNum(crosshairData?.open ?? lastCandle?.open ?? 0)}</span>
            <span className="text-muted-foreground/60">H</span>
            <span className={isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{formatNum(crosshairData?.high ?? lastCandle?.high ?? 0)}</span>
            <span className="text-muted-foreground/60">L</span>
            <span className={isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{formatNum(crosshairData?.low ?? lastCandle?.low ?? 0)}</span>
            <span className="text-muted-foreground/60">C</span>
            <span className={`font-bold ${isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{formatNum(crosshairData?.close ?? lastCandle?.close ?? 0)}</span>
            {crosshairData && (
              <span className={`${isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                {crosshairData.change >= 0 ? '+' : ''}{formatNum(crosshairData.change)} ({crosshairData.changePercent >= 0 ? '+' : ''}{crosshairData.changePercent.toFixed(2)}%)
              </span>
            )}
          </div>
        )}
        <div className="flex-1" />
        {timeframe && onTimeframeChange && (
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => onTimeframeChange(tf)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-foreground/5'
                }`}>
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scan Overlay ── */}
      {scanning && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/8 to-transparent animate-scan-sweep" />
          <div className="relative bg-background/90 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2.5 shadow-lg shadow-primary/10">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-primary font-bold">{scanLabel || '🔍 Gemini AI đang phân tích...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Chart ── */}
      <div ref={chartContainerRef} className="w-full" style={{ minHeight: height }} />

      {/* ── RSI Panel ── */}
      <div className="border-t border-foreground/5">
        <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1117]">
          <span className="text-[9px] font-mono text-[#ab47bc] font-bold">RSI 14</span>
          {indicators && indicators.rsi.length > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground">
              {indicators.rsi[indicators.rsi.length - 1]?.toFixed(2)}
            </span>
          )}
        </div>
        <div ref={rsiContainerRef} className="w-full" />
      </div>
    </div>
  );
});

ChartCore.displayName = 'ChartCore';

export default ChartCore;
