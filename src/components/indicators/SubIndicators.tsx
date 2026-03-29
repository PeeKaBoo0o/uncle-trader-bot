import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { Candle, Indicators } from '@/hooks/useMarketData';
import type { OscillatorMatrixData } from '@/hooks/useOscillatorMatrix';

interface SubIndicatorsProps {
  candles: Candle[];
  indicators: Indicators | null;
  activeTab: 'rsi' | 'volume' | 'macd';
  oscillatorData?: OscillatorMatrixData | null;
}

const SubIndicators: React.FC<SubIndicatorsProps> = ({ candles, indicators, activeTab, oscillatorData }) => {
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

  // ── Oscillator Matrix Sub-Chart ──
  const oscContainerRef = useRef<HTMLDivElement>(null);
  const oscChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!oscContainerRef.current || !oscillatorData || oscillatorData.oscillator.length === 0) {
      if (oscChartRef.current) {
        try { oscChartRef.current.remove(); } catch {}
        oscChartRef.current = null;
      }
      return;
    }

    if (oscChartRef.current) {
      try { oscChartRef.current.remove(); } catch {}
      oscChartRef.current = null;
    }

    const chart = createChart(oscContainerRef.current, {
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
      width: oscContainerRef.current.clientWidth,
      height: 140,
    });
    oscChartRef.current = chart;

    // Hyper Wave main line (sig)
    const sigSeries = chart.addSeries(LineSeries, {
      color: '#51B155', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: 'Sig',
    });
    const sigData = oscillatorData.oscillator.map(p => ({
      time: (p.time / 1000) as any,
      value: p.sig,
    }));
    if (sigData.length > 0) sigSeries.setData(sigData);

    // Signal line (sgD)
    const sgDSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.3)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'SgD',
    });
    const sgDData = oscillatorData.oscillator.map(p => ({
      time: (p.time / 1000) as any,
      value: p.sgD,
    }));
    if (sgDData.length > 0) sgDSeries.setData(sgDData);

    // Hyper Wave histogram (sig - sgD fill)
    const histSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false, lastValueVisible: false,
    });
    const histData = oscillatorData.oscillator.map(p => ({
      time: (p.time / 1000) as any,
      value: p.sig - p.sgD,
      color: p.sig > p.sgD ? 'rgba(81,177,85,0.3)' : 'rgba(145,0,0,0.3)',
    }));
    if (histData.length > 0) histSeries.setData(histData);

    // Smart Money Flow line
    const mfiSeries = chart.addSeries(LineSeries, {
      color: '#089981', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'MFI',
      priceScaleId: 'mfi',
    });
    chart.priceScale('mfi').applyOptions({
      scaleMargins: { top: 0.6, bottom: 0 },
      borderVisible: false,
    });
    const mfiData = oscillatorData.mfi.map(p => ({
      time: (p.time / 1000) as any,
      value: p.value,
    }));
    if (mfiData.length > 0) mfiSeries.setData(mfiData);

    // Zero line
    sigSeries.createPriceLine({
      price: 0, color: 'rgba(255,255,255,0.15)', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: false, title: '',
    } as any);

    // Threshold lines ±35
    sigSeries.createPriceLine({
      price: 35, color: 'rgba(255,255,255,0.08)', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: false, title: '',
    } as any);
    sigSeries.createPriceLine({
      price: -35, color: 'rgba(255,255,255,0.08)', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: false, title: '',
    } as any);

    // Confluence zones ±55
    sigSeries.createPriceLine({
      price: 55, color: 'rgba(8,153,129,0.25)', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: false, title: '',
    } as any);
    sigSeries.createPriceLine({
      price: -55, color: 'rgba(242,54,69,0.25)', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: false, title: '',
    } as any);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (oscContainerRef.current) chart.applyOptions({ width: oscContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.remove(); } catch {}
      oscChartRef.current = null;
    };
  }, [oscillatorData]);

  return (
    <div>
      <div ref={containerRef} className="w-full" />
      {oscillatorData && oscillatorData.oscillator.length > 0 && (
        <div className="border-t border-white/5">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#0a0f1e]">
            <span className="text-[9px] font-mono text-[#FF5722] font-bold">OSCILLATOR MATRIX</span>
            <span className="text-[9px] font-mono text-muted-foreground/40">
              Sig: {oscillatorData.lastSig.toFixed(1)} | MFI: {oscillatorData.lastMfi.toFixed(1)}
            </span>
          </div>
          <div ref={oscContainerRef} className="w-full" />
        </div>
      )}
    </div>
  );
};

export default SubIndicators;
