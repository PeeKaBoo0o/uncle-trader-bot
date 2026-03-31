import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import { useNewsData } from '@/hooks/useNewsData';

interface NewsStream {
  id: string;
  label: string;
  icon: string;
  description: string;
  sources: string;
  color: string;
  borderColor: string;
  bgColor: string;
  ctaLink: string;
  ctaLabel: string;
}

const NEWS_STREAMS: NewsStream[] = [
  { id: 'hot', label: 'Tin Nóng', icon: '🔥', description: 'Tin tức nóng nhất, biến động giá, xu hướng thị trường', sources: 'CoinGecko · CryptoPanic', color: 'text-rose-400', borderColor: 'border-rose-400/40', bgColor: 'bg-rose-400/10', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: '🚀 Theo dõi Telegram' },
  { id: 'whale', label: 'Cá Voi', icon: '🐋', description: 'Giao dịch siêu lớn, dòng tiền nạp/rút, TVL On-chain', sources: 'DefiLlama · Whale Alert', color: 'text-cyan-400', borderColor: 'border-cyan-400/40', bgColor: 'bg-cyan-400/10', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: '🐋 Cảnh báo Cá Voi' },
  { id: 'macro', label: 'Vĩ Mô', icon: '🏛️', description: 'FED, SEC, lạm phát, luật pháp, lịch kinh tế', sources: 'Finnhub · CryptoPanic', color: 'text-violet-400', borderColor: 'border-violet-400/40', bgColor: 'bg-violet-400/10', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: '📡 Cập nhật Vĩ Mô' },
  { id: 'event', label: 'Sự Kiện', icon: '📅', description: 'Mainnet, Halving, xả token, Airdrop', sources: 'CoinMarketCal · CoinGecko', color: 'text-amber-400', borderColor: 'border-amber-400/40', bgColor: 'bg-amber-400/10', ctaLink: 'https://www.okx.com/join/UNCLETRADER', ctaLabel: '💰 Trade OKX -20% phí' },
  { id: 'sentiment', label: 'Tâm Lý', icon: '📊', description: 'Fear & Greed, Long/Short, thanh lý, social buzz', sources: 'Alternative.me · CoinGecko', color: 'text-emerald-400', borderColor: 'border-emerald-400/40', bgColor: 'bg-emerald-400/10', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: '📊 Phân tích Tâm Lý' },
];

const UNSPLASH_POOLS: Record<string, string[]> = {
  hot: ['photo-1518546305927-5a555bb7020d', 'photo-1639762681485-074b7f938ba0', 'photo-1622630998477-20aa696ecb05', 'photo-1605792657660-596af9009e82', 'photo-1642104704074-907c0698cbd9'],
  whale: ['photo-1611974789855-9c2a0a7236a3', 'photo-1535320903710-d993d3d77d29', 'photo-1642790106117-e829e14a795f', 'photo-1559526324-593bc073d938', 'photo-1516245834210-c4c142787335'],
  macro: ['photo-1526304640581-d334cdbbf45e', 'photo-1486406146926-c627a92ad1ab', 'photo-1541354329998-f4d9a9f9297f', 'photo-1569428034239-f9565e32e224', 'photo-1590283603385-17ffb3a7f29f'],
  event: ['photo-1504384308090-c894fdcc538d', 'photo-1540575467063-178a50e2fd60', 'photo-1507003211169-0a1dd7228f2d', 'photo-1451187580459-43490279c0fa', 'photo-1517245386807-bb43f82c33c4'],
  sentiment: ['photo-1611605698335-8b1569810432', 'photo-1590283603385-17ffb3a7f29f', 'photo-1526628953301-3e589a6a8b74', 'photo-1551288049-bebda4e38f71', 'photo-1460925895917-afdab827c52f'],
};

