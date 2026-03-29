import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const tiers = [
  {
    id: 'signals',
    label: 'STARTER',
    name: 'Gói Tín Hiệu',
    tagline: 'Phù hợp cho trader muốn bắt đầu theo tín hiệu ngay',
    price: '499,000₫',
    period: '/tháng',
    color: 'cyan',
    featured: false,
    features: [
      { text: 'Tín hiệu Spot & Futures hàng ngày', included: true },
      { text: 'Entry, Stop-Loss, Take-Profit rõ ràng', included: true },
      { text: 'Phân tích thị trường buổi sáng', included: true },
      { text: 'Nhóm Telegram riêng', included: true },
      { text: 'Hỗ trợ qua chat', included: true },
      { text: 'Khóa học cơ bản', included: false },
      { text: 'Coaching 1-1', included: false },
    ],
    cta: 'Đăng Ký Ngay',
  },
  {
    id: 'education',
    label: 'GROWTH',
    name: 'Gói Học & Tín Hiệu',
    tagline: 'Kết hợp tín hiệu với kiến thức để tự ra quyết định',
    price: '1,200,000₫',
    period: '/khóa',
    color: 'violet',
    featured: true,
    features: [
      { text: 'Tất cả trong Gói Tín Hiệu', included: true },
      { text: '50+ bài học video HD', included: true },
      { text: 'Technical Analysis nâng cao', included: true },
      { text: 'On-chain Data Analysis', included: true },
      { text: 'Quản lý rủi ro & psychology', included: true },
      { text: 'Cộng đồng Discord riêng', included: true },
      { text: 'Coaching 1-1', included: false },
    ],
    cta: 'Chọn Gói Này',
  },
  {
    id: 'vip',
    label: 'PREMIUM',
    name: 'VIP Mentorship',
    tagline: 'Được hướng dẫn trực tiếp để tăng tốc kết quả',
    price: 'Liên hệ',
    period: '',
    color: 'gold',
    featured: false,
    features: [
      { text: 'Tất cả trong Gói Học & Tín Hiệu', included: true },
      { text: 'Coaching 1-1 hàng tuần', included: true },
      { text: 'Portfolio review hàng tháng', included: true },
      { text: 'Chiến lược cá nhân hóa', included: true },
      { text: 'Hỗ trợ không giới hạn Telegram', included: true },
      { text: 'Trade room live', included: true },
      { text: 'Priority support 24/7', included: true },
    ],
    cta: 'Liên Hệ Tư Vấn',
  },
];

const colorMap: Record<string, { text: string; bg: string; border: string; badgeBg: string; badgeText: string; btnClass: string; checkColor: string }> = {
  cyan: { text: 'text-cyan-brand', bg: 'bg-cyan-brand/5', border: 'border-cyan-brand/20', badgeBg: 'bg-cyan-brand/10', badgeText: 'text-cyan-brand', btnClass: 'btn-primary', checkColor: 'text-cyan-brand' },
  violet: { text: 'text-violet-light', bg: 'bg-violet-brand/10', border: 'border-violet-brand/30', badgeBg: 'bg-violet-brand/20', badgeText: 'text-violet-light', btnClass: 'bg-violet-brand hover:bg-violet-light text-foreground font-semibold transition-all duration-300 hover:-translate-y-1', checkColor: 'text-violet-light' },
  gold: { text: 'text-gold-brand', bg: 'bg-gold-brand/5', border: 'border-gold-brand/20', badgeBg: 'bg-gold-brand/10', badgeText: 'text-gold-brand', btnClass: 'bg-gold-brand hover:bg-yellow-400 text-navy font-semibold transition-all duration-300 hover:-translate-y-1', checkColor: 'text-gold-brand' },
};

const faqs = [
  { q: 'Tín hiệu được gửi như thế nào?', a: 'Tín hiệu được gửi qua nhóm Telegram riêng, bao gồm entry, stop-loss và take-profit rõ ràng cho từng lệnh.' },
  { q: 'Tôi cần bao nhiêu vốn để bắt đầu?', a: 'Bạn có thể bắt đầu với bất kỳ số vốn nào. Chúng tôi khuyên tối thiểu $500 cho Spot và $200 cho Futures.' },
  { q: 'Có cam kết thời gian không?', a: 'Không. Bạn có thể hủy bất cứ lúc nào. Chúng tôi tin vào chất lượng dịch vụ, không phải cam kết dài hạn.' },
  { q: 'Làm sao để được tư vấn gói VIP?', a: 'Bạn có thể liên hệ trực tiếp qua trang Liên Hệ hoặc Telegram để đặt lịch tư vấn miễn phí 30 phút.' },
];

