/**
 * BandFill Primitive for lightweight-charts v5
 * Renders a shaded polygon between two price series (upper & lower bands).
 * Suitable for ATR bands, envelopes, EMA clouds, signal zones, etc.
 */

import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

export interface BandPoint {
  time: number;
  upper: number;
  lower: number;
}

export interface BandFillOptions {
  data: BandPoint[];
  fillColor: string;          // e.g. 'rgba(34,197,94,0.15)'
  upperLineColor?: string;
  lowerLineColor?: string;
  lineWidth?: number;
}

class BandFillRenderer {
  private _points: { x: number; yUp: number; yLo: number }[];
  private _opts: BandFillOptions;

  constructor(points: { x: number; yUp: number; yLo: number }[], opts: BandFillOptions) {
    this._points = points;
    this._opts = opts;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx: CanvasRenderingContext2D = scope.context;
      const pts = this._points;
      if (pts.length < 2) return;

      const hRatio = scope.horizontalPixelRatio;
      const vRatio = scope.verticalPixelRatio;

      // Draw filled polygon: upper line forward, lower line backward
      ctx.beginPath();
      ctx.moveTo(pts[0].x * hRatio, pts[0].yUp * vRatio);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * hRatio, pts[i].yUp * vRatio);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        ctx.lineTo(pts[i].x * hRatio, pts[i].yLo * vRatio);
      }
      ctx.closePath();
      ctx.fillStyle = this._opts.fillColor;
      ctx.fill();

      // Optional border lines
      const lw = (this._opts.lineWidth ?? 0) * hRatio;
      if (lw > 0) {
        if (this._opts.upperLineColor) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x * hRatio, pts[0].yUp * vRatio);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * hRatio, pts[i].yUp * vRatio);
          }
          ctx.strokeStyle = this._opts.upperLineColor;
          ctx.lineWidth = lw;
          ctx.stroke();
        }
        if (this._opts.lowerLineColor) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x * hRatio, pts[0].yLo * vRatio);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * hRatio, pts[i].yLo * vRatio);
          }
          ctx.strokeStyle = this._opts.lowerLineColor;
          ctx.lineWidth = lw;
          ctx.stroke();
        }
      }
    });
  }
}

class BandFillPaneView {
  _source: BandFillPrimitive;
  _points: { x: number; yUp: number; yLo: number }[] = [];

  constructor(source: BandFillPrimitive) {
    this._source = source;
  }

  update() {
    const series = this._source._series;
    const chart = this._source._chart;
    if (!series || !chart) return;

    const timeScale = chart.timeScale();
    const data = this._source._options.data;
    const pts: { x: number; yUp: number; yLo: number }[] = [];

    for (const d of data) {
      const x = timeScale.timeToCoordinate(d.time as unknown as Time);
      if (x === null) continue;
      const yUp = series.priceToCoordinate(d.upper);
      const yLo = series.priceToCoordinate(d.lower);
      if (yUp === null || yLo === null) continue;
      pts.push({ x, yUp, yLo });
    }

    this._points = pts;
  }

  renderer() {
    return new BandFillRenderer(this._points, this._source._options);
  }

  zOrder(): 'bottom' {
    return 'bottom';
  }
}

export class BandFillPrimitive {
  _chart: IChartApi | null = null;
  _series: ISeriesApi<any> | null = null;
  _options: BandFillOptions;
  _paneView: BandFillPaneView;
  _requestUpdate?: () => void;

  constructor(options: BandFillOptions) {
    this._options = options;
    this._paneView = new BandFillPaneView(this);
  }

  updateOptions(options: BandFillOptions) {
    this._options = options;
    this._requestUpdate?.();
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

  autoscaleInfo() {
    if (!this._options.data.length) return null;
    let min = Infinity, max = -Infinity;
    for (const d of this._options.data) {
      if (d.upper > max) max = d.upper;
      if (d.lower < min) min = d.lower;
      if (d.upper < min) min = d.upper;
      if (d.lower > max) max = d.lower;
    }
    return { priceRange: { minValue: min, maxValue: max } };
  }
}