function getImageUrl(articleId: string, stream: string): string {
  const pool = UNSPLASH_POOLS[stream] || UNSPLASH_POOLS.hot;
  let hash = 0;
  for (let i = 0; i < articleId.length; i++) hash = ((hash << 5) - hash + articleId.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % pool.length;
  return `https://images.unsplash.com/${pool[idx]}?w=400&h=250&fit=crop&auto=format`;
}

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
  const [tickerIndex, setTickerIndex] = useState(0);
  const { articles, market, loading } = useNewsData(activeStream);

  // Ticker auto-rotate
  const hotArticles = articles.filter(a => a.stream === 'hot').slice(0, 5);
  useEffect(() => {
    if (hotArticles.length === 0) return;
    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % hotArticles.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [hotArticles.length]);

  const activeStreamData = NEWS_STREAMS.find(s => s.id === activeStream);

  return (
    <main className="min-h-screen bg-[#0b1120] grain-overlay">
      <Header />

      {/* Hot Ticker */}
      <div className="pt-24">
        <div className="bg-gradient-to-r from-rose-500/10 via-transparent to-rose-500/10 border-b border-rose-500/20">
          <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-3">
            <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">LIVE</span>
            <div className="flex-1 overflow-hidden">
              {hotArticles.length > 0 && (
                <Link to={`/tin-tuc/${hotArticles[tickerIndex]?.id}?stream=hot`}
                  className="text-sm text-foreground hover:text-cyan-400 transition-colors truncate block font-medium">
                  🔥 {hotArticles[tickerIndex]?.title}
                </Link>
              )}
            </div>
            <div className="flex gap-1">
              {hotArticles.map((_, i) => (
                <button key={i} onClick={() => setTickerIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === tickerIndex ? 'bg-rose-400' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Market Pulse */}
      <section className="py-4 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">📊 NHỊP ĐẬP THỊ TRƯỜNG</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {market.global && (
              <>
                <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">BTC DOMINANCE</div>
                  <div className="text-sm font-bold text-foreground">{market.global.btc_dominance.toFixed(1)}%</div>
                </div>
                <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">TOTAL MCAP</div>
                  <div className="text-sm font-bold text-foreground">${(market.global.total_market_cap / 1e12).toFixed(2)}T</div>
                  <div className={`text-[10px] font-mono ${market.global.market_cap_change_24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {market.global.market_cap_change_24h > 0 ? '+' : ''}{market.global.market_cap_change_24h.toFixed(2)}%
                  </div>
                </div>
              </>
            )}
            {market.fng && (
              <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">FEAR & GREED</div>
                <div className={`text-sm font-bold ${market.fng.value > 60 ? 'text-emerald-400' : market.fng.value < 40 ? 'text-red-400' : 'text-amber-400'}`}>
                  {market.fng.value} — {market.fng.classification}
                </div>
              </div>
            )}
            <div className="bg-[#0d1526] border border-white/5 rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground/60 font-mono mb-1">VOL 24H</div>
              <div className="text-sm font-bold text-foreground">
                {market.global ? `$${(market.global.total_volume / 1e9).toFixed(1)}B` : '...'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stream Tabs */}
      <section className="pb-4 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {NEWS_STREAMS.map(stream => (
              <button key={stream.id} onClick={() => setActiveStream(stream.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 border ${
                  activeStream === stream.id
                    ? `${stream.bgColor} ${stream.color} ${stream.borderColor} font-bold`
                    : 'text-muted-foreground border-transparent hover:bg-white/5'
                }`}>
                <span>{stream.icon}</span>
                <span>{stream.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Coins */}
      {market.trending.length > 0 && activeStream === 'hot' && (
        <section className="pb-6 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-rose-400/80 uppercase tracking-widest">🔥 TOP COIN ĐANG HOT</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {market.trending.map(coin => (
                <a key={coin.id} href={`https://www.okx.com/join/UNCLETRADER`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#0d1526] border border-white/5 rounded-lg px-3 py-2 hover:border-cyan-500/30 transition-all shrink-0">
                  <img src={coin.thumb} alt={coin.name} className="w-5 h-5 rounded-full" />
                  <span className="text-xs font-bold text-foreground">{coin.symbol.toUpperCase()}</span>
                  <span className="text-[10px] text-muted-foreground">#{coin.market_cap_rank || '—'}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Article Grid */}
      <section className="py-6 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#0d1526] border border-white/5 rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map(article => {
                const stream = NEWS_STREAMS.find(s => s.id === article.stream);
                const bullets = parseBullets(article.summary || '');
                const imgUrl = article.image_url || getImageUrl(article.id, article.stream);

                return (
                  <div key={article.id} className="bg-[#0d1526] border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-white/10 transition-all group">
                    {/* Hero Image */}
                    <div className="relative h-40 overflow-hidden">
                      <img src={imgUrl} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1526] to-transparent" />
                      <div className="absolute bottom-2 left-3 flex gap-1.5">
                        {article.badge && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${article.badge_color || ''}`}>
                            {article.badge}
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${stream?.borderColor} ${stream?.color} ${stream?.bgColor}`}>
                          {article.source}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-1.5">
                        {article.title}
                      </h3>
                      <span className="text-[10px] text-muted-foreground/60 mb-3">{formatDate(article.published_at)}</span>

                      {/* AI Summary */}
                      {bullets.length > 0 && (
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 mb-3 flex-1">
                          <div className="text-[9px] font-bold text-cyan-400/80 uppercase tracking-wider mb-2">✨ AI Tóm Tắt</div>
                          <ul className="space-y-1.5">
                            {bullets.slice(0, 3).map((bullet, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                                <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="space-y-2 mt-auto">
                        <Link to={`/tin-tuc/${article.id}?stream=${article.stream}`}
                          className="w-full block text-center text-[11px] font-bold py-2 px-4 rounded-xl border border-white/10 text-foreground hover:border-cyan-400/40 hover:text-cyan-400 transition-all">
                          📖 Đọc chi tiết
                        </Link>
                        {stream && (
                          <a href={stream.ctaLink} target="_blank" rel="noopener noreferrer"
                            className={`w-full block text-center text-[10px] font-bold py-2 px-4 rounded-xl border ${stream.borderColor} ${stream.color} hover:${stream.bgColor} transition-all`}>
                            {stream.ctaLabel}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && articles.length === 0 && (
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
