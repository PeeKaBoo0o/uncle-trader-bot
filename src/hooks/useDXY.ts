import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DXYData {
  value: number;
  change: number;
  changePercent: number;
  date: string;
  loading: boolean;
}

export function useDXY() {
  const [data, setData] = useState<DXYData>({
    value: 0, change: 0, changePercent: 0, date: '', loading: true,
  });

  useEffect(() => {
    const fetchDXY = async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke('dxy-proxy');
        if (error) throw error;
        setData({
          value: result.value,
          change: result.change,
          changePercent: result.changePercent,
          date: result.date,
          loading: false,
        });
      } catch (e) {
        console.error('DXY fetch error:', e);
        setData({ value: 104.25, change: -0.32, changePercent: -0.31, date: '', loading: false });
      }
    };
    fetchDXY();
    const interval = setInterval(fetchDXY, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  return data;
}
