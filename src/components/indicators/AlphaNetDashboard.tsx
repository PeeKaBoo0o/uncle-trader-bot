import React from 'react';
import type { AlphaNetData } from '@/hooks/useAlphaNet';

interface Props {
  data: AlphaNetData | null;
  loading: boolean;
  error: string | null;
}

const AlphaNetDashboard: React.FC<Props> = ({ data, loading, error }) => {
  if (loading && !data) {
    return (
      <div className="bg-[#0f1629] border border-white/10 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-muted-foreground/60 font-mono">Đang phân tích...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-[#0f1629] border border-red-500/20 rounded-lg p-3">
        <span className="text-[9px] text-red-400/70 font-mono">⚠️ {error}</span>
      </div>
    );
  }

  if (!data) return null;

  const strengthColor = data.ai_strength > 50 ? 'text-teal-400' : 'text-orange-400';
  const stateColor = data.ai_state === 'TRENDING' ? 'text-teal-400' : 'text-red-400';
  const signalColor = data.signal === 'BUY' ? 'text-teal-400' : data.signal === 'SELL' ? 'text-red-400' : 'text-muted-foreground/60';

  let rzColor = 'text-muted-foreground/60';
  if (data.rz_state.includes('BEAR')) rzColor = 'text-red-400';
  if (data.rz_state.includes('BULL')) rzColor = 'text-teal-400';

  const signalBg = data.signal === 'BUY'
    ? 'bg-teal-400/10 border-teal-400/30'
    : data.signal === 'SELL'
      ? 'bg-red-400/10 border-red-400/30'
      : 'bg-white/5 border-white/10';

  return (
    <div className="bg-[#0f1629] border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-violet-900/40 px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
        <span className="text-[10px] font-bold text-white tracking-wider font-mono">AlphaNet AI</span>
        <span className="text-[9px] text-violet-300/70 font-mono">Pro+</span>
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-1.5">
        <MetricRow label="Algorithm" value={data.algorithm} />
        <MetricRow label="Sensitivity" value={data.sensitivity.toFixed(2)} />
        <MetricRow label="AI Strength" value={`${data.ai_strength}%`} valueClass={strengthColor} />
        <MetricRow label="AI State" value={data.ai_state} valueClass={stateColor} />
        <MetricRow label="RZ State" value={data.rz_state} valueClass={rzColor} />

        {/* Signal badge */}
        {data.signal !== 'HOLD' && (
          <div className={`mt-2 flex items-center justify-center py-1.5 rounded border ${signalBg}`}>
            <span className={`text-[11px] font-bold font-mono ${signalColor}`}>
              {data.signal === 'BUY' ? '▲ BUY SIGNAL' : '▼ SELL SIGNAL'}
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="px-3 pb-2">
          <div className="h-0.5 bg-violet-500/20 rounded overflow-hidden">
            <div className="h-full w-1/3 bg-violet-500/60 rounded animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
};

const MetricRow = React.forwardRef<HTMLDivElement, { label: string; value: string; valueClass?: string }>(
  ({
    label,
    value,
    valueClass = 'text-foreground',
  }, ref) => (
    <div ref={ref} className="flex items-center justify-between text-[10px] font-mono">
      <span className="text-muted-foreground/50">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  ),
);

MetricRow.displayName = 'MetricRow';

export default AlphaNetDashboard;