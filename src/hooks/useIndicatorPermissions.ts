import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useIndicatorPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Check if superadmin
      const { data: roleData } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'superadmin' });
      setIsSuperAdmin(!!roleData);

      if (roleData) {
        // Superadmin has access to all indicators
        setPermissions(['all']);
        setLoading(false);
        return;
      }

      // Check admin
      const { data: adminData } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (adminData) {
        setPermissions(['all']);
        setLoading(false);
        return;
      }

      // Fetch specific permissions
      const { data } = await supabase
        .from('indicator_permissions')
        .select('indicator_key')
        .eq('user_id', user.id);

      setPermissions(data?.map(p => p.indicator_key) || []);
      setLoading(false);
    };

    fetchPermissions();
  }, [user]);

  const hasAccess = (indicatorKey: string) => {
    if (!user) return false;
    if (permissions.includes('all')) return true;
    return permissions.includes(indicatorKey);
  };

  return { permissions, loading, hasAccess, isSuperAdmin };
};
