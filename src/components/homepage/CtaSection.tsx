import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const CtaSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = entry.target.querySelectorAll('.reveal-hidden');
            els.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), i * 120));
          }
        });
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(124,58,237,0.12) 0%, rgba(0,212,255,0.06) 40%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-cyan-brand/5 animate-rotate-slow" style={{ animationDuration: '30s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-violet-brand/10" style={{ animation: 'rotateSlow 20s linear infinite reverse' }} />
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
        <div className="reveal-hidden inline-flex items-center gap-2 glass-card rounded-full px-5 py-2.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-gold-brand animate-pulse" />
          <span className="font-mono-custom text-xs text-gold-brand tracking-wider">CÒN 12 SLOT VIP THÁNG NÀY</span>
        </div>

        <h2 className="reveal-hidden font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight mb-6">
          Bắt Đầu Giao Dịch{' '}
          <span className="text-gradient-cyan italic block mt-2">Có Lợi Nhuận Hôm Nay.</span>
        </h2>

        <p className="reveal-hidden text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto mb-10">
          Tham gia cùng hơn 2,400 trader đang sử dụng tín hiệu và chiến lược của UNCLETRADER. Tư vấn miễn phí 30 phút để xác định gói phù hợp với bạn.
        </p>

        <div className="reveal-hidden flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link to="/contact" className="btn-primary px-10 py-4 rounded-xl text-base font-semibold inline-flex items-center justify-center gap-2 animate-pulse-glow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Đặt Lịch Tư Vấn Miễn Phí
          </Link>
          <Link to="/services" className="btn-outline px-8 py-4 rounded-xl text-base font-semibold inline-flex items-center justify-center gap-2">
            Xem Bảng Giá
          </Link>
        </div>

        <div className="reveal-hidden flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {['✓ Không cam kết dài hạn', '✓ Hủy bất cứ lúc nào', '✓ Hỗ trợ 24/7', '✓ Bảo đảm hoàn tiền 7 ngày'].map((item) => (
            <span key={item} className="font-mono-custom text-xs">{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
