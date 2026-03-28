import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
      else navigate('/');
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error.message);
      else setSuccess('Đăng ký thành công! Kiểm tra email để xác nhận tài khoản.');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-md mx-auto">
          <div className="glass-card rounded-2xl p-8 cyber-border">
            <h1 className="font-display font-bold text-2xl text-foreground mb-6 text-center">
              {isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
            </h1>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block font-mono-custom text-xs text-muted-foreground tracking-wider mb-2">EMAIL</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="crypto-input w-full rounded-xl px-4 py-3" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block font-mono-custom text-xs text-muted-foreground tracking-wider mb-2">MẬT KHẨU</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="crypto-input w-full rounded-xl px-4 py-3" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="btn-primary w-full py-4 rounded-xl text-base font-semibold disabled:opacity-50">
                {loading ? 'Đang xử lý...' : isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </button>
            </div>

            {isLogin && (
              <div className="mt-3 text-center">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Quên mật khẩu?
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Auth;
