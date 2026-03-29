import { useState, useEffect, useCallback } from 'react';

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  published_at: string;
  summary: string;
  full_content?: string;
  image_url?: string;
  stream: string;
  badge?: string;
  badge_color?: string;
}

export interface MarketPulse {
  btc_dominance: number;
  total_market_cap: number;
  total_volume: number;
  market_cap_change_24h: number;
}

export interface FearGreed {
  value: number;
  classification: string;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  price_btc: number;
  market_cap_rank: number;
}

export function useNewsData(stream: string) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [market, setMarket] = useState<{ trending: TrendingCoin[]; global: MarketPulse | null; fng: FearGreed | null }>({
    trending: [], global: null, fng: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-aggregator?stream=${stream}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch news');
      const result = await res.json();

      setArticles(result.articles || []);
      if (result.market) {
        setMarket({
          trending: result.market.trending || [],
          global: result.market.global || null,
          fng: result.market.fng || null,
        });
      }
    } catch (e) {
      console.error('News fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [stream]);

  useEffect(() => {
    setLoading(true);
    fetchNews();
  }, [fetchNews]);

  return { articles, market, loading };
}
