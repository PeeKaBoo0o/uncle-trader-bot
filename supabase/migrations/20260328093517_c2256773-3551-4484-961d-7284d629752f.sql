CREATE TABLE public.signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT 'H4',
  conditions TEXT[] NOT NULL DEFAULT '{}',
  strength TEXT NOT NULL DEFAULT 'TRUNG BÌNH',
  price NUMERIC NOT NULL,
  rsi NUMERIC,
  vol_ratio NUMERIC,
  candle_time TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, candle_time, timeframe)
);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read signals" ON public.signals FOR SELECT USING (true);
CREATE POLICY "Admins can insert signals" ON public.signals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_signals_symbol ON public.signals(symbol);
CREATE INDEX idx_signals_sent_at ON public.signals(sent_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;