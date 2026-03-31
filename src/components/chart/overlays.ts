/**
 * Overlay renderers – extracted from TradingChart.
 * Each function adds series/markers to an existing chart instance.
 * Returns nothing; mutates chart in-place.
 */
import type { IChartApi } from 'lightweight-charts';
import { LineSeries, AreaSeries, HistogramSeries } from 'lightweight-charts';
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
import { RectanglePrimitive } from '@/lib/chartRectanglePrimitive';
import { computeLiquidityZones } from '@/lib/liquidityHunter';
import { CHART_COLORS } from './chartConfig';

// ── Helpers ──
const toT = (ms: number) => (ms / 1000) as any;
const isValid = (v: any) => typeof v === 'number' && !isNaN(v) && v !== null;

function setSafeLineData(series: any, t1: number, v1: number, t2: number, v2: number) {
  if (t1 === t2) { series.setData([{ time: t1 as any, value: v2 }]); return; }
  if (t1 < t2) { series.setData([{ time: t1 as any, value: v1 }, { time: t2 as any, value: v2 }]); return; }
  series.setData([{ time: t2 as any, value: v2 }, { time: t1 as any, value: v1 }]);
}

// ── Base indicators (MA, BB, EMA) ──
export function renderBaseIndicators(
  chart: IChartApi,
  candles: Candle[],
  indicators: Indicators | null,
  enabledIndicators: string[],
) {
  if (!indicators) return;

  // MA 9
  const ma9 = chart.addSeries(LineSeries, {
    color: CHART_COLORS.ma9, lineWidth: 1,
    priceLineVisible: false, lastValueVisible: true, title: 'MA 9',
  });
  const ma9Data = indicators.ema20
    .map((v, i) => ({ time: toT(candles[i].time), value: v }))
    .filter(p => isValid(p.value));
  if (ma9Data.length > 0) ma9.setData(ma9Data);

  // Bollinger Bands
  if (enabledIndicators.includes('bb_squeeze')) {
    [indicators.bb.upper, indicators.bb.lower].forEach(values => {
      const s = chart.addSeries(LineSeries, {
        color: CHART_COLORS.bbBand, lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      const d = values.map((v, i) => ({ time: toT(candles[i].time), value: v })).filter(p => isValid(p.value));
      if (d.length > 0) s.setData(d);
    });
  }

  // EMA 50
  if (enabledIndicators.includes('ema_cross')) {
    const s = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema50, lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false, title: 'EMA 50',
    });
    const d = indicators.ema50.map((v, i) => ({ time: toT(candles[i].time), value: v })).filter(p => isValid(p.value));
    if (d.length > 0) s.setData(d);
  }
}

// ── Support/Resistance Zones ──
export function renderZones(
  chart: IChartApi,
  candles: Candle[],
  zones: Zone[],
  enabledIndicators: string[],
) {
  if (!enabledIndicators.includes('confluence') && !enabledIndicators.includes('sup_bounce')) return;

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
      topColor: zoneColor, bottomColor: zoneColor,
      lineColor: 'transparent', lineWidth: 1 as 1,
      priceLineVisible: false, lastValueVisible: false,
    });
    const mid = (zone.top + zone.bottom) / 2;
    fillSeries.setData(candles.map(c => ({ time: toT(c.time), value: mid })));
  });
}

