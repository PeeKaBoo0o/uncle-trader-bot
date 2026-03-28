import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const services = [
  {
    icon: '📊',
    title: 'Tín Hiệu Giao Dịch',
    desc: 'Entry, SL, TP rõ ràng mỗi ngày. Spot & Futures.',
    color: 'cyan',
    href: '/services',
  },
  {
    icon: '🎓',
    title: 'Khóa Học Trading',
    desc: '50+ bài học video từ cơ bản đến nâng cao.',
    color: 'violet',
    href: '/services',
  },
  {
    icon: '🏆',
    title: 'VIP Mentorship',
    desc: 'Coaching 1-1, portfolio review, chiến lược cá nhân.',
    color: 'gold',
    href: '/services',
  },
];

const colorMap: Record<string, { text: string; bg: string; border: string }> = {
  cyan: { text: 'text-cyan-brand', bg: 'bg-cyan-brand/10', border: 'border-cyan-brand/20' },
  violet: { text: 'text-violet-light', bg: 'bg-violet-brand/10', border: 'border-violet-brand/20' },
  gold: { text: 'text-gold-brand', bg: 'bg-gold-brand/10', border: 'border-gold-brand/20' },
};

const ServicesPreview: React.FC = () => {
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
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 lg:py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 reveal-hidden">
          <div className="section-label mb-4">DỊCH VỤ</div>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground tracking-tight mb-4">
            Giải Pháp{' '}
            <span className="text-gradient-cyan italic">Toàn Diện</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Từ tín hiệu hàng ngày đến mentorship chuyên sâu
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service, idx) => {
            const colors = colorMap[service.color];
            return (
              <Link
                key={service.title}
                to={service.href}
                className="reveal-hidden glass-card glass-card-hover rounded-2xl p-8 text-center group block"
                style={{ transitionDelay: `${idx * 120}ms` }}
              >
                <div className={`w-16 h-16 ${colors.bg} ${colors.border} border rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 group-hover:scale-110 transition-transform`}>
                  {service.icon}
                </div>
                <h3 className="font-display font-semibold text-xl text-foreground mb-3">{service.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{service.desc}</p>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-12 reveal-hidden">
          <Link to="/services" className="btn-outline px-8 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
            Xem Chi Tiết Bảng Giá
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ServicesPreview;
