import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { Candle, Indicators } from '@/hooks/useMarketData';

interface SubIndicatorsProps {
  candles: Candle[];
  indicators: Indicators | null;
  activeTab: 'rsi' | 'volume' | 'macd';
}

const SubIndicators: React.FC<SubIndicatorsProps> = ({ candles, indicators, activeTab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0 || !indicators) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* already disposed */ }
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0f1e' },
        textColor: '#8892b0',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.02)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, visible: false },
      width: containerRef.current.clientWidth,
      height: 120,
    });

    chartRef.current = chart;

    if (activeTab === 'rsi') {
      const rsiSeries = chart.addSeries(LineSeries, { color: '#A855F7', lineWidth: 2, priceLineVisible: false });
      const data = indicators.rsi
        .map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v }))
        .filter(d => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
      if (data.length > 0) rsiSeries.setData(data);
      rsiSeries.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.4)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' } as any);
      rsiSeries.createPriceLine({ price: 30, color: 'rgba(16,185,129,0.4)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' } as any);
    }

    if (activeTab === 'volume') {
      const volSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      const data = candles.map((c) => ({
        time: (c.time / 1000) as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
      }));
      volSeries.setData(data);
    }

    if (activeTab === 'macd') {
      const macdSeries = chart.addSeries(LineSeries, { color: '#00D4FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const signalSeries = chart.addSeries(LineSeries, { color: '#F97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const histSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });

      const isValid = (v: any) => typeof v === 'number' && !isNaN(v) && v !== null;
      const macdData = indicators.macd.macdLine.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v })).filter(d => isValid(d.value));
      const signalData = indicators.macd.signalLine.map((v, i) => ({ time: (candles[i].time / 1000) as any, value: v })).filter(d => isValid(d.value));
      const histData = indicators.macd.histogram.map((v, i) => ({
        time: (candles[i].time / 1000) as any,
        value: v,
        color: v >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
      })).filter(d => isValid(d.value));

      if (macdData.length) macdSeries.setData(macdData);
      if (signalData.length) signalSeries.setData(signalData);
      if (histData.length) histSeries.setData(histData);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.remove(); } catch { /* already disposed */ }
      chartRef.current = null;
    };
  }, [candles, indicators, activeTab]);

  return <div ref={containerRef} className="w-full" />;
};

export default SubIndicators;
