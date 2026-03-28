import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, IChartApi,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
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
  trendlineResistance?: AITrendline | null;
  signals?: { time: number; type: 'buy' | 'sell' }[];
  enabledIndicators: string[];
  height?: number;
  label?: string;
  scanning?: boolean;
  scanLabel?: string;
}

const TradingChart: React.FC<TradingChartProps> = ({
  candles, indicators, zones, trendline, trendlineResistance, signals, enabledIndicators, height = 380, label, scanning, scanLabel,
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
        rightOffset: 5,
        barSpacing: 8,
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

    // ── AI Trendlines (Support = green dashed, Resistance = red dashed) ──
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

    // ── Signal arrows ──
    if (signals && signals.length > 0) {
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
  }, [candles, indicators, zones, trendline, signals, enabledIndicators, height]);

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
      </div>

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
