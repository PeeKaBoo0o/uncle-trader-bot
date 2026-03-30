// ============================================================
// JSON Contract: assistant-context
// Gửi kèm mỗi request tới AI để cung cấp ngữ cảnh thị trường
// ============================================================

export interface AssistantContext {
  /** Thông tin user hiện tại */
  user: {
    id: string;
    role: "admin" | "moderator" | "user";
    displayName: string | null;
  };

  /** Symbol đang xem trên chart */
  activeSymbol: string; // e.g. "BTCUSDT"
  activeTimeframe: string; // e.g. "H4", "D1", "M15"

  /** Snapshot dữ liệu thị trường hiện tại */
  market: {
    price: number;
    change24h: number; // phần trăm
    volume24h: number;
    high24h: number;
    low24h: number;
  };

  /** Các chỉ báo kỹ thuật đang hiển thị */
  indicators: {
    rsi?: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
    bbUpper?: number;
    bbLower?: number;
    bbMiddle?: number;
    macdLine?: number;
    macdSignal?: number;
    macdHistogram?: number;
    atr?: number;
    adx?: number;
    volumeRatio?: number; // so với TB 20 phiên
  };

  /** Support/Resistance levels đang hiện trên chart */
  levels: {
    type: "support" | "resistance";
    price: number;
    strength: "weak" | "medium" | "strong";
    touchCount: number;
  }[];

  /** SMC / Wyckoff context nếu có */
  smartMoney?: {
    wyckoffPhase?: string; // "accumulation" | "markup" | "distribution" | "markdown"
    orderBlocks?: {
      type: "bullish" | "bearish";
      high: number;
      low: number;
      timeframe: string;
    }[];
    fairValueGaps?: {
      type: "bullish" | "bearish";
      high: number;
      low: number;
    }[];
    liquidityPools?: {
      side: "buy" | "sell";
      price: number;
      size: "small" | "medium" | "large";
    }[];
  };

  /** Tín hiệu gần nhất từ signal bot */
  recentSignals: {
    symbol: string;
    strength: string;
    conditions: string[];
    price: number;
    sentAt: string; // ISO timestamp
  }[];

  /** Sự kiện kinh tế sắp tới (24h) */
  upcomingEvents: {
    eventName: string;
    country: string;
    impact: "low" | "medium" | "high";
    eventTime: string; // ISO timestamp
    estimate?: string;
    prev?: string;
  }[];

  /** Tin tức nổi bật gần đây */
  recentNews: {
    title: string;
    source: string;
    summary: string | null;
    publishedAt: string;
    badge?: string;
  }[];

  /** DXY index nếu đang trade forex/gold */
  dxy?: {
    value: number;
    change: number;
    trend: "up" | "down" | "sideways";
  };

  /** Timestamp khi context được tạo */
  timestamp: string; // ISO timestamp
}

// ============================================================
// JSON Contract: assistant-action-preview
// AI trả về action để frontend render preview UI
// ============================================================

/** Union type cho tất cả action types */
export type AssistantAction =
  | TradeSignalAction
  | ChartAnnotationAction
  | MarketSummaryAction
  | AlertSetupAction
  | AnalysisAction
  | PortfolioAction;

/** Base interface cho mọi action */
interface BaseAction {
  id: string; // unique action ID
  type: string;
  title: string;
  description?: string;
  confidence?: number; // 0-100, độ tin cậy của AI
  timestamp: string; // ISO
}

// --- 1. Trade Signal ---
export interface TradeSignalAction extends BaseAction {
  type: "trade_signal";
  signal: {
    direction: "LONG" | "SHORT";
    symbol: string;
    timeframe: string;
    entry: number;
    stopLoss: number;
    takeProfit: number[];  // multiple TP levels
    riskRewardRatio: number;
    positionSize?: string; // "1-2% capital"
    conditions: string[]; // lý do vào lệnh
    invalidation: string; // khi nào signal không còn hợp lệ
  };
}

