import React from 'react';

export interface IndicatorConfig {
  id: string;
  label: string;
  enabled: boolean;
  color: string;
  category: string;
  note?: string;
}

interface IndicatorPanelProps {
  indicators: IndicatorConfig[];
  onToggle: (id: string) => void;
}

const IndicatorPanel: React.FC<IndicatorPanelProps> = ({ indicators, onToggle }) => {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-3 px-1">
        INDICATORS
      </h3>
      {indicators.map(ind => (
        <button
          key={ind.id}
          onClick={() => onToggle(ind.id)}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[11px] font-medium transition-all ${
            ind.enabled
              ? 'bg-white/5 text-foreground'
              : 'text-muted-foreground/40 hover:text-muted-foreground/70'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all ${ind.enabled ? 'scale-100' : 'scale-75 opacity-40'}`}
              style={{ backgroundColor: ind.enabled ? ind.color : '#4B5563' }}
            />
            <span className="font-mono">{ind.label}</span>
            {ind.note && (
              <span className="relative group/note cursor-help">
                <span className="text-yellow-400 text-[10px]">⚠</span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-[#1e2329] border border-yellow-500/30 text-[9px] text-yellow-300 font-mono whitespace-nowrap opacity-0 group-hover/note:opacity-100 pointer-events-none transition-opacity z-50">
                  {ind.note}
                </span>
              </span>
            )}
          </div>
          <span className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] ${
            ind.enabled ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400' : 'border-white/10'
          }`}>
            {ind.enabled ? '✓' : ''}
          </span>
        </button>
      ))}
    </div>
  );
};

export default IndicatorPanel;
