
-- Add phone column to profiles (unique)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text UNIQUE;

-- Create indicator_permissions table
CREATE TABLE IF NOT EXISTS public.indicator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  indicator_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, indicator_key)
);

-- Enable RLS
ALTER TABLE public.indicator_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can view own permissions" ON public.indicator_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Superadmin/admin can manage all permissions
CREATE POLICY "Admins can manage permissions" ON public.indicator_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can view all user_roles  
CREATE POLICY "Superadmin can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can manage roles
CREATE POLICY "Superadmin can manage roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
