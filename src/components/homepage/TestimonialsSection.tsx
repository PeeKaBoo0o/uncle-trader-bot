import React, { useState, useEffect, useRef } from 'react';

const testimonials = [
  {
    name: 'Minh Đức N.',
    role: 'Trader cá nhân, TP.HCM',
    quote: 'Sau 3 tháng theo tín hiệu và học phương pháp của Uncle, tài khoản tôi đã tăng đáng kể. Quan trọng nhất là tôi hiểu tại sao mình vào lệnh.',
    result: '+67% trong 3 tháng',
    resultColor: 'text-green-400',
    avatar: 'MD',
    avatarBg: 'bg-cyan-brand/20 text-cyan-brand',
  },
  {
    name: 'Thanh Hương T.',
    role: 'Nhà đầu tư crypto, Hà Nội',
    quote: 'Cách Uncle giải thích on-chain data và market structure thực sự khác biệt. Không phải ai cũng dạy cách quản lý rủi ro nghiêm túc như vậy.',
    result: 'Phục hồi vốn trong 5 tháng',
    resultColor: 'text-violet-light',
    avatar: 'TH',
    avatarBg: 'bg-violet-brand/20 text-violet-light',
  },
  {
    name: 'Bảo Long P.',
    role: 'Full-time trader, Đà Nẵng',
    quote: 'UNCLETRADER là duy nhất có track record minh bạch và giải thích lý do từng lệnh. Hiện tại trading đã trở thành nguồn thu nhập chính của tôi.',
    result: 'Thu nhập full-time từ trading',
    resultColor: 'text-gold-brand',
    avatar: 'BL',
    avatarBg: 'bg-gold-brand/20 text-gold-brand',
  },
  {
    name: 'Ngọc Anh L.',
    role: 'Kỹ sư phần mềm, TP.HCM',
    quote: 'VIP Mentorship 1-1 là quyết định đầu tư tốt nhất tôi từng làm. Uncle giúp xây dựng tư duy quản lý tài sản dài hạn rất chuyên nghiệp.',
    result: 'ROI 45% trong Q4/2025',
    resultColor: 'text-green-400',
    avatar: 'NA',
    avatarBg: 'bg-cyan-brand/20 text-cyan-brand',
  },
];

const TestimonialsSection: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (idx: number) => {
    if (isTransitioning || idx === activeIdx) return;
    setIsTransitioning(true);
    setTimeout(() => { setActiveIdx(idx); setIsTransitioning(false); }, 300);
  };

  useEffect(() => {
    autoRef.current = setInterval(() => setActiveIdx((prev) => (prev + 1) % testimonials.length), 5000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  const resetAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setActiveIdx((prev) => (prev + 1) % testimonials.length), 5000);
  };

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

  const active = testimonials[activeIdx];

  return (
    <section ref={sectionRef} className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.05) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 reveal-hidden">
          <div className="section-label mb-4">PHẢN HỒI THÀNH VIÊN</div>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground tracking-tight">
            Kết Quả{' '}<span className="text-gradient-cyan italic">Thực Tế</span>
          </h2>
        </div>

        <div className="reveal-hidden">
          <div className="glass-card rounded-2xl p-8 lg:p-12 cyber-border">
            <div className="grid lg:grid-cols-5 gap-8 items-start">
              <div className="lg:col-span-2">
                <div className={`w-16 h-16 rounded-2xl ${active.avatarBg} flex items-center justify-center font-display font-bold text-2xl mb-5 transition-all duration-500`}>
                  {active.avatar}
                </div>
                <div className="font-semibold text-foreground text-lg mb-1">{active.name}</div>
                <div className="text-muted-foreground text-sm mb-6">{active.role}</div>
                <div className="glass-card rounded-xl p-4">
                  <div className="font-mono-custom text-xs text-muted-foreground mb-1">KẾT QUẢ</div>
                  <div className={`font-display font-bold text-lg ${active.resultColor} transition-all duration-500`}>{active.result}</div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-cyan-brand/20 mb-6">
                  <path d="M14.017 21V18C14.017 16.895 14.912 16 16.017 16H19.017C19.569 16 20.017 15.552 20.017 15V9C20.017 8.448 19.569 8 19.017 8H15.017C14.465 8 14.017 8.448 14.017 9V11C14.017 11.552 13.569 12 13.017 12H12.017V5H22.017V15C22.017 18.314 19.331 21 16.017 21H14.017ZM5.017 21V18C5.017 16.895 5.912 16 7.017 16H10.017C10.569 16 11.017 15.552 11.017 15V9C11.017 8.448 10.569 8 10.017 8H6.017C5.465 8 5.017 8.448 5.017 9V11C5.017 11.552 4.569 12 4.017 12H3.017V5H13.017V15C13.017 18.314 10.331 21 7.017 21H5.017Z" />
                </svg>
                <blockquote className={`font-display text-xl lg:text-2xl text-foreground leading-relaxed tracking-tight transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                  "{active.quote}"
                </blockquote>
              </div>
            </div>

            <div className="flex items-center justify-between mt-10 pt-8 border-t border-cyan-brand/10">
              <div className="flex items-center gap-2">
                {testimonials.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { goTo(idx); resetAuto(); }}
                    className={`transition-all duration-300 rounded-full ${idx === activeIdx ? 'w-8 h-2 bg-cyan-brand' : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { goTo((activeIdx - 1 + testimonials.length) % testimonials.length); resetAuto(); }} className="w-10 h-10 glass-card rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button onClick={() => { goTo((activeIdx + 1) % testimonials.length); resetAuto(); }} className="w-10 h-10 glass-card rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[
            { value: '2,400+', label: 'Thành Viên' },
            { value: '78%', label: 'Tỉ Lệ Thắng' },
            { value: '400+', label: 'Trade Đã Chia Sẻ' },
            { value: '4.9/5', label: 'Đánh Giá TB' },
          ].map((stat, idx) => (
            <div key={stat.label} className="reveal-hidden glass-card rounded-xl p-5 text-center" style={{ transitionDelay: `${idx * 80}ms` }}>
              <div className="font-display font-bold text-2xl text-gradient-cyan mb-1">{stat.value}</div>
              <div className="font-mono-custom text-xs text-muted-foreground tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
