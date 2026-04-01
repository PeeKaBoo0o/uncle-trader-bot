
CREATE TABLE public.daily_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  setup_date date NOT NULL,
  scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  market_context text,
  ai_summary text,
  current_price numeric,
  price_change_24h numeric,
  telegram_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset, setup_date)
);

ALTER TABLE public.daily_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read setups" ON public.daily_setups
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage setups" ON public.daily_setups
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_daily_setups_updated_at
  BEFORE UPDATE ON public.daily_setups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
