import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, IChartApi,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
} from 'lightweight-charts';
import type { Candle, Indicators, Zone } from '@/hooks/useMarketData';
import { computeLiquidityZones } from '@/lib/liquidityHunter';
import type { SmcAnalysis } from '@/hooks/useSmcAnalysis';
import type { AlphaNetData } from '@/hooks/useAlphaNet';
import type { MatrixData } from '@/hooks/useMatrixIndicator';
import type { EngineData } from '@/hooks/useEngineIndicator';
import type { TpSlData } from '@/hooks/useTpSlIndicator';

export interface AITrendline {
  start: { time: number; price: number };
  end: { time: number; price: number };
}

const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

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
}

const TradingChart: React.FC<TradingChartProps> = ({
  candles, indicators, zones, trendline, trendlineResistance, signals, enabledIndicators, height = 380, label, scanning, scanLabel, timeframe, onTimeframeChange, smcAnalysis, alphaNetData, matrixData, engineData, tpSlData,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  const [crosshairData, setCrosshairData] = useState<{
    open: number; high: number; low: number; close: number; time: string; change: number; changePercent: number;
  } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current || candles.length === 0) return;

    // Cleanup
    [chartRef, rsiChartRef].forEach(ref => {
      if (ref.current) { try { ref.current.remove(); } catch {} ref.current = null; }
    });
    if (!chartContainerRef.current || !rsiContainerRef.current) return;

    const chartBg = '#0d1117';
    const gridColor = 'rgba(255,255,255,0.03)';
    const borderColor = 'rgba(255,255,255,0.06)';
    const textColor = '#8b949e';

    // ═══════════ MAIN CHART ═══════════
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 2, labelBackgroundColor: '#1f2937' },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 2, labelBackgroundColor: '#1f2937' },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.05, bottom: 0.2 },
        textColor: '#8b949e',
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 4,
        minBarSpacing: 2,
      },
      width: chartContainerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // ── Candles ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    const chartData = candles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(chartData);

    // ── Volume as histogram overlay (bottom of main chart) ──
    const volSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      borderVisible: false,
    });
    volSeries.setData(candles.map(c => ({
      time: (c.time / 1000) as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)',
    })));

    // ── MA 9 (cyan line like reference) ──
    if (indicators) {
      const ma9Series = chart.addSeries(LineSeries, {
        color: '#42a5f5',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'MA 9',
      });
      const ma9Data = indicators.ema20.map((v, i) => ({
        time: (candles[i].time / 1000) as any,
        value: v,
      })).filter(p => typeof p.value === 'number' && !isNaN(p.value));
      if (ma9Data.length > 0) ma9Series.setData(ma9Data);
    }

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

    // ── AI Trendlines (Support = green dashed, Resistance = red dashed) ──
    if (trendline && enabledIndicators.includes('breakout')) {
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
    if (trendlineResistance && enabledIndicators.includes('breakdown')) {
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

    // ── AlphaNet AI SuperTrend Line ──
    if (alphaNetData && enabledIndicators.includes('alphanet') && alphaNetData.supertrend_line.length > 0) {
      const bullPoints: { time: any; value: number }[] = [];
      const bearPoints: { time: any; value: number }[] = [];

      alphaNetData.supertrend_line.forEach(pt => {
        const t = (pt.time / 1000) as any;
        if (pt.trend === 1) {
          bullPoints.push({ time: t, value: pt.value });
          bearPoints.push({ time: t, value: NaN as any });
        } else {
          bearPoints.push({ time: t, value: pt.value });
          bullPoints.push({ time: t, value: NaN as any });
        }
      });

      // Bullish SuperTrend (green)
      const bullST = chart.addSeries(LineSeries, {
        color: '#26a69a', lineWidth: 2, priceLineVisible: false,
        lastValueVisible: false, title: 'AI ST ▲',
      });
      const validBull = bullPoints.filter(p => !isNaN(p.value));
      if (validBull.length > 0) bullST.setData(validBull);

      // Bearish SuperTrend (red)
      const bearST = chart.addSeries(LineSeries, {
        color: '#ef5350', lineWidth: 2, priceLineVisible: false,
        lastValueVisible: false, title: 'AI ST ▼',
      });
      const validBear = bearPoints.filter(p => !isNaN(p.value));
      if (validBear.length > 0) bearST.setData(validBear);

      // Signal marker
      if (alphaNetData.signal === 'BUY' || alphaNetData.signal === 'SELL') {
        const lastCandle = candles[candles.length - 1];
        if (lastCandle) {
          candleSeries.createPriceLine({
            price: lastCandle.close,
            color: alphaNetData.signal === 'BUY' ? '#26a69a' : '#ef5350',
            lineWidth: 2, lineStyle: 0, axisLabelVisible: true,
            title: alphaNetData.signal === 'BUY' ? '▲ AI BUY' : '▼ AI SELL',
          } as any);
        }
      }
    }

    // ── Matrix NWE Envelope ──
    if (matrixData && enabledIndicators.includes('matrix')) {
      // Upper band (teal)
      const upperSeries = chart.addSeries(LineSeries, {
        color: '#00BCD4', lineWidth: 1, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'NWE Upper',
      });
      const upperData = matrixData.upper.map(p => ({ time: (p.time / 1000) as any, value: p.value }));
      if (upperData.length > 0) upperSeries.setData(upperData);

      // Lower band (red)
      const lowerSeries = chart.addSeries(LineSeries, {
        color: '#ef5350', lineWidth: 1, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, title: 'NWE Lower',
      });
      const lowerData = matrixData.lower.map(p => ({ time: (p.time / 1000) as any, value: p.value }));
      if (lowerData.length > 0) lowerSeries.setData(lowerData);

      // Fill between upper and lower with area series
      const fillUpper = chart.addSeries(AreaSeries, {
        topColor: 'rgba(0,188,212,0.06)', bottomColor: 'transparent',
        lineColor: 'transparent', lineWidth: 1 as 1,
        priceLineVisible: false, lastValueVisible: false,
      });
      if (upperData.length > 0) fillUpper.setData(upperData);

      const fillLower = chart.addSeries(AreaSeries, {
        topColor: 'transparent', bottomColor: 'rgba(239,83,80,0.06)',
        lineColor: 'transparent', lineWidth: 1 as 1,
        priceLineVisible: false, lastValueVisible: false,
      });
      if (lowerData.length > 0) fillLower.setData(lowerData);

      // Buy/Sell signal markers
      matrixData.signals.forEach(sig => {
        candleSeries.createPriceLine({
          price: sig.price,
          color: sig.type === 'buy' ? '#26a69a' : '#ef5350',
          lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
          title: sig.type === 'buy' ? '▲ MX Buy' : '▼ MX Sell',
        } as any);
      });
    }

    // ── Market Structure Engine ──
    if (engineData && enabledIndicators.includes('engine')) {
      const setSafeData = (series: any, t1: number, v1: number, t2: number, v2: number) => {
        if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
        if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
        series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
      };

      // Order Blocks (colored boxes)
      engineData.orderBlocks.forEach(ob => {
        const fillColor = ob.bull
          ? (ob.mitigated ? 'rgba(38,166,154,0.06)' : 'rgba(38,166,154,0.12)')
          : (ob.mitigated ? 'rgba(239,83,80,0.06)' : 'rgba(239,83,80,0.12)');
        const lineColor = ob.bull
          ? (ob.mitigated ? 'rgba(38,166,154,0.2)' : 'rgba(38,166,154,0.5)')
          : (ob.mitigated ? 'rgba(239,83,80,0.2)' : 'rgba(239,83,80,0.5)');
        const startT = Math.floor(ob.startTime / 1000);
        const endT = Math.floor(ob.endTime / 1000);

        // Top & bottom lines
        const topLine = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 0,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(topLine, startT, ob.top, endT, ob.top);

        const botLine = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 0,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(botLine, startT, ob.bottom, endT, ob.bottom);

        // Mid-line dashed
        const midLine = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        const mid = (ob.top + ob.bottom) / 2;
        setSafeData(midLine, startT, mid, endT, mid);

        // Fill
        const fill = chart.addSeries(AreaSeries, {
          topColor: fillColor, bottomColor: fillColor,
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        const fillData = candles
          .filter(c => {
            const t = Math.floor(c.time / 1000);
            return t >= startT && t <= endT;
          })
          .map(c => ({ time: Math.floor(c.time / 1000) as any, value: mid }));
        if (fillData.length > 0) fill.setData(fillData);
      });

      // FVG zones
      engineData.fvgs.forEach(fvg => {
        const color = fvg.bull ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)';
        const lineColor = fvg.bull ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)';
        const startT = Math.floor(fvg.time / 1000);
        const endT = Math.floor(candles[candles.length - 1].time / 1000);

        const topL = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(topL, startT, fvg.top, endT, fvg.top);

        const botL = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(botL, startT, fvg.bottom, endT, fvg.bottom);

        const fillS = chart.addSeries(AreaSeries, {
          topColor: color, bottomColor: color,
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        const mid = (fvg.top + fvg.bottom) / 2;
        const fillData = candles
          .filter(c => Math.floor(c.time / 1000) >= startT && Math.floor(c.time / 1000) <= endT)
          .map(c => ({ time: Math.floor(c.time / 1000) as any, value: mid }));
        if (fillData.length > 0) fillS.setData(fillData);
      });

      // Structure breaks (BOS/CHoCH) as price lines
      engineData.structures.slice(-8).forEach(s => {
        const isBull = s.direction === 'bull';
        candleSeries.createPriceLine({
          price: s.price,
          color: isBull ? '#089981' : '#f23645',
          lineWidth: 1,
          lineStyle: s.type === 'CHoCH' ? 2 : 0,
          axisLabelVisible: false,
          title: `${s.type === 'CHoCH' ? '◆' : '●'} ${s.type}`,
        } as any);
      });

      // Trendline zones (support/resistance)
      engineData.trendZones.forEach(zone => {
        const isSup = zone.type === 'support';
        const color = isSup ? 'rgba(0,150,136,0.08)' : 'rgba(244,67,54,0.08)';
        const lineColor = isSup ? 'rgba(0,150,136,0.35)' : 'rgba(244,67,54,0.35)';
        const startT = Math.floor(zone.startTime / 1000);
        const endT = Math.floor(zone.endTime / 1000);

        const topL = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
          title: isSup ? 'Support' : 'Resistance',
        });
        setSafeData(topL, startT, zone.top, endT, zone.top);

        const botL = chart.addSeries(LineSeries, {
          color: lineColor, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        setSafeData(botL, startT, zone.bottom, endT, zone.bottom);

        const fillS = chart.addSeries(AreaSeries, {
          topColor: color, bottomColor: color,
          lineColor: 'transparent', lineWidth: 1 as 1,
          priceLineVisible: false, lastValueVisible: false,
        });
        const mid = (zone.top + zone.bottom) / 2;
        const fillData = candles
          .filter(c => Math.floor(c.time / 1000) >= startT && Math.floor(c.time / 1000) <= endT)
          .map(c => ({ time: Math.floor(c.time / 1000) as any, value: mid }));
        if (fillData.length > 0) fillS.setData(fillData);
      });
    }

    // ── TP/SL Zones (only show current active trade) ──
    if (tpSlData && enabledIndicators.includes('tp_sl') && tpSlData.activeTrade) {
      const trade = tpSlData.activeTrade;
      const entryT = Math.floor(trade.entryTime / 1000);
      const endT = Math.floor(candles[candles.length - 1].time / 1000);
      const isLong = trade.type === 'long';

      const setSafeData = (series: any, t1: number, v1: number, t2: number, v2: number) => {
        if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
        if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
        series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
      };

      // Entry price label
      candleSeries.createPriceLine({
        price: trade.entryPrice,
        color: isLong ? '#26a69a' : '#ef5350',
        lineWidth: 2, lineStyle: 0, axisLabelVisible: true,
        title: isLong ? '▲ LONG' : '▼ SHORT',
      } as any);

      // TP line (green dashed) with label
      candleSeries.createPriceLine({
        price: trade.tpPrice,
        color: '#4CAF50', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'TP',
      } as any);

      // SL line (red dashed) with label
      candleSeries.createPriceLine({
        price: trade.slPrice,
        color: '#F44336', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'SL',
      } as any);

      // TP fill zone (green)
      const tpFill = chart.addSeries(AreaSeries, {
        topColor: 'rgba(76,175,80,0.08)',
        bottomColor: 'rgba(76,175,80,0.08)',
        lineColor: 'transparent', lineWidth: 1 as 1,
        priceLineVisible: false, lastValueVisible: false,
      });
      const tpMid = (trade.entryPrice + trade.tpPrice) / 2;
      const tpFillData = candles
        .filter(c => { const t = Math.floor(c.time / 1000); return t >= entryT && t <= endT; })
        .map(c => ({ time: Math.floor(c.time / 1000) as any, value: tpMid }));
      if (tpFillData.length > 0) tpFill.setData(tpFillData);

      // SL fill zone (red)
      const slFill = chart.addSeries(AreaSeries, {
        topColor: 'rgba(244,67,54,0.08)',
        bottomColor: 'rgba(244,67,54,0.08)',
        lineColor: 'transparent', lineWidth: 1 as 1,
        priceLineVisible: false, lastValueVisible: false,
      });
      const slMid = (trade.entryPrice + trade.slPrice) / 2;
      const slFillData = candles
        .filter(c => { const t = Math.floor(c.time / 1000); return t >= entryT && t <= endT; })
        .map(c => ({ time: Math.floor(c.time / 1000) as any, value: slMid }));
      if (slFillData.length > 0) slFill.setData(slFillData);
    }

    // ── Crosshair data (OHLC legend) ──
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
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
      const idx = candles.findIndex(c => Math.floor(c.time / 1000) === (param.time as number));
      if (idx >= 0) {
        const c = candles[idx];
        const ch = c.close - c.open;
        setCrosshairData({
          open: c.open, high: c.high, low: c.low, close: c.close,
          time: '',
          change: ch,
          changePercent: c.open ? (ch / c.open) * 100 : 0,
        });
      }
    });

    chart.timeScale().fitContent();

    // ═══════════ RSI CHART (synced) ═══════════
    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
      },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        visible: true,
        rightOffset: 5,
        barSpacing: 8,
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 2, labelBackgroundColor: '#1f2937' },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 2, labelBackgroundColor: '#1f2937' },
      },
      width: rsiContainerRef.current.clientWidth,
      height: 100,
    });
    rsiChartRef.current = rsiChart;

    if (indicators) {
      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: '#ab47bc',
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        title: 'RSI 14',
      });
      const rsiData = indicators.rsi
        .map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
        .filter(d => typeof d.value === 'number' && !isNaN(d.value));
      if (rsiData.length > 0) rsiSeries.setData(rsiData);

      // 70/50/30 lines
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

    // ── Sync time scales ──
    const syncTimeScales = () => {
      const mainRange = chart.timeScale().getVisibleLogicalRange();
      if (mainRange) rsiChart.timeScale().setVisibleLogicalRange(mainRange);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const range = rsiChart.timeScale().getVisibleLogicalRange();
      if (range) chart.timeScale().setVisibleLogicalRange(range);
    });

    // ── Resize ──
    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      if (rsiContainerRef.current) rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.remove(); } catch {}
      try { rsiChart.remove(); } catch {}
      chartRef.current = null;
      rsiChartRef.current = null;
    };
  }, [candles, indicators, zones, trendline, trendlineResistance, signals, enabledIndicators, height, smcAnalysis, alphaNetData, matrixData, engineData, tpSlData]);

  const lastCandle = candles[candles.length - 1];
  const isUp = crosshairData ? crosshairData.change >= 0 : (lastCandle ? lastCandle.close >= lastCandle.open : true);

  const formatNum = (n: number) => {
    if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
  };

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
        {indicators && (
          <span className="text-[10px] font-mono text-[#42a5f5]">MA 9</span>
        )}

        {/* ── Timeframe Selector ── */}
        {onTimeframeChange && (
          <div className="ml-auto flex gap-0.5">
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

      {/* ── Scan Sweep Overlay ── */}
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

      {/* ── Main Chart (Candles + Volume + MA) ── */}
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
};

export default TradingChart;
