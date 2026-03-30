import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TickerEvent {
  id: string;
  event_time: string;
  country: string;
  flag: string;
  event_name: string;
  impact: string;
  actual: string | null;
  estimate: string | null;
}

const Stars = ({ count }: { count: number }) => (
  <span className="inline-flex gap-px">
    {[1, 2, 3].map(i => (
      <span key={i} className={`text-[9px] ${i <= count ? 'text-yellow-400' : 'text-muted-foreground/20'}`}>★</span>
    ))}
  </span>
);

function formatTimeVN(timeStr: string): string {
  const d = new Date(timeStr);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`;
}

const EconomicTicker: React.FC = () => {
  const [events, setEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    async function fetchEvents() {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('economic_events')
        .select('id, event_time, country, flag, event_name, impact, actual, estimate')
        .in('impact', ['high', 'medium'])
        .gte('event_time', startOfDay.toISOString())
        .lte('event_time', endOfDay.toISOString())
        .order('event_time', { ascending: true });

      if (data && data.length > 0) {
        setEvents(data as TickerEvent[]);
      }
    }
    fetchEvents();
  }, []);

  if (events.length === 0) return null;

  const stars = (impact: string) => impact === 'high' ? 3 : 2;

  return (
    <div className="w-full bg-background/60 backdrop-blur-sm border-b border-foreground/[0.06] overflow-hidden">
      <div className="ticker-track flex items-center gap-8 py-1.5 whitespace-nowrap">
        {/* Duplicate for seamless loop */}
        {[...events, ...events].map((ev, i) => {
          const isPast = new Date(ev.event_time) < new Date();
          return (
            <div key={`${ev.id}-${i}`} className="flex items-center gap-2 shrink-0">
              <span className="text-sm leading-none">{ev.flag}</span>
              <Stars count={stars(ev.impact)} />
              <span className="text-[11px] text-muted-foreground/60 font-mono">
                ⏱ {formatTimeVN(ev.event_time)}
              </span>
              <span className={`text-[11px] font-medium ${isPast && ev.actual ? 'text-foreground/70' : 'text-foreground/90'}`}>
                {ev.event_name.length > 40 ? ev.event_name.slice(0, 40) + '…' : ev.event_name}
              </span>
              {ev.actual && (
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  {ev.actual}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EconomicTicker;
