import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, IChartApi,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { Candle, Indicators, Zone } from '@/hooks/useMarketData';
import { RectanglePrimitive } from '@/lib/chartRectanglePrimitive';
import { computeLiquidityZones } from '@/lib/liquidityHunter';
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
import type { AlphaLHResult } from '@/hooks/useAlphaLH';
import type { AlphaMPResult } from '@/hooks/useAlphaMP';
import {
  alignRangeToLiveEdge,
  getInitialLogicalRange,
  HISTORY_LOAD_TRIGGER_BARS,
  isNearRightEdge,
  shiftLogicalRange,
} from '@/components/indicators/trading-chart/viewport';

export interface AITrendline {
  start: { time: number; price: number };
  end: { time: number; price: number };
}

const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

interface DataSnapshot {
  length: number;
  firstTime: number;
  lastTime: number;
}

interface TradingChartProps {
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
  alphaLHData?: AlphaLHResult | null;
  alphaMPData?: AlphaMPResult | null;
  onLoadMore?: () => void;
}

const TradingChart: React.FC<TradingChartProps> = ({
  candles, indicators, zones, trendline, trendlineResistance, signals, enabledIndicators, height = 380, label, scanning, scanLabel, timeframe, onTimeframeChange, smcAnalysis, alphaNetData, matrixData, engineData, tpSlData, buySellData, oscillatorData, proEmaData, srData, wyckoffData, alphaLHData, alphaMPData, onLoadMore,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  
  const prevCandlesLenRef = useRef<number>(0);
  const visibleRangeRef = useRef<{ from: number; to: number } | null>(null);
  const candlesRef = useRef<Candle[]>(candles);
  const onLoadMoreRef = useRef(onLoadMore);
  const dataSnapshotRef = useRef<DataSnapshot | null>(null);
  const syncingVisibleRangeRef = useRef(false);
  const initialViewportAppliedRef = useRef(false);
  const isFollowingLiveEdgeRef = useRef(true);
  const lastHistoryLoadAtRef = useRef(0);

  const [crosshairData, setCrosshairData] = useState<{
    open: number; high: number; low: number; close: number; time: string; change: number; changePercent: number;
  } | null>(null);

  candlesRef.current = candles;
  onLoadMoreRef.current = onLoadMore;

  // Stable series updates: prepend history, append bars, or update the active bar without rebuilding the chart.
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || candles.length === 0) return;

    const chart = chartRef.current;
    
    const nextSnapshot: DataSnapshot = {
      length: candles.length,
      firstTime: candles[0].time,
      lastTime: candles[candles.length - 1].time,
    };
    const previousSnapshot = dataSnapshotRef.current;
    const currentRange = chart.timeScale().getVisibleLogicalRange();
    const normalizedRange = currentRange
      ? { from: currentRange.from, to: currentRange.to }
      : visibleRangeRef.current;

    const chartData = candles.map((c) => ({
      time: (c.time / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const lastCandle = candles[candles.length - 1];

    const prependedBars = previousSnapshot
      ? candles.findIndex((candle) => candle.time === previousSnapshot.firstTime)
      : 0;
    const didPrependHistory = Boolean(previousSnapshot && prependedBars > 0);
    const didAppendBar = Boolean(previousSnapshot && candles.length > previousSnapshot.length && !didPrependHistory);
    const didReplaceDataset =
      !previousSnapshot ||
      candles.length < previousSnapshot.length ||
      (previousSnapshot.firstTime !== nextSnapshot.firstTime && !didPrependHistory);

    if (didReplaceDataset || didPrependHistory) {
      candleSeriesRef.current.setData(chartData);
      


      if (didPrependHistory && normalizedRange) {
        const shiftedRange = shiftLogicalRange(normalizedRange, prependedBars);
        chart.timeScale().setVisibleLogicalRange(shiftedRange);
        
        visibleRangeRef.current = shiftedRange;
      } else {
        const initialRange = getInitialLogicalRange(candles.length);
        chart.timeScale().setVisibleLogicalRange(initialRange);
        visibleRangeRef.current = initialRange;
        initialViewportAppliedRef.current = true;
        isFollowingLiveEdgeRef.current = true;
      }
    } else {
      candleSeriesRef.current.update({
        time: (lastCandle.time / 1000) as any,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });


      if (!initialViewportAppliedRef.current) {
        const initialRange = getInitialLogicalRange(candles.length);
        chart.timeScale().setVisibleLogicalRange(initialRange);
        
        visibleRangeRef.current = initialRange;
        initialViewportAppliedRef.current = true;
        isFollowingLiveEdgeRef.current = true;
      } else if (didAppendBar && normalizedRange && isFollowingLiveEdgeRef.current) {
        const liveRange = alignRangeToLiveEdge(normalizedRange, candles.length);
        chart.timeScale().setVisibleLogicalRange(liveRange);
        
        visibleRangeRef.current = liveRange;
      }
    }

    prevCandlesLenRef.current = candles.length;
    dataSnapshotRef.current = nextSnapshot;
  }, [candles, indicators]);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Save current visible range before cleanup so user drag position is preserved
    if (chartRef.current) {
      try {
        const currentRange = chartRef.current.timeScale().getVisibleLogicalRange();
        visibleRangeRef.current = currentRange
          ? { from: currentRange.from, to: currentRange.to }
          : null;
      } catch {
        visibleRangeRef.current = null;
      }
    }
    // Cleanup
    if (chartRef.current) { try { chartRef.current.remove(); } catch {} chartRef.current = null; }
    if (!chartContainerRef.current) return;

    const chartBg = '#0b0e11';
    const gridColor = 'rgba(255,255,255,0.025)';
    const borderColor = 'rgba(255,255,255,0.04)';
    const textColor = '#848e9c';

    // ═══════════ MAIN CHART ═══════════
      const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
        fontSize: 11,
      },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(132,142,156,0.3)', width: 1, style: 0, labelBackgroundColor: '#1e2329' },
        horzLine: { color: 'rgba(132,142,156,0.3)', width: 1, style: 0, labelBackgroundColor: '#1e2329' },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.02, bottom: 0.18 },
        textColor: '#848e9c',
        entireTextOnly: true,
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 7,
        minBarSpacing: 3,
        rightOffset: 8,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      width: chartContainerRef.current.clientWidth,
      height,
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;

    // Shared markers array — all indicators push markers here, applied once at the end
    const allMarkers: any[] = [];

    // ── AlphaNet AI: RZ Bands FIRST (so candles draw on top) ──
    if (alphaNetData && enabledIndicators.includes('alphanet')) {
      const toChartPtRZ = (p: { time: number; value: number }) => ({
        time: (p.time / 1000) as any,
        value: p.value,
      });

      const BG = '#0d1117';

      // Bear Zone (upper): up1 → up5 → up9 mask
      if (alphaNetData.rz_up1?.length > 0) {
        const sUp1 = chart.addSeries(AreaSeries, {
          topColor: 'rgba(86,32,45,0.80)', bottomColor: 'rgba(86,32,45,0.80)',
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        sUp1.setData(alphaNetData.rz_up1.map(toChartPtRZ));

        const sUp5 = chart.addSeries(AreaSeries, {
          topColor: 'rgba(63,29,41,0.60)', bottomColor: 'rgba(63,29,41,0.60)',
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        sUp5.setData(alphaNetData.rz_up5.map(toChartPtRZ));

        const sUp9Mask = chart.addSeries(AreaSeries, {
          topColor: BG, bottomColor: BG,
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        sUp9Mask.setData(alphaNetData.rz_up9.map(toChartPtRZ));
      }

      // Bull Zone (lower): lo9 → lo5 → lo1 mask
      if (alphaNetData.rz_lo1?.length > 0) {
        const sLo9 = chart.addSeries(AreaSeries, {
          topColor: 'rgba(17,49,53,0.60)', bottomColor: 'rgba(17,49,53,0.60)',
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        sLo9.setData(alphaNetData.rz_lo9.map(toChartPtRZ));

        const sLo5 = chart.addSeries(AreaSeries, {
          topColor: 'rgba(15,62,63,0.80)', bottomColor: 'rgba(15,62,63,0.80)',
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        sLo5.setData(alphaNetData.rz_lo5.map(toChartPtRZ));

        const sLo1Mask = chart.addSeries(AreaSeries, {
          topColor: BG, bottomColor: BG,
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        sLo1Mask.setData(alphaNetData.rz_lo1.map(toChartPtRZ));
      }

      // Mean line (dashed gray)
      if (alphaNetData.rz_mean?.length > 0) {
        const meanSeries = chart.addSeries(LineSeries, {
          color: 'rgba(255,255,255,0.15)', lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        meanSeries.setData(alphaNetData.rz_mean.map(toChartPtRZ));
      }
    }

    // ── Candles (Binance palette) ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderUpColor: '#0ecb81',
      borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });
    const chartData = candles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(chartData);
    candleSeriesRef.current = candleSeries;

    dataSnapshotRef.current = {
      length: candles.length,
      firstTime: candles[0].time,
      lastTime: candles[candles.length - 1].time,
    };
    prevCandlesLenRef.current = candles.length;


    // ── Bollinger Bands ──
    if (indicators && enabledIndicators.includes('bb_squeeze')) {
      const addBBLine = (values: number[], color: string) => {
        const s = chart.addSeries(LineSeries, {
          color, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        const d = values.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
          .filter(p => typeof p.value === 'number' && !isNaN(p.value));
        if (d.length > 0) s.setData(d);
      };
      addBBLine(indicators.bb.upper, 'rgba(66,165,245,0.3)');
      addBBLine(indicators.bb.lower, 'rgba(66,165,245,0.3)');
    }

    // ── EMA lines ──
    if (indicators && enabledIndicators.includes('ema_cross')) {
      const addEMA = (values: number[], color: string, title: string) => {
        const s = chart.addSeries(LineSeries, {
          color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title,
        });
        const d = values.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
          .filter(p => typeof p.value === 'number' && !isNaN(p.value));
        if (d.length > 0) s.setData(d);
      };
      addEMA(indicators.ema50, '#ab47bc', 'EMA 50');
    }

    // ── Support/Resistance Zones ──
    if (enabledIndicators.includes('confluence') || enabledIndicators.includes('sup_bounce')) {
    zones.forEach(zone => {
      const isSupport = zone.type === 'support';
      const zoneColor = isSupport ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)';
      const lineColor = isSupport ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)';

      [zone.top, zone.bottom].forEach(price => {
        const ls = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        const start = candles[0].time / 1000;
        const end = candles[candles.length - 1].time / 1000;
        ls.setData([{ time: start as any, value: price }, { time: end as any, value: price }]);
      });

      const fillSeries = chart.addSeries(AreaSeries, {
        topColor: zoneColor,
        bottomColor: zoneColor,
        lineColor: 'transparent',
        lineWidth: 1 as 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const mid = (zone.top + zone.bottom) / 2;
      fillSeries.setData(candles.map(c => ({ time: (c.time / 1000) as any, value: mid })));
    });
    }

    // ── AI Trendlines (always render when data available) ──
    if (trendline) {
      const trendSeries = chart.addSeries(LineSeries, {
        color: '#26a69a', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
        title: 'Trend ▲',
      });
      trendSeries.setData([
        { time: (trendline.start.time / 1000) as any, value: trendline.start.price },
        { time: (trendline.end.time / 1000) as any, value: trendline.end.price },
      ]);
    }
    if (trendlineResistance) {
      const resSeries = chart.addSeries(LineSeries, {
        color: '#ef5350', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
        title: 'Trend ▼',
      });
      resSeries.setData([
        { time: (trendlineResistance.start.time / 1000) as any, value: trendlineResistance.start.price },
        { time: (trendlineResistance.end.time / 1000) as any, value: trendlineResistance.end.price },
      ]);
    }

    // ── Liquidity Hunter (current/active only) ──
    if (enabledIndicators.includes('liq_hunter') && candles.length > 20) {
      const { zones: liqZones, grabs, trades } = computeLiquidityZones(candles, 10, 4, 'Wick');

      const setSafeLineData = (
        series: any,
        t1: number,
        v1: number,
        t2: number,
        v2: number,
      ) => {
        if (t1 === t2) {
          series.setData([{ time: t1 as any, value: v2 }]);
          return;
        }
        if (t1 < t2) {
          series.setData([
            { time: t1 as any, value: v1 },
            { time: t2 as any, value: v2 },
          ]);
          return;
        }
        series.setData([
          { time: t2 as any, value: v2 },
          { time: t1 as any, value: v1 },
        ]);
      };

      // Only show the CURRENT trade (last open trade, or last completed + its zones)
      // Filter: keep only the last trade (open or most recent closed)
      const currentTrade = trades.length > 0 ? trades[trades.length - 1] : null;

      // Only show zones related to the current trade context
      const activeZones = currentTrade
        ? liqZones.filter(z => z.endIndex >= currentTrade.grabIndex)
        : liqZones.slice(-2);

      activeZones.forEach(zone => {
        const color = zone.type === 'high'
          ? (zone.swept ? 'rgba(239,83,80,0.65)' : 'rgba(239,83,80,0.3)')
          : (zone.swept ? 'rgba(38,166,154,0.65)' : 'rgba(38,166,154,0.3)');

        const line = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          lineStyle: zone.swept ? 0 : 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const startIdx = Math.max(0, Math.min(zone.startIndex, candles.length - 1));
        const endIdx = Math.max(0, Math.min(zone.endIndex, candles.length - 1));
        const startTime = Math.floor(candles[startIdx].time / 1000);
        const endTime = Math.floor(candles[endIdx].time / 1000);

        setSafeLineData(line, startTime, zone.price, endTime, zone.price);
      });

      // Only show the latest grab
      if (grabs.length > 0) {
        const latestGrab = grabs[grabs.length - 1];
        candleSeries.createPriceLine({
          price: latestGrab.price,
          color: latestGrab.type === 'sellside' ? '#26a69a' : '#ef5350',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: latestGrab.type === 'sellside' ? '● Liq Grab Low' : '● Liq Grab High',
        } as any);
      }

      // Render only the current/last trade
      if (currentTrade) {
        const trade = currentTrade;
        const entryTime = Math.floor(candles[trade.entryIndex].time / 1000);
        const endIdx = trade.exitIndex ?? candles.length - 1;
        const endTime = Math.floor(candles[endIdx].time / 1000);
        const isLong = trade.type === 'Long';

        // Entry label
        candleSeries.createPriceLine({
          price: trade.entryPrice,
          color: isLong ? '#26a69a' : '#ef5350',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: isLong ? '▲ Buy' : '▼ Sell',
        } as any);

        // TP/SL as price axis labels
        candleSeries.createPriceLine({
          price: trade.tp1, color: '#26a69a', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'TP1',
        } as any);
        candleSeries.createPriceLine({
          price: trade.tp2, color: '#26a69a', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'TP2',
        } as any);
        candleSeries.createPriceLine({
          price: trade.tp3, color: '#26a69a', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'TP3',
        } as any);
        candleSeries.createPriceLine({
          price: trade.slTarget, color: '#ef5350', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'SL',
        } as any);

        // Result marker at exit
        if (trade.result && trade.exitPrice !== undefined) {
          const resultColor = trade.result === 'SL' ? '#ef5350' : '#26a69a';
          candleSeries.createPriceLine({
            price: trade.exitPrice,
            color: resultColor,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `✓ ${trade.result}`,
          } as any);
        }
      }
    }

    // ── AI SMC Analysis Overlay ──
    if (smcAnalysis && enabledIndicators.includes('liq_hunter')) {
      const setSafeData = (series: any, t1: number, v1: number, t2: number, v2: number) => {
        if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
        if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
        series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
      };

      // Liquidity Boxes as shaded zones
      smcAnalysis.liquidity_boxes.forEach(box => {
        const isBuyside = box.type === 'Buyside';
        const fillColor = isBuyside ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)';
        const lineColor = isBuyside ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)';
        const startT = Math.floor(box.start_time / 1000);
        const endT = Math.floor(box.end_time / 1000);

        // Top line
        const topLine = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(topLine, startT, box.top_price, endT, box.top_price);

        // Bottom line
        const bottomLine = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(bottomLine, startT, box.bottom_price, endT, box.bottom_price);

        // Fill area
        const fillSeries = chart.addSeries(AreaSeries, {
          topColor: fillColor, bottomColor: fillColor,
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        const mid = (box.top_price + box.bottom_price) / 2;
        const startCandle = candles.find(c => Math.floor(c.time / 1000) >= startT);
        const endCandle = [...candles].reverse().find(c => Math.floor(c.time / 1000) <= endT);
        if (startCandle && endCandle) {
          const fillData = candles
            .filter(c => {
              const t = Math.floor(c.time / 1000);
              return t >= startT && t <= endT;
            })
            .map(c => ({ time: Math.floor(c.time / 1000) as any, value: mid }));
          if (fillData.length > 0) fillSeries.setData(fillData);
        }
      });

      // Trade signal: Entry + TP1/TP2/TP3 + SL
      if (smcAnalysis.trade_signal.has_signal && smcAnalysis.trade_signal.entry_price) {
        const sig = smcAnalysis.trade_signal;
        const isLong = sig.type === 'Long';
        const entryT = Math.floor((sig.entry_time || candles[candles.length - 1].time) / 1000);
        const endT = Math.floor(candles[candles.length - 1].time / 1000);

        // Entry price line
        candleSeries.createPriceLine({
          price: sig.entry_price!,
          color: isLong ? '#26a69a' : '#ef5350',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: isLong ? '▲ AI Buy' : '▼ AI Sell',
        } as any);

        const addTPLine = (price: number | undefined, label: string) => {
          if (!price) return;
          const series = chart.addSeries(LineSeries, {
            color: 'rgba(38,166,154,0.7)', lineWidth: 1, lineStyle: 2,
            priceLineVisible: false, lastValueVisible: false,
          });
          setSafeData(series, entryT, price, endT, price);
          candleSeries.createPriceLine({
            price, color: '#26a69a', lineWidth: 1, lineStyle: 2,
            axisLabelVisible: true, title: label,
          } as any);
        };

        addTPLine(sig.TP1, 'TP1');
        addTPLine(sig.TP2, 'TP2');
        addTPLine(sig.TP3, 'TP3');

        // SL
        if (sig.SL) {
          const slSeries = chart.addSeries(LineSeries, {
            color: 'rgba(239,83,80,0.7)', lineWidth: 1, lineStyle: 2,
            priceLineVisible: false, lastValueVisible: false,
          });
          setSafeData(slSeries, entryT, sig.SL, endT, sig.SL);
          candleSeries.createPriceLine({
            price: sig.SL, color: '#ef5350', lineWidth: 1, lineStyle: 2,
            axisLabelVisible: true, title: 'SL',
          } as any);
        }
      }
    }

    // ── Signal arrows ──
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

    // ── AlphaNet AI: SuperTrend + other overlays (RZ bands already rendered before candles) ──
    if (alphaNetData && enabledIndicators.includes('alphanet')) {
      const toChartPt = (p: { time: number; value: number }) => ({
        time: (p.time / 1000) as any,
        value: p.value,
      });

      // SuperTrend line — split into bull/bear, deduplicated
      if (alphaNetData.supertrend_line?.length > 0) {
        const stData = alphaNetData.supertrend_line;
        const bullPoints: { time: any; value: number }[] = [];
        const bearPoints: { time: any; value: number }[] = [];

        for (let i = 0; i < stData.length; i++) {
          const t = (stData[i].time / 1000) as any;
          const v = stData[i].value;
          const isBull = stData[i].trend === 1;

          if (isBull) {
            bullPoints.push({ time: t, value: v });
          } else {
            bearPoints.push({ time: t, value: v });
          }
        }

        // Deduplicate by time (keep last value for each timestamp)
        const dedup = (pts: { time: any; value: number }[]) => {
          const map = new Map<any, number>();
          pts.forEach(p => map.set(p.time, p.value));
          return Array.from(map.entries())
            .map(([time, value]) => ({ time, value }))
            .sort((a, b) => a.time - b.time);
        };

        const dedupBull = dedup(bullPoints);
        const dedupBear = dedup(bearPoints);

        if (dedupBull.length > 0) {
          const bullST = chart.addSeries(LineSeries, {
            color: '#26a69a', lineWidth: 2, priceLineVisible: false,
            lastValueVisible: false,
          });
          bullST.setData(dedupBull);
        }
        if (dedupBear.length > 0) {
          const bearST = chart.addSeries(LineSeries, {
            color: '#ef5350', lineWidth: 2, priceLineVisible: false,
            lastValueVisible: false,
          });
          bearST.setData(dedupBear);
        }
      }

      // Signal markers — collect into shared array (applied at the end)
      if (alphaNetData.signal_points?.length > 0) {
        alphaNetData.signal_points.forEach(sp => {
          const stars = '★'.repeat(Math.min(sp.strength, 4));
          const isBuy = sp.type === 'BUY';
          const candle = candles.find(c => c.time === sp.time);
          if (!candle) return;
          allMarkers.push({
            time: (sp.time / 1000) as any,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: isBuy ? '#26a69a' : '#ef5350',
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: `AI ${sp.strength}${stars}`,
          });
        });
      }
    }

    // ── Matrix NWE Envelope ──
    if (matrixData && enabledIndicators.includes('matrix')) {
      // Upper band (teal dashed)
      const upperSeries = chart.addSeries(LineSeries, {
        color: '#26a69a', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'NWE Upper',
      });
      const upperData = matrixData.upper.map(p => ({ time: (p.time / 1000) as any, value: p.value }));
      if (upperData.length > 0) upperSeries.setData(upperData);

      // Lower band (red dashed)
      const lowerSeries = chart.addSeries(LineSeries, {
        color: '#ef5350', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'NWE Lower',
      });
      const lowerData = matrixData.lower.map(p => ({ time: (p.time / 1000) as any, value: p.value }));
      if (lowerData.length > 0) lowerSeries.setData(lowerData);

      // Buy/Sell + ▲▼ cross markers — push to shared allMarkers
      if (matrixData.signals.length > 0) {
        matrixData.signals.forEach(sig => {
          if (sig.type === 'sell') {
            allMarkers.push({ time: (sig.time / 1000) as any, position: 'aboveBar' as const, color: '#ef5350', shape: 'arrowDown' as const, text: 'Sell' });
          } else if (sig.type === 'buy') {
            allMarkers.push({ time: (sig.time / 1000) as any, position: 'belowBar' as const, color: '#26a69a', shape: 'arrowUp' as const, text: 'Buy' });
          } else if (sig.type === 'crossDown') {
            allMarkers.push({ time: (sig.time / 1000) as any, position: 'aboveBar' as const, color: '#ef5350', shape: 'arrowDown' as const, text: '▼' });
          } else {
            allMarkers.push({ time: (sig.time / 1000) as any, position: 'belowBar' as const, color: '#26a69a', shape: 'arrowUp' as const, text: '▲' });
          }
        });
      }
    }

    // ── Market Structure Engine ──
    if (engineData && enabledIndicators.includes('engine')) {
      const setSafeDataEng = (series: any, t1: number, v1: number, t2: number, v2: number) => {
        if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
        if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
        series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
      };

      // Order Blocks (rectangle primitives)
      engineData.orderBlocks.forEach(ob => {
        const startT = Math.floor(ob.startTime / 1000);
        const endT = ob.mitigated && ob.mitigatedTime
          ? Math.floor(ob.mitigatedTime / 1000)
          : Math.floor(candles[candles.length - 1].time / 1000);
        if (startT >= endT) return;

        const fillColor = ob.bull
          ? (ob.mitigated ? 'rgba(8,153,129,0.06)' : 'rgba(8,153,129,0.10)')
          : (ob.mitigated ? 'rgba(242,54,69,0.06)' : 'rgba(242,54,69,0.10)');
        const borderClr = ob.bull ? '#089981' : '#f23645';

        const rect = new RectanglePrimitive({
          p1: { time: startT, price: ob.top },
          p2: { time: endT, price: ob.bottom },
          fillColor,
          borderColor: 'transparent',
          borderWidth: 0,
        });
        candleSeries.attachPrimitive(rect);

        // Buy/Sell activity inside OB
        const blT = Math.floor(ob.blPosTime / 1000);
        const brT = Math.floor(ob.brPosTime / 1000);
        if (blT > startT) {
          const buyRect = new RectanglePrimitive({
            p1: { time: startT, price: ob.top },
            p2: { time: Math.min(blT, endT), price: ob.avg },
            fillColor: 'rgba(8,153,129,0.18)',
            borderColor: 'transparent', borderWidth: 0,
          });
          candleSeries.attachPrimitive(buyRect);
        }
        if (brT > startT) {
          const sellRect = new RectanglePrimitive({
            p1: { time: startT, price: ob.avg },
            p2: { time: Math.min(brT, endT), price: ob.bottom },
            fillColor: 'rgba(242,54,69,0.18)',
            borderColor: 'transparent', borderWidth: 0,
          });
          candleSeries.attachPrimitive(sellRect);
        }

        // Mid-line dashed
        const midLine = chart.addSeries(LineSeries, {
          color: `${borderClr}80`, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeDataEng(midLine, startT, ob.avg, endT, ob.avg);
      });

      // FVG zones
      engineData.fvgs.forEach(fvg => {
        const fillColor = fvg.bull ? 'rgba(8,153,129,0.12)' : 'rgba(242,54,69,0.12)';
        const startT = Math.floor(fvg.time / 1000);
        const endT = fvg.mitigated && fvg.mitigatedTime
          ? Math.floor(fvg.mitigatedTime / 1000)
          : Math.floor(candles[candles.length - 1].time / 1000);
        if (startT >= endT) return;

        const rect = new RectanglePrimitive({
          p1: { time: startT, price: fvg.top },
          p2: { time: endT, price: fvg.bottom },
          fillColor,
          borderColor: 'transparent',
          borderWidth: 0,
        });
        candleSeries.attachPrimitive(rect);

        const lineColor = fvg.bull ? 'rgba(8,153,129,0.4)' : 'rgba(242,54,69,0.4)';
        const midLine = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        const mid = (fvg.top + fvg.bottom) / 2;
        setSafeDataEng(midLine, startT, mid, endT, mid);
      });

      // Structure breaks (BOS/CHoCH) — horizontal lines from swing to break
      engineData.structures.slice(-30).forEach(s => {
        const isBull = s.direction === 'bull';
        const color = isBull ? '#089981' : '#f23645';
        const startT = Math.floor(s.x1Time / 1000);
        const endT = Math.floor(s.x2Time / 1000);
        if (startT >= endT) return;

        // line style: solid=0, dashed=2, dotted=3
        const lineStyle = s.lineStyle === 'dotted' ? 3 : (s.lineStyle === 'dashed' ? 2 : 0);
        const line = chart.addSeries(LineSeries, {
          color, lineWidth: 1, lineStyle,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeDataEng(line, startT, s.price, endT, s.price);

        // Label at midpoint of line
        const midTime = Math.floor((s.x1Time + s.x2Time) / 2 / 1000);
        allMarkers.push({
          time: (isBull ? midTime : midTime) as any,
          position: isBull ? 'aboveBar' : 'belowBar',
          color,
          shape: 'circle' as const,
          text: s.label,
        });
      });

      // Trendline zones (support/resistance)
      engineData.trendZones.forEach(zone => {
        const isSup = zone.type === 'support';
        const fillColor = isSup ? 'rgba(0,150,136,0.06)' : 'rgba(244,67,54,0.06)';
        const lineColor = isSup ? 'rgba(0,150,136,0.35)' : 'rgba(244,67,54,0.35)';
        const startT = Math.floor(zone.startTime / 1000);
        const endT = Math.floor(zone.endTime / 1000);
        if (startT >= endT) return;

        const rect = new RectanglePrimitive({
          p1: { time: startT, price: zone.top },
          p2: { time: endT, price: zone.bottom },
          fillColor,
          borderColor: lineColor,
          borderWidth: 1,
        });
        candleSeries.attachPrimitive(rect);
      });
    }

    // ── TP/SL Zones — rectangle primitives matching TradingView fill() ──
    if (tpSlData && enabledIndicators.includes('tp_sl') && tpSlData.barData.length > 0) {
      const tpSlMarkers: any[] = [];

      tpSlData.trades.forEach((trade) => {
        const entryT = Math.floor(trade.entryTime / 1000);
        // Only extend to exitTime if closed; if still open, show up to current bar
        const exitT = trade.exitTime
          ? Math.floor(trade.exitTime / 1000)
          : (trade.result === 'open'
              ? Math.floor(candles[candles.length - 1].time / 1000)
              : entryT); // should not happen, but fallback
        const isLong = trade.type === 'long';

        // Skip rendering if entry and exit are the same (no duration)
        if (entryT >= exitT) return;

        // TP zone rectangle (green, 80% transparent like Pine color.new(green, 80))
        const tpRect = new RectanglePrimitive({
          p1: { time: entryT, price: trade.entryPrice },
          p2: { time: exitT, price: trade.tpPrice },
          fillColor: 'rgba(38,166,154,0.20)',
          borderColor: '#26a69a',
          borderWidth: 1,
        });
        candleSeries.attachPrimitive(tpRect);

        // SL zone rectangle (red, 80% transparent)
        const slRect = new RectanglePrimitive({
          p1: { time: entryT, price: trade.entryPrice },
          p2: { time: exitT, price: trade.slPrice },
          fillColor: 'rgba(239,83,80,0.20)',
          borderColor: '#ef5350',
          borderWidth: 1,
        });
        candleSeries.attachPrimitive(slRect);

        // Entry marker
        tpSlMarkers.push({
          time: entryT as any,
          position: isLong ? 'belowBar' : 'aboveBar',
          color: isLong ? '#26a69a' : '#ef5350',
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: isLong ? 'LONG' : 'SHORT',
        });

        // TP hit marker (purple)
        if (trade.result === 'TP' && trade.exitTime) {
          tpSlMarkers.push({
            time: Math.floor(trade.exitTime / 1000) as any,
            position: isLong ? 'aboveBar' : 'belowBar',
            color: '#9C27B0',
            shape: isLong ? 'arrowDown' : 'arrowUp',
            text: isLong ? 'Long TP' : 'Short TP',
          });
        }
        // SL hit marker (gray)
        if (trade.result === 'SL' && trade.exitTime) {
          tpSlMarkers.push({
            time: Math.floor(trade.exitTime / 1000) as any,
            position: isLong ? 'belowBar' : 'aboveBar',
            color: '#9E9E9E',
            shape: isLong ? 'arrowUp' : 'arrowDown',
            text: isLong ? ' Long SL' : ' Short SL',
          });
        }
      });

      tpSlMarkers.forEach(m => allMarkers.push(m));
    }

    // ── Buy/Sell Signal (Wavy Tunnel + Supertrend) ──
    if (buySellData && enabledIndicators.includes('buy_sell')) {
      const setSafeData = (series: any, t1: number, v1: number, t2: number, v2: number) => {
        if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
        if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
        series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
      };

      // Wavy Tunnel (EMA 34 high/mid/low) - aqua dotted
      const wavyHSeries = chart.addSeries(LineSeries, {
        color: 'rgba(0,188,212,0.4)', lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'W34H',
      });
      const wavyMSeries = chart.addSeries(LineSeries, {
        color: 'rgba(192,192,192,0.35)', lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'W34M',
      });
      const wavyLSeries = chart.addSeries(LineSeries, {
        color: 'rgba(0,188,212,0.4)', lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'W34L',
      });
      const mapTs = (arr: { time: number; value: number }[]) =>
        arr.map(p => ({ time: (p.time / 1000) as any, value: p.value }));
      
      const wH = mapTs(buySellData.wavyHigh);
      const wM = mapTs(buySellData.wavyMid);
      const wL = mapTs(buySellData.wavyLow);
      if (wH.length > 0) wavyHSeries.setData(wH);
      if (wM.length > 0) wavyMSeries.setData(wM);
      if (wL.length > 0) wavyLSeries.setData(wL);

      // Tunnel (EMA 144/169) - purple
      const t1Series = chart.addSeries(LineSeries, {
        color: 'rgba(156,39,176,0.6)', lineWidth: 1, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'T144',
      });
      const t2Series = chart.addSeries(LineSeries, {
        color: 'rgba(156,39,176,0.6)', lineWidth: 2, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'T169',
      });
      const tun1 = mapTs(buySellData.tunnel1);
      const tun2 = mapTs(buySellData.tunnel2);
      if (tun1.length > 0) t1Series.setData(tun1);
      if (tun2.length > 0) t2Series.setData(tun2);

      // Tunnel fill between 144 and 169
      if (tun1.length > 0 && tun2.length > 0) {
        const tunnelFill = chart.addSeries(AreaSeries, {
          topColor: 'rgba(156,39,176,0.06)', bottomColor: 'rgba(156,39,176,0.06)',
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        // Use midpoint of tunnel
        const tunnelMid = tun1.map((p, i) => ({
          time: p.time,
          value: tun2[i] ? (p.value + tun2[i].value) / 2 : p.value,
        }));
        tunnelFill.setData(tunnelMid);
      }

      // Supertrend line (green when bullish, red when bearish)
      const bullST: { time: any; value: number }[] = [];
      const bearST: { time: any; value: number }[] = [];
      buySellData.supertrend.forEach(pt => {
        const t = (pt.time / 1000) as any;
        if (pt.direction === 1) {
          bullST.push({ time: t, value: pt.value });
        } else {
          bearST.push({ time: t, value: pt.value });
        }
      });

      if (bullST.length > 0) {
        const stBullSeries = chart.addSeries(LineSeries, {
          color: '#4CAF50', lineWidth: 2, lineStyle: 0,
          priceLineVisible: false, lastValueVisible: false, title: 'ST ▲',
        });
        stBullSeries.setData(bullST);
      }
      if (bearST.length > 0) {
        const stBearSeries = chart.addSeries(LineSeries, {
          color: '#F44336', lineWidth: 2, lineStyle: 0,
          priceLineVisible: false, lastValueVisible: false, title: 'ST ▼',
        });
        stBearSeries.setData(bearST);
      }

      // Buy/Sell signal markers
      buySellData.signals.forEach(sig => {
        const idx = sig.index;
        if (idx < 0 || idx >= candles.length) return;
        candleSeries.createPriceLine({
          price: sig.price,
          color: sig.type === 'BUY' ? '#4CAF50' : '#F44336',
          lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
          title: sig.type === 'BUY' ? '▲ Buy' : '▼ Sell',
        } as any);
      });
    }

    // ── Oscillator Matrix Buy/Sell + Reversal Signals on price chart ──
    if (oscillatorData && enabledIndicators.includes('oscillator')) {
      // Buy/Sell signals
      oscillatorData.buySellSignals.forEach(sig => {
        if (sig.index < 0 || sig.index >= candles.length) return;
        candleSeries.createPriceLine({
          price: sig.price,
          color: sig.type === 'BUY' ? '#4CAF50' : '#F44336',
          lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
          title: sig.type === 'BUY' ? '▲ OSC Buy' : '▼ OSC Sell',
        } as any);
      });

      // Major reversal signals
      oscillatorData.reversals.filter(r => r.type === 'majorBuy' || r.type === 'majorSell').slice(-5).forEach(rev => {
        if (rev.index < 0 || rev.index >= candles.length) return;
        candleSeries.createPriceLine({
          price: rev.price,
          color: rev.type === 'majorBuy' ? '#089981' : '#f23645',
          lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
          title: rev.type === 'majorBuy' ? '▲ Rev' : '▼ Rev',
        } as any);
      });
    }

    // ── Pro EMA (EMA 20/50/100/200 + Golden/Death Cross) ──
    if (proEmaData && enabledIndicators.includes('pro_ema')) {
      const mapTs = (arr: { time: number; value: number }[]) =>
        arr.map(p => ({ time: (p.time / 1000) as any, value: p.value }));

      // EMA 20 (orange, dotted/circles style)
      const ema20S = chart.addSeries(LineSeries, {
        color: '#FF9800', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'EMA 20',
      });
      const e20 = mapTs(proEmaData.ema20);
      if (e20.length > 0) ema20S.setData(e20);

      // EMA 50 (yellow)
      const ema50S = chart.addSeries(LineSeries, {
        color: '#FFEB3B', lineWidth: 2, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'EMA 50',
      });
      const e50 = mapTs(proEmaData.ema50);
      if (e50.length > 0) ema50S.setData(e50);

      // EMA 100 (teal, dotted)
      const ema100S = chart.addSeries(LineSeries, {
        color: '#009688', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'EMA 100',
      });
      const e100 = mapTs(proEmaData.ema100);
      if (e100.length > 0) ema100S.setData(e100);

      // EMA 200 (purple)
      const ema200S = chart.addSeries(LineSeries, {
        color: '#9C27B0', lineWidth: 2, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'EMA 200',
      });
      const e200 = mapTs(proEmaData.ema200);
      if (e200.length > 0) ema200S.setData(e200);

      // Golden Cross / Death Cross markers
      proEmaData.crosses.forEach(cross => {
        if (cross.index < 0 || cross.index >= candles.length) return;
        candleSeries.createPriceLine({
          price: cross.price,
          color: cross.type === 'golden' ? '#4CAF50' : '#F44336',
          lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
          title: cross.type === 'golden' ? '▲ Golden' : '▼ Death',
        } as any);
      });
    }

    // ── Pro Support/Resistance (S/R Channels + StochRSI signals) ──
    if (srData && enabledIndicators.includes('support_resistance')) {
      const firstT = Math.floor(candles[0].time / 1000);
      const lastT = Math.floor(candles[candles.length - 1].time / 1000);

      // S/R Channel boxes using visible chart range times (must exist on time scale)
      srData.channels.forEach(ch => {
        const fillColor = ch.type === 'resistance' ? 'rgba(239,83,80,0.12)' :
                          ch.type === 'support' ? 'rgba(0,230,118,0.12)' : 'rgba(158,158,158,0.08)';
        const borderColor = ch.type === 'resistance' ? 'rgba(239,83,80,0.5)' :
                            ch.type === 'support' ? 'rgba(0,230,118,0.5)' : 'rgba(158,158,158,0.3)';

        candleSeries.attachPrimitive(new RectanglePrimitive({
          p1: { time: firstT, price: ch.top },
          p2: { time: lastT, price: ch.bottom },
          fillColor, borderColor, borderWidth: 1,
        }));
      });

      // Bar coloring based on StochRSI K value (matching Pine barcolor)
      // K > 70 = red bg, K < 30 = green bg, 50-70 = orange, 30-50 = blue
      const barColors: { time: any; color: string }[] = [];
      srData.stochRsi.forEach(pt => {
        const t = Math.floor(pt.time / 1000) as any;
        if (pt.k > 70) barColors.push({ time: t, color: 'rgba(239,83,80,0.7)' });
        else if (pt.k < 30) barColors.push({ time: t, color: 'rgba(0,230,118,0.7)' });
        else if (pt.k >= 50) barColors.push({ time: t, color: 'rgba(255,152,0,0.6)' });
        else barColors.push({ time: t, color: 'rgba(33,150,243,0.6)' });
      });

      // BUY/SELL signal markers (matching Pine plotshape labelup/labeldown)
      const srMarkers: any[] = [];
      srData.signals.slice(-30).forEach(sig => {
        if (sig.index < 0 || sig.index >= candles.length) return;
        const t = Math.floor(candles[sig.index].time / 1000) as any;
        srMarkers.push({
          time: t,
          position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: sig.type === 'BUY' ? '#00E676' : '#EF5350',
          shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: sig.type,
          size: 1,
        });
      });

      // Broken S/R markers (triangles, last 10)
      srData.broken.slice(-10).forEach(b => {
        if (b.index < 0 || b.index >= candles.length) return;
        const t = Math.floor(candles[b.index].time / 1000) as any;
        srMarkers.push({
          time: t,
          position: b.type === 'resistance_broken' ? 'belowBar' : 'aboveBar',
          color: b.type === 'resistance_broken' ? '#00E676' : '#EF5350',
          shape: b.type === 'resistance_broken' ? 'arrowUp' : 'arrowDown',
          text: b.type === 'resistance_broken' ? 'R▲' : 'S▼',
          size: 0,
        });
      });

      if (srMarkers.length > 0) {
        srMarkers.sort((a: any, b: any) => a.time - b.time);
        createSeriesMarkers(candleSeries, srMarkers);
      }

      // K/D info box as price lines on the right edge
      if (srData.lastK > 0) {
        candleSeries.createPriceLine({
          price: candles[candles.length - 1].close,
          color: 'transparent', lineWidth: 0, lineStyle: 2,
          axisLabelVisible: false,
          title: `K: ${srData.lastK.toFixed(2)}  D: ${srData.lastD.toFixed(2)}`,
        } as any);
      }
    }

    // ── Wyckoff (Accumulation/Distribution boxes + events + BUY/SELL) ──
    if (wyckoffData && enabledIndicators.includes('wyckoff')) {
      // Wyckoff boxes using RectanglePrimitive (matching TradingView look)
      wyckoffData.boxes.forEach(box => {
        const fillColor = box.phase === 'accumulation' ? 'rgba(76,175,79,0.08)' :
                          box.phase === 'distribution' ? 'rgba(255,82,82,0.08)' : 'rgba(120,123,134,0.06)';
        const borderColor = box.phase === 'accumulation' ? 'rgba(76,175,79,0.5)' :
                            box.phase === 'distribution' ? 'rgba(255,82,82,0.5)' : 'rgba(120,123,134,0.35)';

        const startT = Math.floor(box.startTime / 1000);
        const endT = Math.floor(box.endTime / 1000);

        const rect = new RectanglePrimitive({
          p1: { time: startT, price: box.top },
          p2: { time: endT, price: box.bottom },
          fillColor,
          borderColor,
          borderWidth: 1,
        });
        candleSeries.attachPrimitive(rect);

        // Phase label text as a marker at midpoint
        if (box.phase !== 'sideways') {
          const midIdx = Math.floor((box.startIndex + box.endIndex) / 2);
          if (midIdx >= 0 && midIdx < candles.length) {
            allMarkers.push({
              time: (candles[midIdx].time / 1000) as any,
              position: 'inBar' as any,
              color: 'transparent',
              shape: 'square' as any,
              text: box.phase === 'accumulation' ? 'Accumulation' : 'Distribution',
            });
          }
        }
      });

      // Wyckoff events as markers (SC, AR, ST, BC, etc.)
      wyckoffData.events.forEach(evt => {
        if (evt.index < 0 || evt.index >= candles.length) return;
        const isAccum = evt.type === 'accumulation';
        allMarkers.push({
          time: (candles[evt.index].time / 1000) as any,
          position: evt.location === 'below' ? 'belowBar' : 'aboveBar',
          color: isAccum ? '#4CAF50' : '#FF5252',
          shape: evt.location === 'below' ? 'arrowUp' : 'arrowDown',
          text: evt.label,
        });
      });

      // Pivot triangles (orange, non-event pivots)
      wyckoffData.pivots.forEach(pv => {
        if (pv.index < 0 || pv.index >= candles.length) return;
        // Skip pivots that are already Wyckoff events
        const isEvent = wyckoffData.events.some(e => e.index === pv.index);
        if (isEvent) return;
        allMarkers.push({
          time: (candles[pv.index].time / 1000) as any,
          position: pv.direction === 'low' ? 'belowBar' : 'aboveBar',
          color: '#FF9800',
          shape: pv.direction === 'low' ? 'arrowUp' : 'arrowDown',
          text: '',
        });
      });

      // BUY/SELL breakout signals
      wyckoffData.signals.forEach(sig => {
        if (sig.index < 0 || sig.index >= candles.length) return;
        allMarkers.push({
          time: (candles[sig.index].time / 1000) as any,
          position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: sig.type === 'BUY' ? '#CDDC39' : '#FF1744',
          shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: sig.type,
        });
      });
    }

    // ── Alpha LH (Liquidity Hunter from engine) ──
    if (alphaLHData && enabledIndicators.includes('alpha_lh')) {
      const setSafeDataLH = (series: any, t1: number, v1: number, t2: number, v2: number) => {
        if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
        if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
        series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
      };

      // Liquidity zones
      alphaLHData.zones.forEach(zone => {
        const isBuy = zone.side === 'buy';
        const fillColor = isBuy ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)';
        const startT = Math.floor(zone.startTime / 1000);
        const endT = Math.floor(zone.endTime / 1000);
        if (startT >= endT) return;

        const rect = new RectanglePrimitive({
          p1: { time: startT, price: zone.top },
          p2: { time: endT, price: zone.bottom },
          fillColor,
          borderColor: isBuy ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
          borderWidth: 1,
        });
        candleSeries.attachPrimitive(rect);
      });

      // TP/SL level lines
      alphaLHData.lines.forEach(line => {
        const fromT = Math.floor(line.fromTime / 1000);
        const toT = Math.floor(line.toTime / 1000);
        const color = line.type === 'sl' || line.type === 'entry-to-sl'
          ? 'rgba(239,83,80,0.7)'
          : line.type === 'tp1' ? 'rgba(38,166,154,0.5)'
          : line.type === 'tp2' ? 'rgba(38,166,154,0.7)'
          : line.type === 'tp3' ? 'rgba(38,166,154,0.9)'
          : 'rgba(38,166,154,0.6)';
        const series = chart.addSeries(LineSeries, {
          color, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeDataLH(series, fromT, line.price, toT, line.price);
      });

      // Markers (buy, sell, tp, sl, liq grabs)
      alphaLHData.markers.forEach(m => {
        allMarkers.push({
          time: m.time,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text || '',
        });
      });
    }

    // ── Alpha MP (Alpha Net Matrix Pro) ──
    if (alphaMPData && enabledIndicators.includes('alpha_mp')) {
      const toChartTime = (t: number) => t as any;

      // Upper band (cyan dashed) — explicitly on right price scale with candles
      const mpUpperSeries = chart.addSeries(LineSeries, {
        color: '#06B6D4', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'MP Upper',
        priceScaleId: 'right',
      });
      const mpUpperData = alphaMPData.upperSeries
        .filter(p => Number.isFinite(p.value))
        .map(p => ({ time: toChartTime(p.time), value: p.value }));
      if (mpUpperData.length > 0) mpUpperSeries.setData(mpUpperData);

      // Lower band (orange dashed)
      const mpLowerSeries = chart.addSeries(LineSeries, {
        color: '#F97316', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: 'MP Lower',
        priceScaleId: 'right',
      });
      const mpLowerData = alphaMPData.lowerSeries
        .filter(p => Number.isFinite(p.value))
        .map(p => ({ time: toChartTime(p.time), value: p.value }));
      if (mpLowerData.length > 0) mpLowerSeries.setData(mpLowerData);

      // Basis line (white, thin)
      const mpBasisSeries = chart.addSeries(LineSeries, {
        color: 'rgba(255,255,255,0.35)', lineWidth: 1, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'MP Basis',
        priceScaleId: 'right',
      });
      const mpBasisData = alphaMPData.basisSeries
        .filter(p => Number.isFinite(p.value))
        .map(p => ({ time: toChartTime(p.time), value: p.value }));
      if (mpBasisData.length > 0) mpBasisSeries.setData(mpBasisData);

      // Markers (buy, sell, cross-up, cross-down)
      alphaMPData.markers.forEach(m => {
        allMarkers.push({
          time: toChartTime(m.time),
          position: m.position as any,
          color: m.color,
          shape: m.shape as any,
          text: m.text,
        });
      });
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
      const currentCandles = candlesRef.current;
      const last = currentCandles[currentCandles.length - 1];
        if (last) {
          const ch = last.close - last.open;
          setCrosshairData({
            open: last.open, high: last.high, low: last.low, close: last.close,
            time: '',
            change: ch,
            changePercent: last.open ? (ch / last.open) * 100 : 0,
          });
        }
        return;
      }
      const currentCandles = candlesRef.current;
      const idx = currentCandles.findIndex(c => Math.floor(c.time / 1000) === (param.time as number));
      if (idx >= 0) {
        const c = currentCandles[idx];
        const ch = c.close - c.open;
        setCrosshairData({
          open: c.open, high: c.high, low: c.low, close: c.close,
          time: '',
          change: ch,
          changePercent: c.open ? (ch / c.open) * 100 : 0,
        });
      }
    });

    // Apply all collected markers to candle series (one call to avoid overwriting)
    if (allMarkers.length > 0) {
      allMarkers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, allMarkers);
    }

    const initialRange = visibleRangeRef.current ?? getInitialLogicalRange(candles.length);
    chart.timeScale().setVisibleLogicalRange(initialRange);
    visibleRangeRef.current = initialRange;
    initialViewportAppliedRef.current = true;
    isFollowingLiveEdgeRef.current = true;

    // ── Sync time scales ──
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;

      visibleRangeRef.current = { from: range.from, to: range.to };
      isFollowingLiveEdgeRef.current = isNearRightEdge(visibleRangeRef.current, candlesRef.current.length);

      if (range.from <= HISTORY_LOAD_TRIGGER_BARS && onLoadMoreRef.current) {
        const now = Date.now();
        if (now - lastHistoryLoadAtRef.current > 800) {
          lastHistoryLoadAtRef.current = now;
          onLoadMoreRef.current();
        }
      }
    });

    // ── Resize ──
    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      
      dataSnapshotRef.current = null;
      initialViewportAppliedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const lastCandle = candles[candles.length - 1];
  const isUp = crosshairData ? crosshairData.change >= 0 : (lastCandle ? lastCandle.close >= lastCandle.open : true);

  const formatNum = (n: number) => {
    if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
  };

  return (
    <div className="relative bg-[#0b0e11] overflow-hidden">
      {/* ── OHLC Legend Bar (Binance-style) ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0e11]">
        {label && (
          <span className="text-[11px] font-bold text-[#eaecef] font-mono tracking-wide mr-2">{label}</span>
        )}
        {(crosshairData || lastCandle) && (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-[#848e9c]">O</span>
            <span className={isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{formatNum(crosshairData?.open ?? lastCandle?.open ?? 0)}</span>
            <span className="text-[#848e9c]">H</span>
            <span className={isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{formatNum(crosshairData?.high ?? lastCandle?.high ?? 0)}</span>
            <span className="text-[#848e9c]">L</span>
            <span className={isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{formatNum(crosshairData?.low ?? lastCandle?.low ?? 0)}</span>
            <span className="text-[#848e9c]">C</span>
            <span className={`font-bold ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{formatNum(crosshairData?.close ?? lastCandle?.close ?? 0)}</span>
            {crosshairData && (
              <span className={`text-[10px] ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {crosshairData.change >= 0 ? '+' : ''}{formatNum(crosshairData.change)} ({crosshairData.changePercent >= 0 ? '+' : ''}{crosshairData.changePercent.toFixed(2)}%)
              </span>
            )}
          </div>
        )}
        {indicators && (
          <span className="text-[10px] font-mono text-[#42a5f5] ml-1">MA 9</span>
        )}

        {/* ── Timeframe Selector ── */}
        {onTimeframeChange && (
          <div className="ml-auto flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => onTimeframeChange(tf)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-[#fcd535]/10 text-[#fcd535]'
                    : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'
                }`}>
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scan Sweep Overlay ── */}
      {scanning && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#fcd535]/5 to-transparent animate-scan-sweep" />
          <div className="relative bg-[#1e2329]/95 backdrop-blur-sm border border-[#fcd535]/30 rounded px-4 py-2.5 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#fcd535] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-[#fcd535] font-bold">{scanLabel || '🔍 AI đang phân tích...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Chart (Candles + Volume + MA) ── */}
      <div ref={chartContainerRef} className="w-full" style={{ minHeight: height }} />

    </div>
  );
};

export default TradingChart;
