CREATE TABLE public.market_commentaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset TEXT NOT NULL CHECK (asset IN ('BTC', 'XAU')),
  commentary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  commentary TEXT NOT NULL,
  market_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (asset, commentary_date)
);

ALTER TABLE public.market_commentaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read commentaries"
ON public.market_commentaries
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage commentaries"
ON public.market_commentaries
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_commentaries_date ON public.market_commentaries (commentary_date DESC);
CREATE INDEX idx_commentaries_asset_date ON public.market_commentaries (asset, commentary_date DESC);

CREATE TRIGGER update_commentaries_updated_at
BEFORE UPDATE ON public.market_commentaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();