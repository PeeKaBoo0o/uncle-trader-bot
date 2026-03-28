import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const TERMS_DATA: Record<string, { term: string; english: string; category: string; basic: { definition: string; example: string; howToApply: string; commonMistakes: string }; advanced: { definition: string; example: string; howToApply: string; commonMistakes: string } }> = {
  'support-resistance': {
    term: 'Hỗ Trợ & Kháng Cự', english: 'Support & Resistance', category: 'Phân Tích Kỹ Thuật',
    basic: { definition: 'Vùng giá mà tại đó lực mua (hỗ trợ) hoặc lực bán (kháng cự) đủ mạnh để ngăn giá đi xa hơn.', example: 'BTC có hỗ trợ tại $60,000 — giá bounce 3 lần từ vùng này.', howToApply: 'Vẽ đường ngang tại các mức giá mà giá đã đảo chiều nhiều lần. Mua gần hỗ trợ, bán gần kháng cự.', commonMistakes: 'Đặt entry ngay tại mức S/R thay vì chờ xác nhận. S/R là vùng, không phải đường chính xác.' },
    advanced: { definition: 'S/R động (Dynamic S/R) từ EMA, Bollinger Bands. S/R flipping — khi kháng cự bị phá vỡ sẽ trở thành hỗ trợ.', example: 'BTC phá $68K (kháng cự) → retest $68K thành hỗ trợ → Long entry.', howToApply: 'Kết hợp S/R với volume profile, order flow. Xác nhận bằng nến đảo chiều + volume.', commonMistakes: 'Bỏ qua context (xu hướng lớn). S/R yếu khi volume thấp.' },
  },
  'breakout': {
    term: 'Breakout', english: 'Breakout', category: 'Price Action',
    basic: { definition: 'Khi giá phá vỡ qua vùng hỗ trợ hoặc kháng cự quan trọng với volume lớn.', example: 'ETH breakout trên $4,000 với volume tăng 250%.', howToApply: 'Chờ nến đóng cửa trên/dưới S/R + volume xác nhận. Entry sau breakout hoặc retest.', commonMistakes: 'FOMO vào ngay khi giá chạm S/R, không chờ xác nhận. Dễ bị fakeout.' },
    advanced: { definition: 'Breakout with retest, failed breakout (fakeout trap), breakout từ consolidation. Volume confirmation rất quan trọng.', example: 'BTC phá $68K → pullback retest $68K → bounce + volume = Long confirmed.', howToApply: 'Dùng multi-timeframe: breakout trên H4+ mới tin cậy. Kết hợp Bollinger Squeeze.', commonMistakes: 'Không phân biệt breakout thật vs fakeout. Cần volume > 2x trung bình.' },
  },
  'rsi': {
    term: 'RSI', english: 'Relative Strength Index', category: 'Indicator',
    basic: { definition: 'RSI đo lường tốc độ và biên độ thay đổi giá. Giá trị 0-100. >70 quá mua, <30 quá bán.', example: 'RSI 14 chạm 25 → vùng quá bán → theo dõi tín hiệu mua.', howToApply: 'Dùng RSI 14 làm mặc định. Tìm vùng quá mua/bán kết hợp S/R.', commonMistakes: 'Mua ngay khi RSI < 30 — trong downtrend mạnh, RSI có thể ở vùng quá bán rất lâu.' },
    advanced: { definition: 'RSI Divergence (phân kỳ), Hidden Divergence, RSI failure swing. RSI trên các timeframe khác nhau.', example: 'Giá tạo đỉnh mới + RSI đỉnh thấp hơn = Regular bearish divergence.', howToApply: 'Kết hợp RSI divergence với S/R zone. Hidden divergence xác nhận xu hướng tiếp tục.', commonMistakes: 'Dùng RSI đơn lẻ. Luôn kết hợp với price action và volume.' },
  },
};

const DictionaryDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const term = slug ? TERMS_DATA[slug] : null;

  useEffect(() => {
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, [slug]);

  if (!term) {
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

  const sections = [
    { level: 'Cơ Bản', icon: '📗', data: term.basic, color: 'border-emerald-400/30 bg-emerald-400/5' },
    { level: 'Nâng Cao', icon: '📕', data: term.advanced, color: 'border-violet-400/30 bg-violet-400/5' },
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
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground border border-white/10 mb-4 inline-block">{term.category}</span>
            <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground tracking-tight mb-2">{term.term}</h1>
            <p className="text-muted-foreground font-mono-custom text-sm">{term.english}</p>
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
                  <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
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
};

export default DictionaryDetail;
