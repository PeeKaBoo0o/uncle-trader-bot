import React from 'react';
import type { Signal } from '@/hooks/useMarketData';

interface SignalFeedProps {
  signals: Signal[];
  loading: boolean;
  onSignalClick?: (signal: Signal) => void;
}

const STRENGTH_STYLES: Record<string, { bg: string; text: string }> = {
  '🔥 CỰC MẠNH': { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
  '✅ TRUNG BÌNH': { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  '⚠️ THẤP': { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400' },
};

const SignalFeed: React.FC<SignalFeedProps> = ({ signals, loading, onSignalClick }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="text-muted-foreground text-xs">Chưa có tín hiệu nào</span>
      </div>
    );
  }

  return (
    <div className="h-full space-y-1.5">
      {signals.map(signal => {
        const style = STRENGTH_STYLES[signal.strength] || STRENGTH_STYLES['✅ TRUNG BÌNH'];
        const time = new Date(signal.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const isBuy = signal.conditions.some(c => ['Breakout', 'Support Bounce', 'Confluence', 'BB Squeeze'].includes(c));

        return (
          <button
            key={signal.id}
            onClick={() => onSignalClick?.(signal)}
            className={`w-full text-left p-3 rounded-lg border ${style.bg} hover:bg-white/5 transition-all group`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">[{time}]</span>
              <span className="text-[10px] font-bold text-muted-foreground/50">{signal.timeframe}</span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-foreground">{signal.symbol.replace('USDT', '')}</span>
              <span className={`text-xs font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                {isBuy ? '🟢 LONG' : '🔴 SHORT'}
              </span>
            </div>
            <div className="space-y-0.5">
              {signal.conditions.slice(0, 3).map((c, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">• {c}</div>
              ))}
            </div>
            <div className={`mt-1.5 text-[10px] font-bold ${style.text}`}>{signal.strength}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-[10px] text-muted-foreground">
                ${Number(signal.price).toLocaleString()}
              </span>
              {signal.rsi && (
                <span className="text-[10px] text-muted-foreground">
                  RSI: {Number(signal.rsi).toFixed(0)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SignalFeed;
