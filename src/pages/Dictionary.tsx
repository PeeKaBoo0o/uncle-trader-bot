import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import { TERMS, CATEGORIES } from '@/data/dictionaryTerms';

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
            <span className="font-mono-custom text-xs text-cyan-400 tracking-wider">📖 Từ điển Trading Chuyên nghiệp</span>
          </div>
          <h1 className="reveal-hidden page-reveal font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
            Từ Điển <span className="text-gradient-cyan italic">Trading</span>
          </h1>
          <p className="reveal-hidden page-reveal text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto font-mono-custom">
            {TERMS.length} thuật ngữ · Cơ bản + Nâng cao · Ví dụ thực tế · Cách áp dụng
          </p>
        </div>
      </section>

      {/* Category Pills */}
      <section className="pb-2 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex gap-2 flex-wrap justify-center">
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                activeCategory === cat.label
                  ? `${cat.color} border-current bg-current/10`
                  : 'text-muted-foreground/60 border-foreground/10 hover:text-foreground hover:border-foreground/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Search */}
      <section className="pb-6 px-6 lg:px-8 pt-4">
        <div className="max-w-4xl mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Tìm kiếm thuật ngữ... (ví dụ: RSI, breakout, stop loss, DCA)"
            className="crypto-input w-full rounded-xl px-5 py-3"
          />
        </div>
      </section>

      {/* Terms Grid */}
      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-sm text-muted-foreground mb-6">{filtered.length} thuật ngữ</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((term) => (
              <Link
                key={term.id}
                to={`/tu-dien/${term.id}`}
                className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-display font-bold text-base text-foreground group-hover:text-cyan-400 transition-colors">
                      {term.term}
                    </h3>
                    <span className="text-[11px] text-muted-foreground/50 font-mono-custom">{term.english}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-current/20 bg-current/5 ${term.categoryColor} shrink-0`}>
                    {term.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">{term.definition}</p>
                {term.example && (
                  <div className="mt-3 bg-foreground/[0.03] rounded-lg p-2.5 border border-foreground/5">
                    <span className="text-[10px] text-cyan-400/80 font-mono-custom">VÍ DỤ:</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{term.example}</p>
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
