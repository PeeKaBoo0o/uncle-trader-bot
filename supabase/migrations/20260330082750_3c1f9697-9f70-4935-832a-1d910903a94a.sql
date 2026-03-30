-- Allow admins to delete economic events (needed for agent-api)
CREATE POLICY "Admins can delete events"
ON public.economic_events
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role to insert/update/delete signals (for agent-api with API key)
-- Signals insert policy already exists for authenticated+admin
-- Add delete policy for admins
CREATE POLICY "Admins can delete signals"
ON public.signals
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update policy for signals
CREATE POLICY "Admins can update signals"
ON public.signals
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage user_roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));