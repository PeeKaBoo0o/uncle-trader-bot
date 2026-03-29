import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TERMS_DETAIL, TERMS } from '@/data/dictionaryTerms';

// Import illustrations
import imgSR from '@/assets/dict/support-resistance.jpg';
import imgBreakout from '@/assets/dict/breakout.jpg';
import imgRSI from '@/assets/dict/rsi-divergence.jpg';
import imgMACD from '@/assets/dict/macd.jpg';
import imgFib from '@/assets/dict/fibonacci.jpg';
import imgBB from '@/assets/dict/bollinger-bands.jpg';
import imgLeverage from '@/assets/dict/leverage.jpg';
import imgScalping from '@/assets/dict/scalping.jpg';
import imgDCA from '@/assets/dict/dca.jpg';

const ILLUSTRATIONS: Record<string, string> = {
  'support-resistance': imgSR,
  'breakout': imgBreakout,
  'rsi': imgRSI,
  'macd': imgMACD,
  'fibonacci': imgFib,
  'bollinger-bands': imgBB,
  'leverage': imgLeverage,
  'scalping': imgScalping,
  'dca': imgDCA,
};

const DictionaryDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const detail = slug ? TERMS_DETAIL[slug] : null;
  const basicTerm = TERMS.find(t => t.id === slug);
  const illustration = slug ? ILLUSTRATIONS[slug] : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, [slug]);

  if (!detail && !basicTerm) {
    return (
      <main className="min-h-screen bg-navy grain-overlay">
        <Header />
        <section className="pt-32 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-5xl mb-6">📖</div>
            <h1 className="font-display font-bold text-3xl text-foreground mb-4">Thuật ngữ không tìm thấy</h1>
            <p className="text-muted-foreground mb-8">Thuật ngữ bạn tìm chưa có trong từ điển.</p>
            <Link to="/tu-dien" className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold">← Quay lại Từ Điển</Link>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  if (detail) {
    const sections = [
      { level: 'Cơ Bản', icon: '📗', data: detail.basic, color: 'border-emerald-400/30 bg-emerald-400/5', isAdvanced: false },
      { level: 'Nâng Cao', icon: '📕', data: detail.advanced, color: 'border-violet-400/30 bg-violet-400/5', isAdvanced: true },
    ];

    // Get related terms info
    const relatedTermsList = (detail.relatedTerms || [])
      .map(id => {
        const t = TERMS.find(term => term.id === id);
        return t ? { ...t } : null;
      })
      .filter(Boolean) as typeof TERMS;

    return (
      <main className="min-h-screen bg-navy grain-overlay">
        <Header />
        <section className="pt-32 pb-8 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Link to="/tu-dien" className="reveal-hidden page-reveal inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-cyan-400 transition-colors mb-6">
              ← Quay lại Từ Điển
            </Link>
            <div className="reveal-hidden page-reveal">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground border border-foreground/10 mb-4 inline-block">{detail.category}</span>
              <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground tracking-tight mb-2">{detail.term}</h1>
              <p className="text-muted-foreground font-mono-custom text-sm">{detail.english}</p>
            </div>

            {/* Hero illustration */}
            {illustration && (
              <div className="reveal-hidden page-reveal mt-8 rounded-2xl overflow-hidden border border-foreground/10">
                <img src={illustration} alt={`Minh họa ${detail.term}`} loading="lazy" width={800} height={512} className="w-full h-auto object-cover" />
                <div className="bg-foreground/[0.03] px-4 py-2 border-t border-foreground/5">
                  <p className="text-xs text-muted-foreground/60 font-mono-custom">📊 Biểu đồ minh họa — {detail.term}</p>
                </div>
              </div>
            )}

            {/* YouTube Video Embed */}
            {detail.videoId && (
              <div className="reveal-hidden page-reveal mt-8">
                <h2 className="font-display font-bold text-lg text-foreground mb-3 flex items-center gap-2">
                  <span>🎬</span> Video Hướng Dẫn
                </h2>
                <div className="rounded-2xl overflow-hidden border border-foreground/10 bg-foreground/[0.02]">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${detail.videoId}`}
                      title={`Video hướng dẫn ${detail.term}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {sections.map(({ level, icon, data, color, isAdvanced }) => (
              <div key={level} className={`glass-card rounded-2xl p-6 lg:p-8 border ${color}`}>
                <h2 className="font-display font-bold text-xl text-foreground mb-6 flex items-center gap-2">
                  <span>{icon}</span> {level}
                  {isAdvanced && <span className="ml-auto text-[10px] font-mono-custom px-2 py-0.5 rounded-full bg-violet-400/10 text-violet-400 border border-violet-400/20">PRO</span>}
                </h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-2 font-mono-custom">ĐỊNH NGHĨA</h3>
                    <p className="text-muted-foreground leading-relaxed">{data.definition}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-2 font-mono-custom">VÍ DỤ THỰC TẾ</h3>
                    <div className="bg-foreground/[0.03] rounded-xl p-4 border border-foreground/5">
                      <p className="text-sm text-muted-foreground">{data.example}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-2 font-mono-custom">CÁCH ÁP DỤNG</h3>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{data.howToApply}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-red-400/80 uppercase tracking-wider mb-2 font-mono-custom">⚠️ LỖI THƯỜNG GẶP</h3>
                    <p className="text-muted-foreground leading-relaxed">{data.commonMistakes}</p>
                  </div>

                  {isAdvanced && 'proTips' in data && (data as any).proTips && (
                    <div className="mt-4 pt-4 border-t border-foreground/5">
                      <h3 className="text-xs font-bold text-amber-400/80 uppercase tracking-wider mb-3 font-mono-custom">💡 PRO TIPS</h3>
                      <ul className="space-y-2">
                        {((data as any).proTips as string[]).map((tip: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                            <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-[10px] text-amber-400 font-bold">{i + 1}</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isAdvanced && 'keyTakeaways' in data && (data as any).keyTakeaways && (
                    <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 font-mono-custom">🎯 KEY TAKEAWAYS</h3>
                      <ul className="space-y-2">
                        {((data as any).keyTakeaways as string[]).map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Related Terms */}
            {relatedTermsList.length > 0 && (
              <div className="glass-card rounded-2xl p-6 lg:p-8 border border-foreground/10">
                <h2 className="font-display font-bold text-xl text-foreground mb-4 flex items-center gap-2">
                  <span>🔗</span> Thuật Ngữ Liên Quan
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedTermsList.map(rt => (
                    <Link
                      key={rt.id}
                      to={`/tu-dien/${rt.id}`}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-cyan-400/20 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-cyan-400 transition-colors truncate">{rt.term}</p>
                        <p className="text-xs text-muted-foreground/60 font-mono-custom truncate">{rt.english}</p>
                      </div>
                      <span className="text-muted-foreground/40 group-hover:text-cyan-400 transition-colors text-lg">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  // Fallback: show basic term info only
  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />
      <section className="pt-32 pb-8 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link to="/tu-dien" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-cyan-400 transition-colors mb-6">
            ← Quay lại Từ Điển
          </Link>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border border-current/20 bg-current/5 ${basicTerm!.categoryColor} mb-4 inline-block`}>{basicTerm!.category}</span>
          <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground tracking-tight mb-2">{basicTerm!.term}</h1>
          <p className="text-muted-foreground font-mono-custom text-sm mb-8">{basicTerm!.english}</p>

          <div className="glass-card rounded-2xl p-6 lg:p-8 border border-foreground/10">
            <h3 className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-3 font-mono-custom">ĐỊNH NGHĨA</h3>
            <p className="text-muted-foreground leading-relaxed text-lg mb-6">{basicTerm!.definition}</p>
            {basicTerm!.example && (
              <>
                <h3 className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-3 font-mono-custom">VÍ DỤ THỰC TẾ</h3>
                <div className="bg-foreground/[0.03] rounded-xl p-4 border border-foreground/5">
                  <p className="text-sm text-muted-foreground">{basicTerm!.example}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default DictionaryDetail;
