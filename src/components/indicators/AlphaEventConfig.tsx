import React from 'react';
import { Input } from '@/components/ui/input';
import type { AlphaEventConfig } from '@/hooks/useAlphaEventSignal';

interface Props {
  config: AlphaEventConfig;
  onChange: (c: AlphaEventConfig) => void;
}

const AlphaEventConfigPanel: React.FC<Props> = ({ config, onChange }) => {
  return (
    <div className="border border-[#2b3139] rounded-lg overflow-hidden">
      <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
        ALPHA EVENT CONFIG
      </div>
      <div className="bg-[#161a1e] p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">EMA Fast</span>
          <Input
            type="number"
            value={config.emaFastLength}
            onChange={e => onChange({ ...config, emaFastLength: Number(e.target.value) || 5 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">EMA Slow</span>
          <Input
            type="number"
            value={config.emaSlowLength}
            onChange={e => onChange({ ...config, emaSlowLength: Number(e.target.value) || 32 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">EMA Trend</span>
          <Input
            type="number"
            value={config.emaTrendLength}
            onChange={e => onChange({ ...config, emaTrendLength: Number(e.target.value) || 200 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">TP %</span>
          <Input
            type="number"
            step="0.001"
            value={config.takeProfitPercent}
            onChange={e => onChange({ ...config, takeProfitPercent: Number(e.target.value) || 0.01 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>
      </div>
    </div>
  );
};

export default AlphaEventConfigPanel;