const Services: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = entry.target.querySelectorAll('.reveal-hidden');
            els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), i * 100));
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.page-reveal');
    els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), 200 + i * 150));
  }, []);

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden line-grid">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <div className="reveal-hidden page-reveal inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8">
            <span className="font-mono-custom text-xs text-cyan-brand tracking-wider">DỊCH VỤ</span>
          </div>
          <h1 className="reveal-hidden page-reveal font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
            Giải Pháp Trading{' '}<span className="text-gradient-cyan italic">Toàn Diện</span>
          </h1>
          <p className="reveal-hidden page-reveal text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            Từ tín hiệu giao dịch hàng ngày đến mentorship 1-1 chuyên sâu, UNCLETRADER có đủ công cụ để đưa bạn từ thua lỗ sang có lợi nhuận ổn định.
          </p>
          <div className="reveal-hidden page-reveal flex items-center justify-center gap-8 mt-10">
            {[
              { label: 'Signals', count: '400+', color: 'text-cyan-brand' },
              { label: 'Học viên', count: '2,400+', color: 'text-violet-light' },
              { label: 'Win Rate', count: '78%', color: 'text-gold-brand' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className={`font-display font-bold text-3xl ${item.color} mb-1`}>{item.count}</div>
                <div className="font-mono-custom text-xs text-muted-foreground tracking-wide">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video giới thiệu */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="section-label mb-4">VIDEO HƯỚNG DẪN</div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
              Thiết Lập <span className="text-gradient-cyan italic">Chuyên Nghiệp</span>
            </h2>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden cyber-border">
            <video
              controls
              className="w-full aspect-video"
              poster=""
              preload="metadata"
            >
              <source src="/videos/thiet-lap-laptop.mp4" type="video/mp4" />
              Trình duyệt không hỗ trợ video.
            </video>
          </div>
        </div>
      </section>

      {/* Pricing tiers */}
      <section ref={sectionRef} className="py-16 pb-24 relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
            {tiers.map((tier, idx) => {
              const colors = colorMap[tier.color];
              return (
                <div
                  key={tier.id}
                  className={`reveal-hidden relative rounded-2xl overflow-hidden transition-all duration-500 ${
                    tier.featured ? `${colors.bg} border-2 ${colors.border} shadow-violet-glow lg:scale-105` : 'glass-card glass-card-hover'
                  }`}
                  style={{ transitionDelay: `${idx * 120}ms` }}
                >
                  {tier.featured && (
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colors.badgeBg} ${colors.border} border rounded-full px-4 py-1.5`}>
                      <span className={`font-mono-custom text-xs ${colors.badgeText} font-semibold tracking-wider`}>⭐ PHỔ BIẾN NHẤT</span>
                    </div>
                  )}
                  <div className="p-7 lg:p-8">
                    <div className="mb-6">
                      <div className={`section-label mb-2 ${colors.text}`}>{tier.label}</div>
                      <h3 className="font-display font-bold text-2xl text-foreground tracking-tight mb-2">{tier.name}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{tier.tagline}</p>
                    </div>
                    <div className="mb-7 pb-7 border-b border-cyan-brand/10">
                      <div className={`font-display font-bold text-3xl ${colors.text} mb-1`}>
                        {tier.price}
                        {tier.period && <span className="text-muted-foreground font-normal text-base ml-1">{tier.period}</span>}
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {tier.features.map((feature) => (
                        <li key={feature.text} className="flex items-start gap-3">
                          {feature.included ? (
                            <svg className={`w-5 h-5 ${colors.checkColor} shrink-0 mt-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                          ) : (
                            <svg className="w-5 h-5 text-muted-foreground/30 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          )}
                          <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground/50'}`}>{feature.text}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/contact" className={`block w-full text-center px-6 py-3.5 rounded-xl ${colors.btnClass}`}>{tier.cta}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 pb-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="section-label mb-4">CÂU HỎI THƯỜNG GẶP</div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
              Bạn Thắc Mắc?{' '}<span className="text-gradient-cyan italic">Chúng Tôi Trả Lời.</span>
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-foreground pr-4">{faq.q}</span>
                  <svg className={`w-5 h-5 text-cyan-brand shrink-0 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <div className={`faq-content ${openFaq === idx ? 'open' : ''}`}>
                  <div className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto glass-card rounded-2xl p-10 lg:p-14 text-center cyber-border">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight mb-4">
            Sẵn Sàng Bắt Đầu?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Đặt lịch tư vấn miễn phí 30 phút để tìm gói phù hợp nhất với bạn.
          </p>
          <Link to="/contact" className="btn-primary px-10 py-4 rounded-xl text-base font-semibold inline-flex items-center gap-2 animate-pulse-glow">
            Tư Vấn Miễn Phí
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Services;
