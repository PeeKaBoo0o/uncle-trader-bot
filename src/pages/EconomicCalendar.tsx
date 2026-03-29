import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useEconomicEvents, EconomicEvent } from '@/hooks/useEconomicEvents';

const IMPACT_STYLES: Record<string, { dot: string; label: string; stars: number }> = {
  high: { dot: 'bg-red-400', label: 'Cao', stars: 3 },
  medium: { dot: 'bg-yellow-400', label: 'TB', stars: 2 },
  low: { dot: 'bg-emerald-400', label: 'Thấp', stars: 1 },
};

const DATE_FILTERS = [
  { label: 'Hôm qua', value: 'yesterday' },
  { label: 'Hôm nay', value: 'today' },
  { label: 'Ngày mai', value: 'tomorrow' },
  { label: 'Tuần này', value: 'week' },
  { label: 'Tuần sau', value: 'nextweek' },
];

function formatEventTime(timeStr: string): { date: string; time: string; fullDate: string } {
  const d = new Date(timeStr);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${days[vn.getUTCDay()]}, ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
  const time = `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`;
  const fullDate = `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}`;
  return { date, time, fullDate };
}

function CurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="font-mono-custom text-xs text-muted-foreground">
      Giờ hiện tại: <span className="text-foreground font-semibold">{pad(vn.getUTCHours())}:{pad(vn.getUTCMinutes())}:{pad(vn.getUTCSeconds())}</span>
      <span className="text-muted-foreground/50 ml-1">(GMT+7)</span>
    </span>
  );
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
  return <span className="font-mono-custom text-cyan-400 font-bold text-xs">{remaining}</span>;
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-[11px] ${i <= count ? 'text-yellow-400' : 'text-muted-foreground/20'}`}>★</span>
      ))}
    </span>
  );
}

const EconomicCalendar: React.FC = () => {
  const [dateFilter, setDateFilter] = useState('week');
  const [impactFilter, setImpactFilter] = useState<string[]>(['high', 'medium', 'low']);
  const [searchQuery, setSearchQuery] = useState('');
  const { events, loading } = useEconomicEvents();

  const toggleImpact = (level: string) => {
    setImpactFilter(prev => prev.includes(level) ? prev.filter(x => x !== level) : [...prev, level]);
  };

  const now = new Date();
  const filteredEvents = events.filter(ev => {
    if (!impactFilter.includes(ev.impact)) return false;
    if (searchQuery && !ev.event_name.toLowerCase().includes(searchQuery.toLowerCase()) && !ev.country.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    const evDate = new Date(ev.event_time);
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      return evDate.toDateString() === yesterday.toDateString();
    }
    if (dateFilter === 'today') return evDate.toDateString() === now.toDateString();
    if (dateFilter === 'tomorrow') {
      const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
      return evDate.toDateString() === tomorrow.toDateString();
    }
    if (dateFilter === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      return evDate >= start && evDate <= end;
    }
    if (dateFilter === 'nextweek') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 8); start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      return evDate >= start && evDate <= end;
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
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Lịch Kinh Tế</h1>
                <p className="text-xs text-muted-foreground">Theo dõi sự kiện kinh tế ảnh hưởng thị trường tài chính</p>
              </div>
            </div>
            <CurrentTime />
          </div>

          {/* Controls Bar */}
          <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
            {/* Row 1: Date tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-1 flex-wrap">
                {DATE_FILTERS.map(f => (
                  <button key={f.value} onClick={() => setDateFilter(f.value)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      dateFilter === f.value
                        ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="sm:ml-auto relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="Tìm sự kiện..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full sm:w-56 pl-9 pr-3 py-1.5 rounded-lg bg-foreground/5 border border-foreground/10 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyan-400/30 transition-colors"
                />
              </div>
            </div>

            {/* Row 2: Impact filters + Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground/60">Lọc:</span>
              {([
                { level: 'high', activeClass: 'border-red-400/30 bg-red-400/10 text-red-400' },
                { level: 'medium', activeClass: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400' },
                { level: 'low', activeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' },
              ] as const).map(({ level, activeClass }) => {
                const s = IMPACT_STYLES[level];
                const active = impactFilter.includes(level);
                return (
                  <button key={level} onClick={() => toggleImpact(level)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${
                      active ? activeClass : 'border-foreground/10 text-muted-foreground/40 line-through'
                    }`}>
                    <Stars count={s.stars} />
                    <span className="font-medium">{s.label}</span>
                  </button>
                );
              })}

              <span className="hidden sm:block w-px h-4 bg-foreground/10" />
              <span className="hidden sm:flex items-center gap-1 text-muted-foreground/50">
                <span className="text-emerald-400">▲</span> Beat
              </span>
              <span className="hidden sm:flex items-center gap-1 text-muted-foreground/50">
                <span className="text-red-400">▼</span> Miss
              </span>
            </div>
          </div>

          {/* Countdown Banner */}
          {nextHighImpact && (
            <div className="glass-card rounded-xl px-4 py-3 border border-red-400/20 bg-red-400/[0.03] flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                </span>
                <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Sắp diễn ra</span>
              </div>
              <div className="flex-1 text-xs text-foreground font-medium">{nextHighImpact.flag} {nextHighImpact.event_name}</div>
              <Countdown targetTime={nextHighImpact.event_time} />
            </div>
          )}

          {/* Events Table */}
          <div className="space-y-5">
            {loading ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Đang tải dữ liệu...
                </div>
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <div className="text-3xl mb-3">📭</div>
                <p className="text-muted-foreground text-sm">Không có sự kiện nào trong khoảng thời gian này.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([date, evts]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <h3 className="text-xs font-bold text-foreground tracking-wide">{date}</h3>
                    <div className="flex-1 h-px bg-foreground/5" />
                    <span className="text-[10px] text-muted-foreground/40 font-mono-custom">{evts.length} sự kiện</span>
                  </div>
                  <div className="glass-card rounded-xl overflow-hidden border border-foreground/5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-foreground/5 bg-foreground/[0.02]">
                            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold w-20">Giờ VN</th>
                            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold w-24">Tiền tệ</th>
                            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold">Sự kiện</th>
                            <th className="text-center px-4 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold w-20">Imp.</th>
                            <th className="text-right px-3 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold w-20">Actual</th>
                            <th className="text-right px-3 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold w-20">Forecast</th>
                            <th className="text-right px-4 py-2.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold w-20">Previous</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/[0.03]">
                          {evts.map(ev => {
                            const { time } = formatEventTime(ev.event_time);
                            const style = IMPACT_STYLES[ev.impact] || IMPACT_STYLES.low;
                            const actual = ev.actual || '—';
                            const estimate = ev.estimate || '—';
                            const prev = ev.prev || '—';
                            const isBeat = ev.actual && ev.estimate && parseFloat(ev.actual) > parseFloat(ev.estimate);
                            const isMiss = ev.actual && ev.estimate && parseFloat(ev.actual) < parseFloat(ev.estimate);
                            const isPast = new Date(ev.event_time) < now;
                            const isHighImpact = ev.impact === 'high';
                            return (
                              <tr key={ev.id} className={`transition-colors hover:bg-foreground/[0.03] ${isHighImpact ? 'bg-red-400/[0.02]' : ''} ${isPast && !ev.actual ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-2.5 font-mono-custom text-muted-foreground text-xs whitespace-nowrap">{time}</td>
                                <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="text-base leading-none">{ev.flag}</span>
                                    <span className="text-muted-foreground font-medium">{ev.country}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-foreground font-medium text-xs">{ev.event_name}</td>
                                <td className="px-4 py-2.5 text-center"><Stars count={style.stars} /></td>
                                <td className={`px-3 py-2.5 text-right font-mono-custom font-bold text-xs whitespace-nowrap ${isBeat ? 'text-emerald-400' : isMiss ? 'text-red-400' : 'text-muted-foreground/60'}`}>
                                  {isBeat && <span className="mr-0.5">▲</span>}{isMiss && <span className="mr-0.5">▼</span>}{actual}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono-custom text-muted-foreground text-xs">{estimate}</td>
                                <td className="px-4 py-2.5 text-right font-mono-custom text-muted-foreground/50 text-xs">{prev}</td>
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

          {/* Footer info */}
          <div className="mt-6 mb-8 glass-card rounded-xl p-4">
            <div className="flex flex-wrap gap-6 text-[10px] text-muted-foreground/40">
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                <span>Dữ liệu cập nhật tự động</span>
              </div>
              <div className="flex items-center gap-2">
                <Stars count={3} />
                <span>= Biến động cao</span>
              </div>
              <div className="flex items-center gap-2">
                <Stars count={2} />
                <span>= Biến động trung bình</span>
              </div>
              <div className="flex items-center gap-2">
                <Stars count={1} />
                <span>= Biến động thấp</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default EconomicCalendar;
