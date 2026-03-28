import React, { useEffect, useRef } from 'react';
import {
  createChart, ColorType, CrosshairMode, IChartApi,
  CandlestickSeries, LineSeries, AreaSeries,
} from 'lightweight-charts';
import type { Candle, Indicators, Zone } from '@/hooks/useMarketData';

export interface AITrendline {
  start: { time: number; price: number };
  end: { time: number; price: number };
}

interface TradingChartProps {
  candles: Candle[];
  indicators: Indicators | null;
  zones: Zone[];
  trendline?: AITrendline | null;
  signals?: { time: number; type: 'buy' | 'sell' }[];
  enabledIndicators: string[];
  height?: number;
  label?: string;
}

const TradingChart: React.FC<TradingChartProps> = ({
  candles, indicators, zones, trendline, signals, enabledIndicators, height = 380, label,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* disposed */ }
      chartRef.current = null;
    }
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0f1e' },
        textColor: '#64748b',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.025)' },
        horzLines: { color: 'rgba(255,255,255,0.025)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.08, bottom: 0.15 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // ── Candles ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', downColor: '#EF4444',
      borderUpColor: '#10B981', borderDownColor: '#EF4444',
      wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });
    const chartData = candles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(chartData);

    // ── Bollinger Bands ──
    if (indicators && enabledIndicators.includes('bb_squeeze')) {
      const addBBLine = (values: number[], color: string, lw: 1 | 2 | 3 | 4 = 1) => {
        const s = chart.addSeries(LineSeries, {
          color, lineWidth: lw, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
        const d = values.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
          .filter(p => typeof p.value === 'number' && !isNaN(p.value));
        if (d.length > 0) s.setData(d);
      };
      addBBLine(indicators.bb.upper, 'rgba(6,182,212,0.5)');
      addBBLine(indicators.bb.middle, 'rgba(6,182,212,0.2)');
      addBBLine(indicators.bb.lower, 'rgba(6,182,212,0.5)');
    }

    // ── EMA lines ──
    if (indicators && enabledIndicators.includes('ema_cross')) {
      const addEMA = (values: number[], color: string) => {
        const s = chart.addSeries(LineSeries, {
          color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        });
        const d = values.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
          .filter(p => typeof p.value === 'number' && !isNaN(p.value));
        if (d.length > 0) s.setData(d);
      };
      addEMA(indicators.ema20, '#EC4899');
      addEMA(indicators.ema50, '#8B5CF6');
    }

    // ── AI Support/Resistance ZONES (filled areas) ──
    zones.forEach(zone => {
      const isSupport = zone.type === 'support';
      // Top line
      const topSeries = chart.addSeries(LineSeries, {
        color: isSupport ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
        lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      // Bottom line
      const bottomSeries = chart.addSeries(LineSeries, {
        color: isSupport ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
        lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      // Fill area between
      const fillSeries = chart.addSeries(AreaSeries, {
        topColor: isSupport ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
        bottomColor: isSupport ? 'rgba(16,185,129,0.02)' : 'rgba(239,68,68,0.02)',
        lineColor: 'transparent',
        lineWidth: 1 as 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const start = candles[0].time / 1000;
      const end = candles[candles.length - 1].time / 1000;
      topSeries.setData([
        { time: start as any, value: zone.top },
        { time: end as any, value: zone.top },
      ]);
      bottomSeries.setData([
        { time: start as any, value: zone.bottom },
        { time: end as any, value: zone.bottom },
      ]);
      // Fill mid-area
      const mid = (zone.top + zone.bottom) / 2;
      fillSeries.setData(candles.map(c => ({
        time: (c.time / 1000) as any,
        value: mid,
      })));

      // Label
      candleSeries.createPriceLine({
        price: mid,
        color: isSupport ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
        lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
        title: isSupport ? 'S' : 'R',
      } as any);
    });

    // ── AI Trendline (dashed amber) ──
    if (trendline) {
      const trendSeries = chart.addSeries(LineSeries, {
        color: '#F59E0B', lineWidth: 2, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      trendSeries.setData([
        { time: (trendline.start.time / 1000) as any, value: trendline.start.price },
        { time: (trendline.end.time / 1000) as any, value: trendline.end.price },
      ]);
    }

    // ── Signal arrows ──
    if (signals && signals.length > 0) {
      signals.forEach(s => {
        const candle = candles.find(c => c.time === s.time);
        if (candle) {
          candleSeries.createPriceLine({
            price: candle.close,
            color: s.type === 'buy' ? '#10B981' : '#EF4444',
            lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
            title: s.type === 'buy' ? '🟢 BUY' : '🔴 SELL',
          } as any);
        }
      });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.remove(); } catch { /* disposed */ }
      chartRef.current = null;
    };
  }, [candles, indicators, zones, trendline, signals, enabledIndicators, height]);

  return (
    <div className="relative">
      {label && (
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
          <span className="text-[10px] font-bold text-foreground/60 font-mono tracking-wider uppercase bg-background/80 backdrop-blur px-2 py-0.5 rounded">
            {label}
          </span>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full" style={{ minHeight: height }} />
    </div>
  );
};

export default TradingChart;
