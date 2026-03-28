import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  imageUrl?: string;
  stream: string;
  badge?: string;
  badgeColor?: string;
}

interface NewsStream {
  id: string;
  label: string;
  icon: string;
  description: string;
  sources: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

const NEWS_STREAMS: NewsStream[] = [
  { id: 'hot', label: 'Tin Nóng & Nhịp Đập Thị Trường', icon: '🔥', description: 'Tin tức nóng nhất, biến động giá, xu hướng thị trường theo thời gian thực', sources: 'CoinGecko · CryptoPanic · CoinMarketCap', color: 'text-rose-400', borderColor: 'border-rose-400/40', bgColor: 'bg-rose-400/10' },
  { id: 'whale', label: 'Dòng Tiền & Cá Voi', icon: '🐋', description: 'Giao dịch siêu lớn, dòng tiền nạp/rút từ sàn, TVL On-chain', sources: 'Whale Alert · DefiLlama', color: 'text-cyan-400', borderColor: 'border-cyan-400/40', bgColor: 'bg-cyan-400/10' },
  { id: 'macro', label: 'Vĩ Mô & Pháp Lý', icon: '🏛️', description: 'FED, SEC, lạm phát, luật pháp, lịch kinh tế quan trọng', sources: 'CryptoPanic · Finnhub', color: 'text-violet-400', borderColor: 'border-violet-400/40', bgColor: 'bg-violet-400/10' },
  { id: 'event', label: 'Sự Kiện & Unlock', icon: '📅', description: 'Mainnet, Halving, lịch xả token, Airdrop, sự kiện hot', sources: 'CoinMarketCal · CoinGecko', color: 'text-amber-400', borderColor: 'border-amber-400/40', bgColor: 'bg-amber-400/10' },
  { id: 'sentiment', label: 'Tâm Lý Thị Trường', icon: '📊', description: 'Fear & Greed Index, Long/Short Ratio, thanh lý, social buzz', sources: 'Alternative.me · Coinglass · LunarCrush', color: 'text-emerald-400', borderColor: 'border-emerald-400/40', bgColor: 'bg-emerald-400/10' },
];

const MOCK_NEWS: NewsArticle[] = [
  { id: '1', title: 'BTC vượt mốc $100,000 — Kỷ lục mới trong lịch sử crypto', source: 'CoinGecko', publishedAt: new Date().toISOString(), summary: '• Bitcoin đạt ATH mới tại $100,500\n• Volume giao dịch tăng 340% trong 24h\n• Dòng tiền từ ETF tiếp tục đổ vào', imageUrl: '', stream: 'hot', badge: 'BREAKING', badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
  { id: '2', title: 'Whale chuyển 5,000 BTC từ Binance ra cold wallet', source: 'Whale Alert', publishedAt: new Date(Date.now() - 3600000).toISOString(), summary: '• Giao dịch trị giá ~$500M\n• Tín hiệu tích lũy dài hạn\n• Số dư BTC trên sàn giảm xuống mức thấp nhất 3 năm', stream: 'whale', badge: 'WHALE', badgeColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' },
  { id: '3', title: 'FED giữ nguyên lãi suất — Thị trường phản ứng tích cực', source: 'CryptoPanic', publishedAt: new Date(Date.now() - 7200000).toISOString(), summary: '• Lãi suất giữ ở mức 4.5%\n• Dự báo cắt giảm vào Q3 2026\n• Bitcoin tăng 3% sau thông báo', stream: 'macro', badge: 'FED', badgeColor: 'text-violet-400 bg-violet-400/10 border-violet-400/30' },
  { id: '4', title: 'Ethereum Pectra upgrade hoàn tất — Gas fee giảm 40%', source: 'CoinGecko', publishedAt: new Date(Date.now() - 14400000).toISOString(), summary: '• Upgrade Pectra triển khai thành công\n• Gas fee trung bình giảm từ $2.5 xuống $1.5\n• TVL DeFi tăng 15% trong 48h', stream: 'event', badge: 'UPGRADE', badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  { id: '5', title: 'Fear & Greed Index chạm 82 — Extreme Greed', source: 'Alternative.me', publishedAt: new Date(Date.now() - 21600000).toISOString(), summary: '• Chỉ số tham lam cực độ\n• Long/Short Ratio: 1.8\n• Thanh lý short $340M trong 24h', stream: 'sentiment', badge: 'GREED', badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  { id: '6', title: 'SOL Breakout khỏi vùng kháng cự $180 — Momentum mạnh', source: 'CoinMarketCap', publishedAt: new Date(Date.now() - 28800000).toISOString(), summary: '• SOL tăng 12% trong 24h\n• Volume on-chain tăng đột biến\n• DeFi TVL trên Solana đạt $8B', stream: 'hot', badge: 'BREAKOUT', badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function parseBullets(summary: string): string[] {
  return summary.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.replace(/^[•\-*]\s*/, ''));
}

const News: React.FC = () => {
  const [activeStream, setActiveStream] = useState('hot');
  const [articles, setArticles] = useState<NewsArticle[]>(MOCK_NEWS);

  useEffect(() => {
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, []);

  const filtered = activeStream === 'all' ? articles : articles.filter(a => a.stream === activeStream);

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-12 overflow-hidden line-grid">
        <div className="absolute top-0 right-1/4 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <div className="reveal-hidden page-reveal inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="font-mono-custom text-xs text-rose-400 tracking-wider">LIVE NEWS</span>
          </div>
          <h1 className="reveal-hidden page-reveal font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
            Tin Tức <span className="text-gradient-cyan italic">Crypto</span>
          </h1>
          <p className="reveal-hidden page-reveal text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
            Cập nhật tin tức thị trường crypto theo thời gian thực. AI tóm tắt & phân tích tác động đến giá.
          </p>
        </div>
      </section>

      {/* Stream Tabs */}
      <section className="pb-6 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {NEWS_STREAMS.map((stream) => (
              <button
                key={stream.id}
                onClick={() => setActiveStream(stream.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 border ${
                  activeStream === stream.id
                    ? `${stream.bgColor} ${stream.color} ${stream.borderColor} font-bold`
                    : 'text-muted-foreground border-transparent hover:bg-white/5'
                }`}
              >
                <span>{stream.icon}</span>
                <span>{stream.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stream Description */}
      {NEWS_STREAMS.filter(s => s.id === activeStream).map(stream => (
        <section key={stream.id} className="pb-6 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className={`glass-card rounded-xl px-6 py-4 border ${stream.borderColor} ${stream.bgColor}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{stream.icon}</span>
                <div>
                  <h2 className={`font-semibold text-sm ${stream.color}`}>{stream.label}</h2>
                  <p className="text-muted-foreground text-xs mt-0.5">{stream.description}</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Nguồn: {stream.sources}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* News Cards */}
      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((article) => {
              const stream = NEWS_STREAMS.find(s => s.id === article.stream);
              const bullets = parseBullets(article.summary);
              return (
                <div key={article.id} className="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col group">
                  {/* Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start gap-2 mb-3">
                      {article.badge && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${article.badgeColor}`}>
                          {article.badge}
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${stream?.borderColor} ${stream?.color} ${stream?.bgColor}`}>
                        {article.source}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                      {article.title}
                    </h3>
                    <span className="text-xs text-muted-foreground/60 mt-2 block">{formatDate(article.publishedAt)}</span>
                  </div>

                  {/* AI Summary */}
                  <div className="px-5 pb-4 flex-1">
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider">✨ AI Tóm Tắt</span>
                      </div>
                      <ul className="space-y-2">
                        {bullets.map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                            <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-5">
                    <Link
                      to={`/tin-tuc/${article.id}`}
                      className="w-full block text-center text-xs font-bold py-2.5 px-4 rounded-xl transition-all duration-300 border border-white/15 text-foreground hover:border-cyan-400/40 hover:text-cyan-400"
                    >
                      📖 Đọc chi tiết & Phân tích đầy đủ
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📰</div>
              <h3 className="font-display font-bold text-xl text-foreground mb-2">Chưa có tin tức</h3>
              <p className="text-muted-foreground">Đang cập nhật tin tức cho luồng này...</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default News;