// --- 2. Chart Annotation ---
export interface ChartAnnotationAction extends BaseAction {
  type: "chart_annotation";
  annotations: {
    kind:
      | "horizontal_line"
      | "trendline"
      | "rectangle"
      | "fibonacci"
      | "text_label"
      | "arrow";
    color: string; // hex
    label?: string;
    /** Tuỳ kind sẽ dùng các field khác nhau */
    price?: number;         // horizontal_line
    from?: { time: string; price: number }; // trendline, rectangle
    to?: { time: string; price: number };   // trendline, rectangle
    levels?: number[];      // fibonacci (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)
    text?: string;          // text_label
    position?: { time: string; price: number }; // text_label, arrow
  }[];
}

// --- 3. Market Summary ---
export interface MarketSummaryAction extends BaseAction {
  type: "market_summary";
  summary: {
    overallSentiment: "bullish" | "bearish" | "neutral";
    sentimentScore: number; // -100 to +100
    keyPoints: string[];
    risks: string[];
    opportunities: string[];
    correlations?: {
      asset: string;
      correlation: "positive" | "negative" | "neutral";
      note: string;
    }[];
    macro?: {
      dxyImpact: string;
      interestRates: string;
      geopolitical: string;
    };
  };
}

// --- 4. Alert Setup ---
export interface AlertSetupAction extends BaseAction {
  type: "alert_setup";
  alert: {
    symbol: string;
    condition:
      | "price_above"
      | "price_below"
      | "rsi_above"
      | "rsi_below"
      | "ema_cross"
      | "volume_spike"
      | "bb_squeeze"
      | "support_touch"
      | "resistance_touch"
      | "custom";
    value: number;
    secondaryValue?: number; // e.g. EMA period
    message: string;
    channels: ("app" | "telegram" | "email")[];
    expiresAt?: string; // ISO, auto-expire
    recurring: boolean; // trigger once or repeat
  };
}

// --- 5. Analysis ---
export interface AnalysisAction extends BaseAction {
  type: "analysis";
  analysis: {
    symbol: string;
    timeframe: string;
    bias: "bullish" | "bearish" | "neutral";
    structure: {
      trend: "uptrend" | "downtrend" | "ranging";
      keyLevels: { label: string; price: number }[];
      pattern?: string; // "double bottom", "head and shoulders", etc.
    };
    scenarios: {
      label: string; // "Kịch bản tăng", "Kịch bản giảm"
      probability: number; // 0-100
      description: string;
      target: number;
      invalidation: number;
    }[];
    technicalNotes: string; // markdown
  };
}

// --- 6. Portfolio / Risk ---
export interface PortfolioAction extends BaseAction {
  type: "portfolio";
  portfolio: {
    suggestion: "add" | "reduce" | "hold" | "close";
    symbol: string;
    allocation: string; // "5% portfolio"
    reasoning: string;
    riskLevel: "low" | "medium" | "high";
    diversificationNote?: string;
  };
}

// ============================================================
// Response wrapper từ AI Edge Function
// ============================================================

export interface AssistantResponse {
  /** Text response (markdown) hiển thị trong chat */
  message: string;

  /** Danh sách action previews để render UI cards */
  actions: AssistantAction[];

  /** Suggested follow-up questions */
  suggestions?: string[];

  /** Metadata */
  meta: {
    model: string; // "gemini-2.5-flash" etc.
    tokensUsed: number;
    processingTimeMs: number;
    contextTokens: number;
  };
}

// ============================================================
// Request contract (Frontend → Edge Function)
// ============================================================

export interface AssistantRequest {
  /** Tin nhắn user */
  message: string;

  /** Lịch sử hội thoại (gửi đầy đủ) */
  history: {
    role: "user" | "assistant";
    content: string;
    actions?: AssistantAction[]; // actions từ response trước
    timestamp: string;
  }[];

  /** Context thị trường hiện tại */
  context: AssistantContext;

  /** Preferences */
  preferences?: {
    language: "vi" | "en";
    riskTolerance: "conservative" | "moderate" | "aggressive";
    tradingStyle: "scalping" | "daytrading" | "swing" | "position";
    preferredTimeframes: string[];
  };
}
