import React, { useEffect, useRef } from 'react';

const features = [
  {
    icon: '📈',
    label: 'TÍN HIỆU CHÍNH XÁC',
    title: 'Signals Được Kiểm Chứng',
    desc: 'Mỗi tín hiệu đều có entry, stop-loss và take-profit rõ ràng. Tỉ lệ thắng 78% trong 12 tháng gần nhất với hơn 400 trade được ghi lại.',
    stat: '78% win rate',
    color: 'cyan',
  },
  {
    icon: '👥',
    label: 'CỘNG ĐỒNG',
    title: 'Hơn 2,400 Trader Đang Học',
    desc: 'Cộng đồng trader chuyên nghiệp nơi bạn có thể thảo luận chiến lược, chia sẻ phân tích và học hỏi từ những người đi trước.',
    stat: '2,400+ thành viên',
    color: 'violet',
  },
  {
    icon: '🛡️',
    label: 'MINH BẠCH 100%',
    title: 'Lịch Sử Trade Công Khai',
    desc: 'Tất cả trade của UNCLETRADER đều được ghi lại và công khai. Không có track record giả, không có cherry-picking.',
    stat: '4 năm track record',
    color: 'gold',
    wide: true,
  },
  {
    icon: '🎓',
    label: 'GIÁO DỤC',
    title: 'Khóa Học Thực Chiến',
    desc: 'Từ technical analysis cơ bản đến on-chain data nâng cao. Nội dung được cập nhật liên tục theo thị trường.',
    stat: '50+ bài học',
    color: 'cyan',
  },
  {
    icon: '⏰',
    label: 'HỖ TRỢ 24/7',
    title: 'Phản Hồi Trong 2 Giờ',
    desc: 'Đội ngũ hỗ trợ luôn sẵn sàng giải đáp mọi thắc mắc về tín hiệu và chiến lược.',
    stat: '< 2h response',
    color: 'violet',
  },
];

const colorMap: Record<string, { text: string; bg: string; border: string }> = {
  cyan: { text: 'text-cyan-brand', bg: 'bg-cyan-brand/10', border: 'border-cyan-brand/20' },
  violet: { text: 'text-violet-light', bg: 'bg-violet-brand/10', border: 'border-violet-brand/20' },
  gold: { text: 'text-gold-brand', bg: 'bg-gold-brand/10', border: 'border-gold-brand/20' },
};

const WhySection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = entry.target.querySelectorAll('.reveal-hidden');
            els.forEach((el, i) => {
              setTimeout(() => el.classList.add('revealed'), i * 120);
            });
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 reveal-hidden">
          <div className="section-label mb-4">TẠI SAO UNCLETRADER</div>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground tracking-tight mb-4">
            Không Phải Influencer,{' '}
            <span className="text-gradient-cyan italic">Là Trader Thực.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            4 năm giao dịch thực chiến, track record minh bạch. Chúng tôi chỉ dạy những gì đã được chứng minh có lợi nhuận.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {features.map((feature, idx) => {
            const colors = colorMap[feature.color];
            return (
              <div
                key={feature.title}
                className={`reveal-hidden glass-card glass-card-hover rounded-2xl p-6 lg:p-7 ${feature.wide ? 'md:col-span-2 lg:col-span-2' : ''}`}
                style={{ transitionDelay: `${idx * 80}ms` }}
              >
                <div className={`w-12 h-12 ${colors.bg} ${colors.border} border rounded-xl flex items-center justify-center text-xl mb-5`}>
                  {feature.icon}
                </div>
                <div className="section-label mb-2">{feature.label}</div>
                <h3 className="font-display font-semibold text-xl text-foreground mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">{feature.desc}</p>
                <div className={`inline-flex items-center gap-2 ${colors.bg} ${colors.border} border rounded-full px-3 py-1.5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text', 'bg')}`} />
                  <span className={`font-mono-custom text-xs ${colors.text} font-medium`}>{feature.stat}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
