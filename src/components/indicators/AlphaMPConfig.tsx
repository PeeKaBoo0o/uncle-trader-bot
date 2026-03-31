import React from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AlphaMPConfig } from '@/hooks/useAlphaMP';

interface Props {
  config: AlphaMPConfig;
  onChange: (c: AlphaMPConfig) => void;
}

const SOURCES = ['close', 'open', 'high', 'low'] as const;

const AlphaMPConfigPanel: React.FC<Props> = ({ config, onChange }) => {
  return (
    <div className="border border-[#2b3139] rounded-lg overflow-hidden">
      <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
        ALPHA MP CONFIG
      </div>
      <div className="bg-[#161a1e] p-2 space-y-2">
        {/* Bandwidth */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">Bandwidth</span>
          <Input
            type="number"
            value={config.bandwidth}
            onChange={e => onChange({ ...config, bandwidth: Number(e.target.value) || 8 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>

        {/* Multiplier */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">Multiplier</span>
          <Input
            type="number"
            step="0.5"
            value={config.multiplier}
            onChange={e => onChange({ ...config, multiplier: Number(e.target.value) || 3 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>

        {/* Source */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">Source</span>
          <select
            value={config.source}
            onChange={e => onChange({ ...config, source: e.target.value as AlphaMPConfig['source'] })}
            className="h-6 text-[10px] font-mono bg-[#0b0e11] border border-[#2b3139] text-[#eaecef] rounded px-1.5"
          >
            {SOURCES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Repaint */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">Repaint</span>
          <Switch
            checked={config.repaint}
            onCheckedChange={v => onChange({ ...config, repaint: v })}
            className="scale-75"
          />
        </div>

        {/* Max Bars */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#5e6673]">Max Bars</span>
          <Input
            type="number"
            value={config.maxBars}
            onChange={e => onChange({ ...config, maxBars: Number(e.target.value) || 500 })}
            className="w-16 h-6 text-[10px] font-mono bg-[#0b0e11] border-[#2b3139] text-[#eaecef] px-1.5"
          />
        </div>
      </div>
    </div>
  );
};

export default AlphaMPConfigPanel;
