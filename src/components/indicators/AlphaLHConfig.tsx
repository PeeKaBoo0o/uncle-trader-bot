import React from 'react';
import type { AlphaLHConfig } from '@/hooks/useAlphaLH';

interface AlphaLHConfigPanelProps {
  config: AlphaLHConfig;
  onChange: (config: AlphaLHConfig) => void;
}

const AlphaLHConfigPanel: React.FC<AlphaLHConfigPanelProps> = ({ config, onChange }) => {
  const set = <K extends keyof AlphaLHConfig>(key: K, value: AlphaLHConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="mt-3 border border-[#2b3139] rounded-lg overflow-hidden">
      <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
        ALPHA LH CONFIG
      </div>
      <div className="bg-[#161a1e] p-2 space-y-2">
        {/* MSS Swing Length */}
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[#5e6673]">MSS Swing</span>
          <input
            type="number"
            value={config.mssOffset}
            onChange={e => set('mssOffset', Math.max(1, parseInt(e.target.value) || 10))}
            className="w-14 bg-[#1e2329] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono text-right"
          />
        </div>

        {/* HTF Minutes */}
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[#5e6673]">HTF (min)</span>
          <input
            type="number"
            value={config.higherTimeframeMinutes}
            onChange={e => set('higherTimeframeMinutes', Math.max(1, parseInt(e.target.value) || 60))}
            className="w-14 bg-[#1e2329] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono text-right"
          />
        </div>

        {/* Breakout Method */}
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[#5e6673]">Breakout</span>
          <select
            value={config.breakoutMethod}
            onChange={e => set('breakoutMethod', e.target.value as 'Close' | 'Wick')}
            className="bg-[#1e2329] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono"
          >
            <option value="Wick">Wick</option>
            <option value="Close">Close</option>
          </select>
        </div>

        {/* Entry Method */}
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[#5e6673]">Entry</span>
          <select
            value={config.entryMethod}
            onChange={e => set('entryMethod', e.target.value as 'Classic' | 'Adaptive')}
            className="bg-[#1e2329] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono"
          >
            <option value="Classic">Classic</option>
            <option value="Adaptive">Adaptive</option>
          </select>
        </div>

        {/* TP/SL Method */}
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[#5e6673]">TP/SL</span>
          <select
            value={config.tpslMethod}
            onChange={e => set('tpslMethod', e.target.value as 'Dynamic' | 'Fixed')}
            className="bg-[#1e2329] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono"
          >
            <option value="Dynamic">Dynamic</option>
            <option value="Fixed">Fixed</option>
          </select>
        </div>

        {/* Risk */}
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[#5e6673]">Risk</span>
          <select
            value={config.riskAmount}
            onChange={e => set('riskAmount', e.target.value as any)}
            className="bg-[#1e2329] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono"
          >
            <option value="Lowest">Lowest</option>
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="High">High</option>
            <option value="Highest">Highest</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="flex gap-2 pt-1 border-t border-[#2b3139]">
          <label className="flex items-center gap-1 text-[9px] font-mono text-[#5e6673] cursor-pointer">
            <input type="checkbox" checked={config.showHL} onChange={e => set('showHL', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
            Zones
          </label>
          <label className="flex items-center gap-1 text-[9px] font-mono text-[#5e6673] cursor-pointer">
            <input type="checkbox" checked={config.showLiqGrabs} onChange={e => set('showLiqGrabs', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
            Grabs
          </label>
          <label className="flex items-center gap-1 text-[9px] font-mono text-[#5e6673] cursor-pointer">
            <input type="checkbox" checked={config.showTPSL} onChange={e => set('showTPSL', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
            TP/SL
          </label>
        </div>
      </div>
    </div>
  );
};

export default AlphaLHConfigPanel;
