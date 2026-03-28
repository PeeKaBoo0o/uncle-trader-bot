import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { Candle, Indicators, Zone } from '@/hooks/useMarketData';

interface TradingChartProps {
  candles: Candle[];
  indicators: Indicators | null;
  zones: Zone[];
  signals?: { time: number; type: 'buy' | 'sell' }[];
  enabledIndicators: string[];
}

const TradingChart: React.FC<TradingChartProps> = ({ candles, indicators, zones, signals, enabledIndicators }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0f1e' },
        textColor: '#8892b0',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    const chartData = candles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(chartData);

    // Bollinger Bands
    if (indicators && enabledIndicators.includes('bb_squeeze')) {
      const addLine = (values: number[], color: string) => {
        const series = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const data = values.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v })).filter(d => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
        if (data.length > 0) series.setData(data);
      };
      addLine(indicators.bb.upper, 'rgba(245,158,11,0.4)');
      addLine(indicators.bb.middle, 'rgba(245,158,11,0.2)');
      addLine(indicators.bb.lower, 'rgba(245,158,11,0.4)');
    }

    // EMA lines
    if (indicators && enabledIndicators.includes('ema_cross')) {
      const addEMA = (values: number[], color: string) => {
        const series = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const data = values.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v })).filter(d => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
        if (data.length > 0) series.setData(data);
      };
      addEMA(indicators.ema20, '#EC4899');
      addEMA(indicators.ema50, '#8B5CF6');
    }

    // S/R zones
    zones.forEach(zone => {
      const color = zone.type === 'support' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
      candleSeries.createPriceLine({
        price: (zone.top + zone.bottom) / 2,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: zone.type === 'support' ? 'S' : 'R',
      } as any);
    });

    // Signal markers via price lines (v5 doesn't have setMarkers on typed series)
    if (signals && signals.length > 0) {
      signals.forEach(s => {
        candleSeries.createPriceLine({
          price: candles.find(c => c.time === s.time)?.close ?? 0,
          color: s.type === 'buy' ? '#10B981' : '#EF4444',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: false,
          title: s.type === 'buy' ? '🟢' : '🔴',
        } as any);
      });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [candles, indicators, zones, signals, enabledIndicators]);

  return <div ref={chartContainerRef} className="w-full" style={{ minHeight: 400 }} />;
};

export default TradingChart;
