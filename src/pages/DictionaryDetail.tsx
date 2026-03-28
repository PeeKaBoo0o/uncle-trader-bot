import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TERMS_DETAIL, TERMS } from '@/data/dictionaryTerms';

const DictionaryDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const detail = slug ? TERMS_DETAIL[slug] : null;
  const basicTerm = TERMS.find(t => t.id === slug);

  useEffect(() => {
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

  // If we have a detailed entry, show full basic/advanced
  if (detail) {
    const sections = [
      { level: 'Cơ Bản', icon: '📗', data: detail.basic, color: 'border-emerald-400/30 bg-emerald-400/5' },
      { level: 'Nâng Cao', icon: '📕', data: detail.advanced, color: 'border-violet-400/30 bg-violet-400/5' },
    ];

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
          </div>
        </section>
        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {sections.map(({ level, icon, data, color }) => (
              <div key={level} className={`glass-card rounded-2xl p-6 lg:p-8 border ${color}`}>
                <h2 className="font-display font-bold text-xl text-foreground mb-6 flex items-center gap-2">
                  <span>{icon}</span> {level}
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
                    <p className="text-muted-foreground leading-relaxed">{data.howToApply}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-red-400/80 uppercase tracking-wider mb-2 font-mono-custom">⚠️ LỖI THƯỜNG GẶP</h3>
                    <p className="text-muted-foreground leading-relaxed">{data.commonMistakes}</p>
                  </div>
                </div>
              </div>
            ))}
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
