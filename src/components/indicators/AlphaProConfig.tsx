import React from 'react';
import type { AlphaProConfig } from '@/hooks/useAlphaProSignal';

interface AlphaProConfigPanelProps {
  config: AlphaProConfig;
  onChange: (config: AlphaProConfig) => void;
}

const AlphaProConfigPanel: React.FC<AlphaProConfigPanelProps> = ({ config, onChange }) => {
  const update = (key: keyof AlphaProConfig, value: number | boolean) => {
    onChange({ ...config, [key]: value });
  };

  const fields: { key: keyof AlphaProConfig; label: string; type: 'number' | 'boolean' }[] = [
    { key: 'atrPeriod', label: 'ATR Period', type: 'number' },
    { key: 'atrMultiplier', label: 'ATR Multiplier', type: 'number' },
    { key: 'fastLength', label: 'Fast Length', type: 'number' },
    { key: 'slowLength', label: 'Slow Length', type: 'number' },
    { key: 'wavyLength', label: 'Wavy Length', type: 'number' },
    { key: 'tunnelFastLength', label: 'Tunnel Fast', type: 'number' },
    { key: 'tunnelSlowLength', label: 'Tunnel Slow', type: 'number' },
    { key: 'fixedTimeframeMode', label: 'Fixed TF Mode', type: 'boolean' },
  ];

  return (
    <div className="border border-[#2b3139] rounded-lg overflow-hidden">
      <div className="bg-[#1e2329] px-2 py-1.5 text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
        ALPHA PRO CONFIG
      </div>
      <div className="bg-[#161a1e] p-2 space-y-1.5">
        {fields.map(f => (
          <div key={f.key} className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#5e6673]">{f.label}</span>
            {f.type === 'number' ? (
              <input
                type="number"
                value={config[f.key] as number}
                onChange={e => update(f.key, Number(e.target.value))}
                className="w-14 bg-[#0b0e11] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] font-mono text-right focus:outline-none focus:border-[#fcd535]/50"
              />
            ) : (
              <button
                onClick={() => update(f.key, !config[f.key])}
                className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  config[f.key] ? 'bg-[#fcd535]/10 text-[#fcd535]' : 'bg-[#2b3139] text-[#5e6673]'
                }`}
              >
                {config[f.key] ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlphaProConfigPanel;
