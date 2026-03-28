import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useNewsData } from '@/hooks/useNewsData';

const STREAM_META: Record<string, { icon: string; label: string; color: string; ctaLink: string; ctaLabel: string; ctaIcon: string }> = {
  hot: { icon: '🔥', label: 'Tin Nóng', color: 'text-rose-400', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: 'Theo dõi BOT SIGNAL Telegram', ctaIcon: '🚀' },
  whale: { icon: '🐋', label: 'Cá Voi', color: 'text-cyan-400', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: 'Cảnh báo Cá Voi trên Telegram', ctaIcon: '🐋' },
  macro: { icon: '🏛️', label: 'Vĩ Mô', color: 'text-violet-400', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: 'Cập nhật Vĩ Mô qua Telegram', ctaIcon: '📡' },
  event: { icon: '📅', label: 'Sự Kiện', color: 'text-amber-400', ctaLink: 'https://www.okx.com/join/UNCLETRADER', ctaLabel: 'Trade ngay trên OKX — giảm 20% phí', ctaIcon: '💰' },
  sentiment: { icon: '📊', label: 'Tâm Lý', color: 'text-emerald-400', ctaLink: 'https://t.me/UNCLETRADER', ctaLabel: 'Phân tích Tâm Lý trên Telegram', ctaIcon: '📊' },
};

function renderMarkdown(content: string): React.ReactNode[] {
  return content.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;

    if (trimmed.startsWith('## ')) {
      return <h2 key={i} className="text-lg font-display font-bold text-foreground mt-6 mb-3">{trimmed.slice(3)}</h2>;
    }
    if (trimmed.startsWith('### ')) {
      return <h3 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{trimmed.slice(4)}</h3>;
    }
    if (trimmed.match(/^[-•]\s/)) {
      return (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground ml-4 mb-1">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span>{parseInline(trimmed.replace(/^[-•]\s/, ''))}</span>
        </li>
      );
    }
    if (trimmed.match(/^\d+\.\s/)) {
      return (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground ml-4 mb-1">
          <span className="text-amber-400 mt-0.5 font-mono text-xs">{trimmed.match(/^\d+/)?.[0]}.</span>
          <span>{parseInline(trimmed.replace(/^\d+\.\s/, ''))}</span>
        </li>
      );
    }

    return <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{parseInline(trimmed)}</p>;
  });
}

function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);

    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={key++} className="text-foreground font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) parts.push(remaining.slice(0, italicMatch.index));
      parts.push(<em key={key++} className="italic text-foreground/80">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return <>{parts}</>;
}

function parseBullets(summary: string): string[] {
  return summary.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.replace(/^[•\-*]\s*/, ''));
}

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const stream = searchParams.get('stream') || 'hot';
  const { articles } = useNewsData(stream);

  const article = articles.find(a => a.id === id);
  const meta = STREAM_META[stream] || STREAM_META.hot;

  // Related articles
  const related = articles
    .filter(a => a.id !== id && a.stream === stream)
    .slice(0, 3);

  if (!article) {
    return (
      <main className="min-h-screen bg-[#0b1120]">
        <Header />
        <div className="pt-32 text-center">
          <div className="text-5xl mb-4">📰</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Không tìm thấy bài viết</h1>
          <Link to="/tin-tuc" className="text-cyan-400 text-sm hover:underline">← Quay lại Tin Tức</Link>
        </div>
        <Footer />
      </main>
    );
  }

  const bullets = parseBullets(article.summary || '');

  return (
    <main className="min-h-screen bg-[#0b1120]">
      <Header />

      <div className="pt-24 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-3 mb-6">
            <Link to="/tin-tuc" className="text-muted-foreground text-sm hover:text-cyan-400 transition-colors">← Tin Tức</Link>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color} bg-white/5`}>
              {meta.icon} {meta.label}
            </span>
          </div>

          {/* Hero Image */}
          <div className="relative rounded-2xl overflow-hidden mb-8 h-64 md:h-80">
            <img src={article.image_url || `https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200&h=600&fit=crop`}
              alt={article.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/50 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight mb-3">
                {article.title}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                {article.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${article.badge_color}`}>
                    {article.badge}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{article.source}</span>
                <span className="text-xs text-muted-foreground/60">
                  {new Date(article.published_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {bullets.length > 0 && (
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5 mb-8">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">✨ AI Tóm Tắt</div>
              <ul className="space-y-2">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Content */}
          <div className="prose-custom mb-8">
            {article.full_content ? (
              renderMarkdown(article.full_content)
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-display font-bold text-foreground">Tổng Quan</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {article.title}. {article.summary?.replace(/[•\-*]\s*/g, '').replace(/\n/g, ' ')}
                </p>
                <h2 className="text-lg font-display font-bold text-foreground">Kết Luận</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Thị trường đang có những biến động đáng chú ý. Theo dõi chặt chẽ các vùng giá quan trọng và tín hiệu từ BOT SIGNAL để có quyết định giao dịch tốt nhất.
                </p>
              </div>
            )}
          </div>

          {/* CTA Banner */}
          <a href={meta.ctaLink} target="_blank" rel="noopener noreferrer"
            className={`block rounded-xl p-5 border ${meta.color === 'text-amber-400' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-cyan-500/10 border-cyan-500/30'} hover:scale-[1.01] transition-transform mb-10`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{meta.ctaIcon}</span>
              <div>
                <div className={`text-sm font-bold ${meta.color}`}>{meta.ctaLabel}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Nhận tín hiệu giao dịch miễn phí</div>
              </div>
            </div>
          </a>

          {/* Related Articles */}
          {related.length > 0 && (
            <div className="mb-12">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Bài viết liên quan</h3>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {related.map(r => (
                  <Link key={r.id} to={`/tin-tuc/${r.id}?stream=${r.stream}`}
                    className="bg-[#0d1526] border border-white/5 rounded-xl p-4 min-w-[280px] hover:border-white/10 transition-all">
                    <h4 className="text-sm font-semibold text-foreground line-clamp-2 mb-2">{r.title}</h4>
                    <span className="text-[10px] text-muted-foreground/60">{r.source}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
};

export default NewsDetail;
