import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';

interface Term {
  id: string;
  term: string;
  english: string;
  category: string;
  definition: string;
  example?: string;
}

const CATEGORIES = ['Tất cả', 'Phân Tích Kỹ Thuật', 'Quản Lý Rủi Ro', 'Indicator', 'Price Action', 'Cơ Bản'];

const TERMS: Term[] = [
  { id: 'support-resistance', term: 'Hỗ Trợ & Kháng Cự', english: 'Support & Resistance', category: 'Phân Tích Kỹ Thuật', definition: 'Vùng giá mà tại đó lực mua (hỗ trợ) hoặc lực bán (kháng cự) đủ mạnh để ngăn giá đi xa hơn.', example: 'BTC có hỗ trợ mạnh tại $60,000 — giá đã bounce 3 lần từ vùng này.' },
  { id: 'breakout', term: 'Breakout', english: 'Breakout', category: 'Price Action', definition: 'Khi giá phá vỡ qua vùng hỗ trợ hoặc kháng cự quan trọng với volume lớn, báo hiệu một xu hướng mới.', example: 'BTC breakout khỏi $68,000 với volume tăng 3x — xác nhận đà tăng mới.' },
  { id: 'trendline', term: 'Đường Xu Hướng', english: 'Trendline', category: 'Phân Tích Kỹ Thuật', definition: 'Đường thẳng nối các đỉnh hoặc đáy liên tiếp, thể hiện hướng đi chính của giá.', example: 'Trendline tăng kéo dài 3 tháng — mỗi đáy sau cao hơn đáy trước.' },
  { id: 'divergence', term: 'Phân Kỳ', english: 'Divergence', category: 'Indicator', definition: 'Khi giá và indicator (RSI, MACD) đi ngược hướng nhau, báo hiệu đảo chiều tiềm năng.', example: 'BTC tạo đỉnh mới nhưng RSI đi xuống — phân kỳ giảm, cảnh báo điều chỉnh.' },
  { id: 'volume', term: 'Khối Lượng', english: 'Volume', category: 'Cơ Bản', definition: 'Tổng số lượng tài sản được giao dịch trong một khoảng thời gian. Volume xác nhận xu hướng giá.', example: 'Giá tăng + Volume tăng = Xu hướng tăng mạnh. Giá tăng + Volume giảm = Cảnh báo.' },
  { id: 'stop-loss', term: 'Cắt Lỗ', english: 'Stop Loss', category: 'Quản Lý Rủi Ro', definition: 'Lệnh tự động đóng vị thế khi giá đạt mức lỗ đã định trước, bảo vệ vốn.', example: 'Entry BTC tại $67,000 — đặt SL tại $65,500 (risk 2.2%).' },
  { id: 'take-profit', term: 'Chốt Lời', english: 'Take Profit', category: 'Quản Lý Rủi Ro', definition: 'Lệnh tự động đóng vị thế khi giá đạt mức lời đã định trước.', example: 'TP1: $69,000 (chốt 50%) | TP2: $71,000 (chốt 30%) | TP3: trailing.' },
  { id: 'risk-reward', term: 'Tỷ Lệ Risk/Reward', english: 'Risk/Reward Ratio', category: 'Quản Lý Rủi Ro', definition: 'Tỷ lệ giữa rủi ro (SL) và phần thưởng (TP). Trader chuyên nghiệp yêu cầu tối thiểu 1:2.', example: 'Entry $67K, SL $66K (risk $1K), TP $70K (reward $3K) → R:R = 1:3 ✅' },
  { id: 'rsi', term: 'RSI', english: 'Relative Strength Index', category: 'Indicator', definition: 'Chỉ báo đo lường tốc độ và thay đổi của biến động giá. RSI > 70 = quá mua, RSI < 30 = quá bán.', example: 'RSI 14 chạm 28 — vùng quá bán, theo dõi tín hiệu đảo chiều tăng.' },
  { id: 'macd', term: 'MACD', english: 'Moving Average Convergence Divergence', category: 'Indicator', definition: 'Indicator theo trend kết hợp momentum. Cắt lên = tín hiệu mua, cắt xuống = tín hiệu bán.', example: 'MACD line cắt lên Signal line + Histogram dương → Xác nhận đà tăng.' },
  { id: 'liquidity', term: 'Thanh Khoản', english: 'Liquidity', category: 'Cơ Bản', definition: 'Khả năng mua/bán tài sản nhanh chóng mà không ảnh hưởng đáng kể đến giá.', example: 'BTC có thanh khoản cao — spread chỉ $5-10 trên Binance.' },
  { id: 'reversal', term: 'Đảo Chiều', english: 'Reversal', category: 'Price Action', definition: 'Khi xu hướng giá thay đổi từ tăng sang giảm hoặc ngược lại.', example: 'Double Top tại $69K + RSI divergence → Xác nhận đảo chiều giảm.' },
];

const Dictionary: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  useEffect(() => {
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, []);

  const filtered = TERMS.filter(t => {
    const matchSearch = !search || t.term.toLowerCase().includes(search.toLowerCase()) || t.english.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === 'Tất cả' || t.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-12 overflow-hidden line-grid">
        <div className="absolute top-0 left-1/3 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <div className="reveal-hidden page-reveal inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8">
            <span className="font-mono-custom text-xs text-cyan-400 tracking-wider">📖 TỪ ĐIỂN TRADING</span>
          </div>
          <h1 className="reveal-hidden page-reveal font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
            Từ Điển <span className="text-gradient-cyan italic">Trading</span>
          </h1>
          <p className="reveal-hidden page-reveal text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
            Tra cứu thuật ngữ trading từ cơ bản đến nâng cao. Mỗi khái niệm đều có ví dụ thực tế và hướng dẫn áp dụng.
          </p>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="pb-6 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-xl p-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm thuật ngữ... (ví dụ: RSI, breakout, stop loss)"
              className="crypto-input w-full rounded-xl px-5 py-3 mb-4"
            />
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeCategory === cat ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Terms Grid */}
      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-sm text-muted-foreground mb-6">{filtered.length} thuật ngữ</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((term) => (
              <Link
                key={term.id}
                to={`/tu-dien/${term.id}`}
                className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-foreground group-hover:text-cyan-400 transition-colors">
                      {term.term}
                    </h3>
                    <span className="text-xs text-muted-foreground/60 font-mono-custom">{term.english}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                    {term.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{term.definition}</p>
                {term.example && (
                  <div className="mt-4 bg-white/[0.03] rounded-lg p-3 border border-white/5">
                    <span className="text-xs text-cyan-400/80 font-mono-custom">VÍ DỤ:</span>
                    <p className="text-xs text-muted-foreground mt-1">{term.example}</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Dictionary;
