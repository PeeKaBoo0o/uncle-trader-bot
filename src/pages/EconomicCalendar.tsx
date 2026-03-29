import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useEconomicEvents, EconomicEvent } from '@/hooks/useEconomicEvents';

const IMPACT_STYLES: Record<string, { badge: string; dot: string; label: string; stars: number }> = {
  high: { badge: 'text-red-400 bg-red-400/10 border-red-400/30', dot: 'bg-red-400', label: 'Cao', stars: 3 },
  medium: { badge: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', dot: 'bg-yellow-400', label: 'TB', stars: 2 },
  low: { badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', dot: 'bg-emerald-400', label: 'Thấp', stars: 1 },
};

const DATE_FILTERS = [
  { label: 'Hôm qua', value: 'yesterday' },
  { label: 'Hôm nay', value: 'today' },
  { label: 'Ngày mai', value: 'tomorrow' },
  { label: 'Tuần này', value: 'week' },
];

function formatEventTime(timeStr: string): { date: string; time: string } {
  const d = new Date(timeStr);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${days[vn.getUTCDay()]}, ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}`;
  const time = `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`;
  return { date, time };
}

function Countdown({ targetTime }: { targetTime: string }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const target = new Date(targetTime);
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Đã diễn ra'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h > 0 ? h + 'g ' : ''}${m}p ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);
  return <span className="font-mono-custom text-cyan-400 font-bold">{remaining}</span>;
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-[10px] ${i <= count ? 'text-yellow-400' : 'text-muted-foreground/20'}`}>★</span>
      ))}
    </span>
  );
}

const EconomicCalendar: React.FC = () => {
  const [dateFilter, setDateFilter] = useState('week');
  const [impactFilter, setImpactFilter] = useState<string[]>(['high', 'medium', 'low']);
  const { events, loading } = useEconomicEvents();

  const toggleImpact = (level: string) => {
    setImpactFilter(prev => prev.includes(level) ? prev.filter(x => x !== level) : [...prev, level]);
  };

  const now = new Date();
  const filteredEvents = events.filter(ev => {
    if (!impactFilter.includes(ev.impact)) return false;
    const evDate = new Date(ev.event_time);
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return evDate.toDateString() === yesterday.toDateString();
    }
    if (dateFilter === 'today') {
      return evDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return evDate.toDateString() === tomorrow.toDateString();
    }
    if (dateFilter === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return evDate >= startOfWeek && evDate <= endOfWeek;
    }
    return true;
  });

  const nextHighImpact = events.find(ev => ev.impact === 'high' && !ev.actual && new Date(ev.event_time) > now);

  // Group by date
  const grouped: Record<string, EconomicEvent[]> = {};
  filteredEvents.forEach(ev => {
    const { date } = formatEventTime(ev.event_time);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(ev);
  });

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />

      <section className="pt-24 pb-4 px-4 lg:px-8">
        <div className="max-w-5xl mx-auto">

          {/* Compact Header */}
          <div className="glass-card rounded-xl px-6 py-5 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Lịch Kinh Tế</h1>
                <p className="text-xs text-muted-foreground">Theo dõi các sự kiện kinh tế quan trọng ảnh hưởng đến thị trường</p>
              </div>
            </div>

            {/* Date Tabs */}
            <div className="flex items-center gap-1 mt-4 mb-4">
              {DATE_FILTERS.map(f => (
                <button key={f.value} onClick={() => setDateFilter(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateFilter === f.value
                      ? 'bg-cyan-400/15 text-cyan-400 font-bold border border-cyan-400/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">Mức độ quan trọng:</span>
              <span className="flex items-center gap-1">
                <Stars count={3} />
                <span className="text-red-400 font-medium">Cao</span>
              </span>
              <span className="flex items-center gap-1">
                <Stars count={2} />
                <span className="text-yellow-400 font-medium">TB</span>
              </span>
              <span className="flex items-center gap-1">
                <Stars count={1} />
                <span className="text-muted-foreground font-medium">Thấp</span>
              </span>
              <span className="w-px h-4 bg-foreground/10" />
              <span className="flex items-center gap-1">
                <span className="text-emerald-400">▲</span>
                <span>Tốt hơn dự báo</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-red-400">▼</span>
                <span>Kém hơn dự báo</span>
              </span>
            </div>
          </div>

          {/* Countdown Banner */}
          {nextHighImpact && (
            <div className="glass-card rounded-xl px-5 py-3 border border-red-400/20 bg-red-400/5 flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Sự kiện lớn tiếp theo</span>
              </div>
              <div className="flex-1 text-sm text-foreground font-medium">{nextHighImpact.flag} {nextHighImpact.event_name}</div>
              <div className="text-sm text-muted-foreground">Còn: <Countdown targetTime={nextHighImpact.event_time} /></div>
            </div>
          )}

          {/* Events Table */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-12">Đang tải dữ liệu...</div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center text-muted-foreground py-12">Không có sự kiện nào trong khoảng thời gian này.</div>
            ) : (
              Object.entries(grouped).map(([date, evts]) => (
                <div key={date}>
                  <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                    <span className="w-6 h-px bg-cyan-400/30" />
                    {date}
                  </h3>
                  <div className="glass-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-foreground/5 text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                            <th className="text-left px-4 py-2.5">Giờ (VN)</th>
                            <th className="text-left px-4 py-2.5">Quốc gia</th>
                            <th className="text-left px-4 py-2.5">Sự kiện</th>
                            <th className="text-center px-4 py-2.5">Tác động</th>
                            <th className="text-right px-4 py-2.5">Thực tế</th>
                            <th className="text-right px-4 py-2.5">Dự kiến</th>
                            <th className="text-right px-4 py-2.5">Trước</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                          {evts.map(ev => {
                            const { time } = formatEventTime(ev.event_time);
                            const style = IMPACT_STYLES[ev.impact] || IMPACT_STYLES.low;
                            const actual = ev.actual || '—';
                            const estimate = ev.estimate || '—';
                            const prev = ev.prev || '—';
                            const isBeat = ev.actual && ev.estimate && parseFloat(ev.actual) > parseFloat(ev.estimate);
                            const isMiss = ev.actual && ev.estimate && parseFloat(ev.actual) < parseFloat(ev.estimate);
                            return (
                              <tr key={ev.id} className="hover:bg-foreground/[0.02] transition-colors">
                                <td className="px-4 py-2.5 font-mono-custom text-muted-foreground text-xs">{time}</td>
                                <td className="px-4 py-2.5 text-xs"><span className="mr-1">{ev.flag}</span>{ev.country}</td>
                                <td className="px-4 py-2.5 text-foreground font-medium text-xs">{ev.event_name}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <Stars count={style.stars} />
                                </td>
                                <td className={`px-4 py-2.5 text-right font-mono-custom font-bold text-xs ${isBeat ? 'text-emerald-400' : isMiss ? 'text-red-400' : 'text-muted-foreground'}`}>
                                  {actual}{isBeat && ' ▲'}{isMiss && ' ▼'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono-custom text-muted-foreground text-xs">{estimate}</td>
                                <td className="px-4 py-2.5 text-right font-mono-custom text-muted-foreground/60 text-xs">{prev}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default EconomicCalendar;
