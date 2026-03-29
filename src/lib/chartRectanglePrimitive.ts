/**
 * Custom Rectangle Primitive for lightweight-charts v5
 * Draws a filled rectangle between two price levels over a time range.
 * Used to render TP/SL zones matching TradingView's fill() behavior.
 */

import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

interface RectangleOptions {
  p1: { time: number; price: number };
  p2: { time: number; price: number };
  fillColor: string;
  borderColor?: string;
  borderWidth?: number;
}

class RectanglePaneRenderer {
  _p1: { x: number; y: number };
  _p2: { x: number; y: number };
  _fillColor: string;
  _borderColor: string;
  _borderWidth: number;

  constructor(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    fillColor: string,
    borderColor: string,
    borderWidth: number,
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._fillColor = fillColor;
    this._borderColor = borderColor;
    this._borderWidth = borderWidth;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const scaledP1 = {
        x: Math.round(this._p1.x * scope.horizontalPixelRatio),
        y: Math.round(this._p1.y * scope.verticalPixelRatio),
      };
      const scaledP2 = {
        x: Math.round(this._p2.x * scope.horizontalPixelRatio),
        y: Math.round(this._p2.y * scope.verticalPixelRatio),
      };

      const x = Math.min(scaledP1.x, scaledP2.x);
      const y = Math.min(scaledP1.y, scaledP2.y);
      const w = Math.abs(scaledP2.x - scaledP1.x);
      const h = Math.abs(scaledP2.y - scaledP1.y);

      ctx.fillStyle = this._fillColor;
      ctx.fillRect(x, y, w, h);

      if (this._borderWidth > 0 && this._borderColor) {
        ctx.strokeStyle = this._borderColor;
        ctx.lineWidth = this._borderWidth * scope.horizontalPixelRatio;
        ctx.strokeRect(x, y, w, h);
      }
    });
  }
}

class RectanglePaneView {
  _source: RectanglePrimitive;
  _p1: { x: number; y: number } = { x: 0, y: 0 };
  _p2: { x: number; y: number } = { x: 0, y: 0 };

  constructor(source: RectanglePrimitive) {
    this._source = source;
  }

  update() {
    const series = this._source._series;
    const chart = this._source._chart;
    if (!series || !chart) return;

    const timeScale = chart.timeScale();
    const opts = this._source._options;

    const x1 = timeScale.timeToCoordinate(opts.p1.time as unknown as Time);
    const x2 = timeScale.timeToCoordinate(opts.p2.time as unknown as Time);
    const y1 = series.priceToCoordinate(opts.p1.price);
    const y2 = series.priceToCoordinate(opts.p2.price);

    if (x1 === null || x2 === null || y1 === null || y2 === null) return;

    this._p1 = { x: x1, y: y1 };
    this._p2 = { x: x2, y: y2 };
  }

  renderer() {
    return new RectanglePaneRenderer(
      this._p1,
      this._p2,
      this._source._options.fillColor,
      this._source._options.borderColor || 'transparent',
      this._source._options.borderWidth || 0,
    );
  }

  zOrder(): 'bottom' {
    return 'bottom';
  }
}

export class RectanglePrimitive {
  _chart: IChartApi | null = null;
  _series: ISeriesApi<any> | null = null;
  _options: RectangleOptions;
  _paneView: RectanglePaneView;
  _requestUpdate?: () => void;

  constructor(options: RectangleOptions) {
    this._options = options;
    this._paneView = new RectanglePaneView(this);
  }

  attached({ chart, series, requestUpdate }: any) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = undefined;
  }

  updateAllViews() {
    this._paneView.update();
  }

  paneViews() {
    return [this._paneView];
  }

  autoscaleInfo(startTimePoint: any, endTimePoint: any) {
    const opts = this._options;
    const p1Price = opts.p1.price;
    const p2Price = opts.p2.price;
    return {
      priceRange: {
        minValue: Math.min(p1Price, p2Price),
        maxValue: Math.max(p1Price, p2Price),
      },
    };
  }
}
