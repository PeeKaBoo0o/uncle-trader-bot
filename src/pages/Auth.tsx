import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PHONE_EMAIL_DOMAIN = '@cryptotrading.app';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const phoneToEmail = (ph: string) => ph.replace(/[^0-9]/g, '') + PHONE_EMAIL_DOMAIN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      setError('Số điện thoại không hợp lệ');
      setLoading(false);
      return;
    }

    const fakeEmail = phoneToEmail(phone);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password,
      });
      if (error) {
        setError(error.message === 'Invalid login credentials' ? 'Sai số điện thoại hoặc mật khẩu' : error.message);
      } else {
        navigate('/indicators');
      }
    } else {
      // Check if phone already exists in profiles
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existing) {
        setError('Số điện thoại đã được đăng ký');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
        options: {
          data: {
            display_name: name,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setError('Số điện thoại đã được đăng ký');
        } else {
          setError(error.message);
        }
      } else {
        setSuccess('Đăng ký thành công! Đang đăng nhập...');
        // Auto-confirm is enabled, so user is logged in
        setTimeout(() => navigate('/indicators'), 1000);
      }
    }
    setLoading(false);
  };

  const handleGuestAccess = () => {
    navigate('/');
    toast.info('Bạn đang truy cập với vai trò khách. Đăng ký để sử dụng đầy đủ chỉ báo.');
  };

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-md mx-auto">
          <div className="glass-card rounded-2xl p-8 cyber-border">
            <h1 className="font-display font-bold text-2xl text-foreground mb-6 text-center">
              {isLogin ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}
            </h1>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block font-mono-custom text-xs text-muted-foreground tracking-wider mb-2">SỐ ĐIỆN THOẠI</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="crypto-input w-full rounded-xl px-4 py-3"
                  placeholder="0912345678"
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block font-mono-custom text-xs text-muted-foreground tracking-wider mb-2">HỌ TÊN</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="crypto-input w-full rounded-xl px-4 py-3"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              )}

              <div>
                <label className="block font-mono-custom text-xs text-muted-foreground tracking-wider mb-2">MẬT KHẨU</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="crypto-input w-full rounded-xl px-4 py-3"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-4 rounded-xl text-base font-semibold disabled:opacity-50"
              >
                {loading ? 'Đang xử lý...' : isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
              </button>
            </form>

            <div className="mt-4">
              <button
                onClick={handleGuestAccess}
                className="w-full py-3 rounded-xl text-sm font-medium border border-muted-foreground/20 text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
              >
                🔓 Truy cập với vai trò Khách
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </button>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Auth;