// ── AlphaNet RZ Bands (rendered BEFORE candles) ──
export function renderAlphaNetBands(
  chart: IChartApi,
  data: AlphaNetData,
) {
  const toP = (p: { time: number; value: number }) => ({ time: toT(p.time), value: p.value });
  const BG = CHART_COLORS.bg;

  if (data.rz_up1?.length > 0) {
    const sUp1 = chart.addSeries(AreaSeries, {
      topColor: 'rgba(86,32,45,0.80)', bottomColor: 'rgba(86,32,45,0.80)',
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    sUp1.setData(data.rz_up1.map(toP));

    const sUp5 = chart.addSeries(AreaSeries, {
      topColor: 'rgba(63,29,41,0.60)', bottomColor: 'rgba(63,29,41,0.60)',
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    sUp5.setData(data.rz_up5.map(toP));

    const sUp9 = chart.addSeries(AreaSeries, {
      topColor: BG, bottomColor: BG,
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    sUp9.setData(data.rz_up9.map(toP));
  }

  if (data.rz_lo1?.length > 0) {
    const sLo9 = chart.addSeries(AreaSeries, {
      topColor: 'rgba(17,49,53,0.60)', bottomColor: 'rgba(17,49,53,0.60)',
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    sLo9.setData(data.rz_lo9.map(toP));

    const sLo5 = chart.addSeries(AreaSeries, {
      topColor: 'rgba(15,62,63,0.80)', bottomColor: 'rgba(15,62,63,0.80)',
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    sLo5.setData(data.rz_lo5.map(toP));

    const sLo1 = chart.addSeries(AreaSeries, {
      topColor: BG, bottomColor: BG,
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    sLo1.setData(data.rz_lo1.map(toP));
  }

  if (data.rz_mean?.length > 0) {
    const mean = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.15)', lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
    });
    mean.setData(data.rz_mean.map(toP));
  }
}

// ── AlphaNet SuperTrend + signals ──
export function renderAlphaNetOverlays(
  chart: IChartApi,
  candles: Candle[],
  data: AlphaNetData,
  markers: any[],
) {
  if (data.supertrend_line?.length > 0) {
    const dedup = (pts: { time: any; value: number }[]) => {
      const map = new Map<any, number>();
      pts.forEach(p => map.set(p.time, p.value));
      return Array.from(map.entries()).map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);
    };

    const bull: { time: any; value: number }[] = [];
    const bear: { time: any; value: number }[] = [];
    data.supertrend_line.forEach(pt => {
      const t = toT(pt.time);
      (pt.trend === 1 ? bull : bear).push({ time: t, value: pt.value });
    });

    if (dedup(bull).length > 0) {
      const s = chart.addSeries(LineSeries, { color: '#26a69a', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      s.setData(dedup(bull));
    }
    if (dedup(bear).length > 0) {
      const s = chart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      s.setData(dedup(bear));
    }
  }

  data.signal_points?.forEach(sp => {
    const isBuy = sp.type === 'BUY';
    const candle = candles.find(c => c.time === sp.time);
    if (!candle) return;
    markers.push({
      time: toT(sp.time),
      position: isBuy ? 'belowBar' : 'aboveBar',
      color: isBuy ? '#26a69a' : '#ef5350',
      shape: isBuy ? 'arrowUp' : 'arrowDown',
      text: `AI ${sp.strength}${'★'.repeat(Math.min(sp.strength, 4))}`,
    });
  });
}

// ── Trendlines ──
export interface AITrendline {
  start: { time: number; price: number };
  end: { time: number; price: number };
}

export function renderTrendlines(
  chart: IChartApi,
  trendline?: AITrendline | null,
  trendlineResistance?: AITrendline | null,
) {
  if (trendline) {
    const s = chart.addSeries(LineSeries, {
      color: '#26a69a', lineWidth: 2, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false, title: 'Trend ▲',
    });
    s.setData([
      { time: toT(trendline.start.time), value: trendline.start.price },
      { time: toT(trendline.end.time), value: trendline.end.price },
    ]);
  }
  if (trendlineResistance) {
    const s = chart.addSeries(LineSeries, {
      color: '#ef5350', lineWidth: 2, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false, title: 'Trend ▼',
    });
    s.setData([
      { time: toT(trendlineResistance.start.time), value: trendlineResistance.start.price },
      { time: toT(trendlineResistance.end.time), value: trendlineResistance.end.price },
    ]);
  }
}

// ── Liquidity Hunter ──
export function renderLiquidityHunter(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
) {
  if (candles.length < 20) return;

  const { zones: liqZones, grabs, trades } = computeLiquidityZones(candles, 10, 4, 'Wick');
  const currentTrade = trades.length > 0 ? trades[trades.length - 1] : null;
  const activeZones = currentTrade
    ? liqZones.filter(z => z.endIndex >= currentTrade.grabIndex)
    : liqZones.slice(-2);

  activeZones.forEach(zone => {
    const color = zone.type === 'high'
      ? (zone.swept ? 'rgba(239,83,80,0.65)' : 'rgba(239,83,80,0.3)')
      : (zone.swept ? 'rgba(38,166,154,0.65)' : 'rgba(38,166,154,0.3)');

    const line = chart.addSeries(LineSeries, {
      color, lineWidth: 1, lineStyle: zone.swept ? 0 : 2,
      priceLineVisible: false, lastValueVisible: false,
    });

    const startIdx = Math.max(0, Math.min(zone.startIndex, candles.length - 1));
    const endIdx = Math.max(0, Math.min(zone.endIndex, candles.length - 1));
    setSafeLineData(line,
      Math.floor(candles[startIdx].time / 1000), zone.price,
      Math.floor(candles[endIdx].time / 1000), zone.price);
  });

  if (grabs.length > 0) {
    const g = grabs[grabs.length - 1];
    candleSeries.createPriceLine({
      price: g.price,
      color: g.type === 'sellside' ? '#26a69a' : '#ef5350',
      lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
      title: g.type === 'sellside' ? '● Liq Grab Low' : '● Liq Grab High',
    } as any);
  }

  if (currentTrade) {
    const trade = currentTrade;
    const isLong = trade.type === 'Long';
    candleSeries.createPriceLine({
      price: trade.entryPrice,
      color: isLong ? '#26a69a' : '#ef5350',
      lineWidth: 2, lineStyle: 0, axisLabelVisible: true,
      title: isLong ? '▲ Buy' : '▼ Sell',
    } as any);

    [
      { price: trade.tp1, title: 'TP1' },
      { price: trade.tp2, title: 'TP2' },
      { price: trade.tp3, title: 'TP3' },
    ].forEach(tp => {
      candleSeries.createPriceLine({
        price: tp.price, color: '#26a69a', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: tp.title,
      } as any);
    });

    candleSeries.createPriceLine({
      price: trade.slTarget, color: '#ef5350', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: 'SL',
    } as any);

    if (trade.result && trade.exitPrice !== undefined) {
      candleSeries.createPriceLine({
        price: trade.exitPrice,
        color: trade.result === 'SL' ? '#ef5350' : '#26a69a',
        lineWidth: 2, lineStyle: 0, axisLabelVisible: true,
        title: `✓ ${trade.result}`,
      } as any);
    }
  }
}

// ── SMC Analysis ──
export function renderSmcAnalysis(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
  smc: SmcAnalysis,
) {
  smc.liquidity_boxes.forEach(box => {
    const isBuyside = box.type === 'Buyside';
    const fillColor = isBuyside ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)';
    const lineColor = isBuyside ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)';
    const startT = Math.floor(box.start_time / 1000);
    const endT = Math.floor(box.end_time / 1000);

    [box.top_price, box.bottom_price].forEach(price => {
      const s = chart.addSeries(LineSeries, {
        color: lineColor, lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      setSafeLineData(s, startT, price, endT, price);
    });

    const fillSeries = chart.addSeries(AreaSeries, {
      topColor: fillColor, bottomColor: fillColor,
      lineColor: 'transparent', lineWidth: 1 as 1,
      priceLineVisible: false, lastValueVisible: false,
    });
    const mid = (box.top_price + box.bottom_price) / 2;
    const fillData = candles
      .filter(c => { const t = Math.floor(c.time / 1000); return t >= startT && t <= endT; })
      .map(c => ({ time: Math.floor(c.time / 1000) as any, value: mid }));
    if (fillData.length > 0) fillSeries.setData(fillData);
  });

  if (smc.trade_signal.has_signal && smc.trade_signal.entry_price) {
    const sig = smc.trade_signal;
    const isLong = sig.type === 'Long';
    const entryT = Math.floor((sig.entry_time || candles[candles.length - 1].time) / 1000);
    const endT = Math.floor(candles[candles.length - 1].time / 1000);

    candleSeries.createPriceLine({
      price: sig.entry_price!,
      color: isLong ? '#26a69a' : '#ef5350',
      lineWidth: 2, lineStyle: 0, axisLabelVisible: true,
      title: isLong ? '▲ AI Buy' : '▼ AI Sell',
    } as any);

    const addTP = (price: number | undefined, label: string) => {
      if (!price) return;
      const s = chart.addSeries(LineSeries, {
        color: 'rgba(38,166,154,0.7)', lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      setSafeLineData(s, entryT, price, endT, price);
      candleSeries.createPriceLine({
        price, color: '#26a69a', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: label,
      } as any);
    };

    addTP(sig.TP1, 'TP1');
    addTP(sig.TP2, 'TP2');
    addTP(sig.TP3, 'TP3');

    if (sig.SL) {
      const slS = chart.addSeries(LineSeries, {
        color: 'rgba(239,83,80,0.7)', lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      setSafeLineData(slS, entryT, sig.SL, endT, sig.SL);
      candleSeries.createPriceLine({
        price: sig.SL, color: '#ef5350', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'SL',
      } as any);
    }
  }
}

// ── Matrix NWE ──
export function renderMatrix(
  chart: IChartApi,
  candles: Candle[],
  data: MatrixData,
  markers: any[],
) {
  const upper = chart.addSeries(LineSeries, {
    color: '#26a69a', lineWidth: 2, lineStyle: 2,
    priceLineVisible: false, lastValueVisible: false, title: 'NWE Upper',
  });
  upper.setData(data.upper.map(p => ({ time: toT(p.time), value: p.value })));

  const lower = chart.addSeries(LineSeries, {
    color: '#ef5350', lineWidth: 2, lineStyle: 2,
    priceLineVisible: false, lastValueVisible: false, title: 'NWE Lower',
  });
  lower.setData(data.lower.map(p => ({ time: toT(p.time), value: p.value })));

  data.signals.forEach(sig => {
    if (sig.type === 'sell') {
      markers.push({ time: toT(sig.time), position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: 'Sell' });
    } else if (sig.type === 'buy') {
      markers.push({ time: toT(sig.time), position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: 'Buy' });
    } else if (sig.type === 'crossDown') {
      markers.push({ time: toT(sig.time), position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: '▼' });
    } else {
      markers.push({ time: toT(sig.time), position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: '▲' });
    }
  });
}

// ── Engine (Order Blocks, FVG, Structure) ──
export function renderEngine(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
  data: EngineData,
  markers: any[],
) {
  data.orderBlocks.forEach(ob => {
    const startT = Math.floor(ob.startTime / 1000);
    const endT = ob.mitigated && ob.mitigatedTime
      ? Math.floor(ob.mitigatedTime / 1000)
      : Math.floor(candles[candles.length - 1].time / 1000);
    if (startT >= endT) return;

    const fillColor = ob.bull
      ? (ob.mitigated ? 'rgba(8,153,129,0.06)' : 'rgba(8,153,129,0.10)')
      : (ob.mitigated ? 'rgba(242,54,69,0.06)' : 'rgba(242,54,69,0.10)');

    candleSeries.attachPrimitive(new RectanglePrimitive({
      p1: { time: startT, price: ob.top },
      p2: { time: endT, price: ob.bottom },
      fillColor, borderColor: 'transparent', borderWidth: 0,
    }));

    const blT = Math.floor(ob.blPosTime / 1000);
    const brT = Math.floor(ob.brPosTime / 1000);
    if (blT > startT) {
      candleSeries.attachPrimitive(new RectanglePrimitive({
        p1: { time: startT, price: ob.top },
        p2: { time: Math.min(blT, endT), price: ob.avg },
        fillColor: 'rgba(8,153,129,0.18)', borderColor: 'transparent', borderWidth: 0,
      }));
    }
    if (brT > startT) {
      candleSeries.attachPrimitive(new RectanglePrimitive({
        p1: { time: startT, price: ob.avg },
        p2: { time: Math.min(brT, endT), price: ob.bottom },
        fillColor: 'rgba(242,54,69,0.18)', borderColor: 'transparent', borderWidth: 0,
      }));
    }

    const midLine = chart.addSeries(LineSeries, {
      color: `${ob.bull ? '#089981' : '#f23645'}80`, lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
    });
    setSafeLineData(midLine, startT, ob.avg, endT, ob.avg);
  });

  data.fvgs.forEach(fvg => {
    const fillColor = fvg.bull ? 'rgba(8,153,129,0.12)' : 'rgba(242,54,69,0.12)';
    const startT = Math.floor(fvg.time / 1000);
    const endT = fvg.mitigated && fvg.mitigatedTime
      ? Math.floor(fvg.mitigatedTime / 1000)
      : Math.floor(candles[candles.length - 1].time / 1000);
    if (startT >= endT) return;

    candleSeries.attachPrimitive(new RectanglePrimitive({
      p1: { time: startT, price: fvg.top },
      p2: { time: endT, price: fvg.bottom },
      fillColor, borderColor: 'transparent', borderWidth: 0,
    }));

    const mid = (fvg.top + fvg.bottom) / 2;
    const lineColor = fvg.bull ? 'rgba(8,153,129,0.4)' : 'rgba(242,54,69,0.4)';
    const midLine = chart.addSeries(LineSeries, {
      color: lineColor, lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
    });
    setSafeLineData(midLine, startT, mid, endT, mid);
  });

  data.structures.slice(-30).forEach(s => {
    const isBull = s.direction === 'bull';
    const color = isBull ? '#089981' : '#f23645';
    const startT = Math.floor(s.x1Time / 1000);
    const endT = Math.floor(s.x2Time / 1000);
    if (startT >= endT) return;

    const lineStyle = s.lineStyle === 'dotted' ? 3 : (s.lineStyle === 'dashed' ? 2 : 0);
    const line = chart.addSeries(LineSeries, {
      color, lineWidth: 1, lineStyle,
      priceLineVisible: false, lastValueVisible: false,
    });
    setSafeLineData(line, startT, s.price, endT, s.price);

    const midTime = Math.floor((s.x1Time + s.x2Time) / 2 / 1000);
    markers.push({
      time: midTime as any,
      position: isBull ? 'aboveBar' : 'belowBar',
      color, shape: 'circle', text: s.label,
    });
  });

  data.trendZones.forEach(zone => {
    const isSup = zone.type === 'support';
    const startT = Math.floor(zone.startTime / 1000);
    const endT = Math.floor(zone.endTime / 1000);
    if (startT >= endT) return;

    candleSeries.attachPrimitive(new RectanglePrimitive({
      p1: { time: startT, price: zone.top },
      p2: { time: endT, price: zone.bottom },
      fillColor: isSup ? 'rgba(0,150,136,0.06)' : 'rgba(244,67,54,0.06)',
      borderColor: isSup ? 'rgba(0,150,136,0.35)' : 'rgba(244,67,54,0.35)',
      borderWidth: 1,
    }));
  });
}

// ── TP/SL Zones ──
export function renderTpSl(
  candleSeries: any,
  candles: Candle[],
  data: TpSlData,
  markers: any[],
) {
  data.trades.forEach(trade => {
    const entryT = Math.floor(trade.entryTime / 1000);
    const exitT = trade.exitTime
      ? Math.floor(trade.exitTime / 1000)
      : (trade.result === 'open' ? Math.floor(candles[candles.length - 1].time / 1000) : entryT);
    const isLong = trade.type === 'long';
    if (entryT >= exitT) return;

    candleSeries.attachPrimitive(new RectanglePrimitive({
      p1: { time: entryT, price: trade.entryPrice },
      p2: { time: exitT, price: trade.tpPrice },
      fillColor: 'rgba(38,166,154,0.20)', borderColor: '#26a69a', borderWidth: 1,
    }));

    candleSeries.attachPrimitive(new RectanglePrimitive({
      p1: { time: entryT, price: trade.entryPrice },
      p2: { time: exitT, price: trade.slPrice },
      fillColor: 'rgba(239,83,80,0.20)', borderColor: '#ef5350', borderWidth: 1,
    }));

    markers.push({
      time: entryT as any,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? '#26a69a' : '#ef5350',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: isLong ? 'LONG' : 'SHORT',
    });

    if (trade.result === 'TP' && trade.exitTime) {
      markers.push({
        time: Math.floor(trade.exitTime / 1000) as any,
        position: isLong ? 'aboveBar' : 'belowBar',
        color: '#9C27B0',
        shape: isLong ? 'arrowDown' : 'arrowUp',
        text: isLong ? 'Long TP' : 'Short TP',
      });
    }
    if (trade.result === 'SL' && trade.exitTime) {
      markers.push({
        time: Math.floor(trade.exitTime / 1000) as any,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: '#9E9E9E',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: isLong ? ' Long SL' : ' Short SL',
      });
    }
  });
}

// ── Buy/Sell Signal (Wavy Tunnel + Supertrend) ──
export function renderBuySell(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
  data: BuySellData,
) {
  const mapTs = (arr: { time: number; value: number }[]) =>
    arr.map(p => ({ time: toT(p.time), value: p.value }));

  // Wavy Tunnel
  const wH = chart.addSeries(LineSeries, { color: 'rgba(0,188,212,0.4)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, title: 'W34H' });
  const wM = chart.addSeries(LineSeries, { color: 'rgba(192,192,192,0.35)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, title: 'W34M' });
  const wL = chart.addSeries(LineSeries, { color: 'rgba(0,188,212,0.4)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, title: 'W34L' });
  const wHD = mapTs(data.wavyHigh), wMD = mapTs(data.wavyMid), wLD = mapTs(data.wavyLow);
  if (wHD.length > 0) wH.setData(wHD);
  if (wMD.length > 0) wM.setData(wMD);
  if (wLD.length > 0) wL.setData(wLD);

  // Tunnel 144/169
  const t1S = chart.addSeries(LineSeries, { color: 'rgba(156,39,176,0.6)', lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, title: 'T144' });
  const t2S = chart.addSeries(LineSeries, { color: 'rgba(156,39,176,0.6)', lineWidth: 2, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, title: 'T169' });
  const tun1 = mapTs(data.tunnel1), tun2 = mapTs(data.tunnel2);
  if (tun1.length > 0) t1S.setData(tun1);
  if (tun2.length > 0) t2S.setData(tun2);

  if (tun1.length > 0 && tun2.length > 0) {
    const fill = chart.addSeries(AreaSeries, {
      topColor: 'rgba(156,39,176,0.06)', bottomColor: 'rgba(156,39,176,0.06)',
      lineColor: 'transparent', lineWidth: 1 as 1, priceLineVisible: false, lastValueVisible: false,
    });
    fill.setData(tun1.map((p, i) => ({ time: p.time, value: tun2[i] ? (p.value + tun2[i].value) / 2 : p.value })));
  }

  // Supertrend
  const bullST: any[] = [], bearST: any[] = [];
  data.supertrend.forEach(pt => {
    const t = toT(pt.time);
    (pt.direction === 1 ? bullST : bearST).push({ time: t, value: pt.value });
  });
  if (bullST.length > 0) {
    const s = chart.addSeries(LineSeries, { color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: 'ST ▲' });
    s.setData(bullST);
  }
  if (bearST.length > 0) {
    const s = chart.addSeries(LineSeries, { color: '#F44336', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: 'ST ▼' });
    s.setData(bearST);
  }

  data.signals.forEach(sig => {
    if (sig.index < 0 || sig.index >= candles.length) return;
    candleSeries.createPriceLine({
      price: sig.price,
      color: sig.type === 'BUY' ? '#4CAF50' : '#F44336',
      lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
      title: sig.type === 'BUY' ? '▲ Buy' : '▼ Sell',
    } as any);
  });
}

// ── Oscillator Matrix overlay ──
export function renderOscillatorOverlay(
  candleSeries: any,
  candles: Candle[],
  data: OscillatorMatrixData,
) {
  data.buySellSignals.forEach(sig => {
    if (sig.index < 0 || sig.index >= candles.length) return;
    candleSeries.createPriceLine({
      price: sig.price,
      color: sig.type === 'BUY' ? '#4CAF50' : '#F44336',
      lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
      title: sig.type === 'BUY' ? '▲ OSC Buy' : '▼ OSC Sell',
    } as any);
  });

  data.reversals.filter(r => r.type === 'majorBuy' || r.type === 'majorSell').slice(-5).forEach(rev => {
    if (rev.index < 0 || rev.index >= candles.length) return;
    candleSeries.createPriceLine({
      price: rev.price,
      color: rev.type === 'majorBuy' ? '#089981' : '#f23645',
      lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
      title: rev.type === 'majorBuy' ? '▲ Rev' : '▼ Rev',
    } as any);
  });
}

// ── Pro EMA ──
export function renderProEma(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
  data: ProEmaData,
) {
  const mapTs = (arr: { time: number; value: number }[]) =>
    arr.map(p => ({ time: toT(p.time), value: p.value }));

  const configs = [
    { data: data.ema20, color: '#FF9800', style: 2, title: 'EMA 20' },
    { data: data.ema50, color: '#FFEB3B', style: 0, title: 'EMA 50' },
    { data: data.ema100, color: '#009688', style: 2, title: 'EMA 100' },
    { data: data.ema200, color: '#9C27B0', style: 0, title: 'EMA 200' },
  ];

  configs.forEach(cfg => {
    const s = chart.addSeries(LineSeries, {
      color: cfg.color, lineWidth: 2, lineStyle: cfg.style,
      priceLineVisible: false, lastValueVisible: false, title: cfg.title,
    });
    const d = mapTs(cfg.data);
    if (d.length > 0) s.setData(d);
  });

  data.crosses.forEach(cross => {
    if (cross.index < 0 || cross.index >= candles.length) return;
    candleSeries.createPriceLine({
      price: cross.price,
      color: cross.type === 'golden' ? '#4CAF50' : '#F44336',
      lineWidth: 1, lineStyle: 0, axisLabelVisible: false,
      title: cross.type === 'golden' ? '▲ Golden' : '▼ Death',
    } as any);
  });
}

// ── Support/Resistance Pro ──
export function renderSupportResistancePro(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
  data: SupportResistanceResult,
  markers: any[],
) {
  const firstT = Math.floor(candles[0].time / 1000);
  const lastT = Math.floor(candles[candles.length - 1].time / 1000);

  data.channels.forEach(ch => {
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

  const srMarkers: any[] = [];
  data.signals.slice(-30).forEach(sig => {
    if (sig.index < 0 || sig.index >= candles.length) return;
    srMarkers.push({
      time: Math.floor(candles[sig.index].time / 1000) as any,
      position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: sig.type === 'BUY' ? '#00E676' : '#EF5350',
      shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: sig.type, size: 1,
    });
  });

  data.broken.slice(-10).forEach(b => {
    if (b.index < 0 || b.index >= candles.length) return;
    srMarkers.push({
      time: Math.floor(candles[b.index].time / 1000) as any,
      position: b.type === 'resistance_broken' ? 'belowBar' : 'aboveBar',
      color: b.type === 'resistance_broken' ? '#00E676' : '#EF5350',
      shape: b.type === 'resistance_broken' ? 'arrowUp' : 'arrowDown',
      text: b.type === 'resistance_broken' ? 'R▲' : 'S▼', size: 0,
    });
  });

  srMarkers.forEach(m => markers.push(m));

  if (data.lastK > 0) {
    candleSeries.createPriceLine({
      price: candles[candles.length - 1].close,
      color: 'transparent', lineWidth: 0, lineStyle: 2,
      axisLabelVisible: false,
      title: `K: ${data.lastK.toFixed(2)}  D: ${data.lastD.toFixed(2)}`,
    } as any);
  }
}

// ── Wyckoff ──
export function renderWyckoff(
  chart: IChartApi,
  candleSeries: any,
  candles: Candle[],
  data: WyckoffResult,
  markers: any[],
) {
  data.boxes.forEach(box => {
    const fillColor = box.phase === 'accumulation' ? 'rgba(76,175,79,0.08)' :
                      box.phase === 'distribution' ? 'rgba(255,82,82,0.08)' : 'rgba(120,123,134,0.06)';
    const borderColor = box.phase === 'accumulation' ? 'rgba(76,175,79,0.5)' :
                        box.phase === 'distribution' ? 'rgba(255,82,82,0.5)' : 'rgba(120,123,134,0.35)';

    candleSeries.attachPrimitive(new RectanglePrimitive({
      p1: { time: Math.floor(box.startTime / 1000), price: box.top },
      p2: { time: Math.floor(box.endTime / 1000), price: box.bottom },
      fillColor, borderColor, borderWidth: 1,
    }));

    if (box.phase !== 'sideways') {
      const midIdx = Math.floor((box.startIndex + box.endIndex) / 2);
      if (midIdx >= 0 && midIdx < candles.length) {
        markers.push({
          time: toT(candles[midIdx].time),
          position: 'inBar' as any, color: 'transparent', shape: 'square' as any,
          text: box.phase === 'accumulation' ? 'Accumulation' : 'Distribution',
        });
      }
    }
  });

  data.events.forEach(evt => {
    if (evt.index < 0 || evt.index >= candles.length) return;
    markers.push({
      time: toT(candles[evt.index].time),
      position: evt.location === 'below' ? 'belowBar' : 'aboveBar',
      color: evt.type === 'accumulation' ? '#4CAF50' : '#FF5252',
      shape: evt.location === 'below' ? 'arrowUp' : 'arrowDown',
      text: evt.label,
    });
  });

  data.pivots.forEach(pv => {
    if (pv.index < 0 || pv.index >= candles.length) return;
    if (data.events.some(e => e.index === pv.index)) return;
    markers.push({
      time: toT(candles[pv.index].time),
      position: pv.direction === 'low' ? 'belowBar' : 'aboveBar',
      color: '#FF9800',
      shape: pv.direction === 'low' ? 'arrowUp' : 'arrowDown',
      text: '',
    });
  });

  data.signals.forEach(sig => {
    if (sig.index < 0 || sig.index >= candles.length) return;
    markers.push({
      time: toT(candles[sig.index].time),
      position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: sig.type === 'BUY' ? '#CDDC39' : '#FF1744',
      shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: sig.type,
    });
  });
}
