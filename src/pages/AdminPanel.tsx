import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const INDICATOR_LIST = [
  { id: 'liq_hunter', label: 'Liquidity Hunter' },
  { id: 'alphanet', label: 'AlphaNet AI' },
  { id: 'matrix', label: 'Matrix NWE' },
  { id: 'engine', label: 'MS Engine' },
  { id: 'tp_sl', label: 'TP/SL Zones' },
  { id: 'buy_sell', label: 'Buy/Sell Signal' },
  { id: 'oscillator', label: 'Oscillator Matrix' },
  { id: 'pro_ema', label: 'Pro EMA' },
  { id: 'support_resistance', label: 'Pro S/R' },
  { id: 'wyckoff', label: 'Wyckoff' },
];

interface UserProfile {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  permissions: string[];
  role: string | null;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    checkAccess();
  }, [user]);

  const checkAccess = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'superadmin' });
    if (!data) {
      toast.error('Bạn không có quyền truy cập trang này');
      navigate('/');
      return;
    }
    setIsSuperAdmin(true);
    fetchUsers();
  };

  const fetchUsers = async () => {
    setLoading(true);
    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, phone')
      .order('created_at', { ascending: false });

    if (!profiles) { setLoading(false); return; }

    // Get all permissions (superadmin can see all via policy)
    const { data: allPermissions } = await supabase
      .from('indicator_permissions')
      .select('user_id, indicator_key');

    // Get all roles
    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const userList: UserProfile[] = profiles.map(p => ({
      user_id: p.user_id,
      display_name: p.display_name,
      phone: p.phone,
      permissions: allPermissions?.filter(perm => perm.user_id === p.user_id).map(perm => perm.indicator_key) || [],
      role: allRoles?.find(r => r.user_id === p.user_id)?.role || null,
    }));

    setUsers(userList);
    setLoading(false);
  };

  const togglePermission = async (userId: string, indicatorKey: string, currentlyHas: boolean) => {
    setSaving(userId + indicatorKey);
    if (currentlyHas) {
      await supabase
        .from('indicator_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('indicator_key', indicatorKey);
    } else {
      await supabase
        .from('indicator_permissions')
        .insert({ user_id: userId, indicator_key: indicatorKey, granted_by: user!.id });
    }
    await fetchUsers();
    setSaving(null);
  };

  const grantAllPermissions = async (userId: string) => {
    setSaving(userId + 'all');
    const existing = users.find(u => u.user_id === userId)?.permissions || [];
    const toInsert = INDICATOR_LIST
      .filter(i => !existing.includes(i.id))
      .map(i => ({ user_id: userId, indicator_key: i.id, granted_by: user!.id }));
    if (toInsert.length > 0) {
      await supabase.from('indicator_permissions').insert(toInsert);
    }
    await fetchUsers();
    setSaving(null);
    toast.success('Đã cấp tất cả quyền');
  };

  const revokeAllPermissions = async (userId: string) => {
    setSaving(userId + 'none');
    await supabase
      .from('indicator_permissions')
      .delete()
      .eq('user_id', userId);
    await fetchUsers();
    setSaving(null);
    toast.success('Đã thu hồi tất cả quyền');
  };

  const setUserRole = async (userId: string, role: 'admin' | 'moderator' | 'user' | null) => {
    setSaving(userId + 'role');
    // Remove existing roles
    await supabase.from('user_roles').delete().eq('user_id', userId);
    // Add new role if specified
    if (role) {
      await supabase.from('user_roles').insert({ user_id: userId, role });
    }
    await fetchUsers();
    setSaving(null);
    toast.success(`Đã cập nhật vai trò`);
  };

  if (!isSuperAdmin) return null;

  return (
    <main className="min-h-screen bg-navy grain-overlay">
      <Header />
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            🛡️ Super Admin Panel
          </h1>
          <p className="text-muted-foreground mb-8">Quản lý quyền truy cập chỉ báo cho người dùng</p>

          {loading ? (
            <div className="text-center text-muted-foreground py-20">Đang tải...</div>
          ) : (
            <div className="space-y-4">
              {users.map(u => (
                <div key={u.user_id} className="glass-card rounded-xl p-5 cyber-border">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">{u.display_name || 'Chưa đặt tên'}</span>
                        {u.role && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                            u.role === 'superadmin' ? 'bg-red-500/20 text-red-400' :
                            u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{u.role}</span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground font-mono">{u.phone || 'N/A'}</span>
                    </div>

                    {u.user_id !== user?.id && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={u.role || ''}
                          onChange={(e) => setUserRole(u.user_id, (e.target.value || null) as any)}
                          className="crypto-input rounded-lg px-3 py-1.5 text-sm"
                        >
                          <option value="">Không có vai trò</option>
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={() => grantAllPermissions(u.user_id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                          Cấp tất cả
                        </button>
                        <button onClick={() => revokeAllPermissions(u.user_id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          Thu hồi tất cả
                        </button>
                      </div>
                    )}
                  </div>

                  {u.user_id !== user?.id && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {INDICATOR_LIST.map(ind => {
                        const has = u.permissions.includes(ind.id);
                        const isSaving = saving === u.user_id + ind.id;
                        return (
                          <button
                            key={ind.id}
                            onClick={() => togglePermission(u.user_id, ind.id, has)}
                            disabled={!!saving}
                            className={`text-xs px-3 py-2 rounded-lg border transition-all ${
                              has
                                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                                : 'border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
                            } ${isSaving ? 'opacity-50' : ''}`}
                          >
                            {has ? '✅' : '◻️'} {ind.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default AdminPanel;
