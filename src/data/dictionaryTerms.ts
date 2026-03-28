export interface Term {
  id: string;
  term: string;
  english: string;
  category: string;
  categoryColor: string;
  definition: string;
  example?: string;
}

export interface TermDetail {
  term: string;
  english: string;
  category: string;
  illustration?: string;
  basic: { definition: string; example: string; howToApply: string; commonMistakes: string };
  advanced: { definition: string; example: string; howToApply: string; commonMistakes: string; proTips?: string[]; keyTakeaways?: string[] };
}

export const CATEGORIES = [
  { label: 'Tất cả', color: 'text-foreground' },
  { label: 'Phân tích kỹ thuật', color: 'text-cyan-400' },
  { label: 'Chỉ báo kỹ thuật', color: 'text-violet-400' },
  { label: 'Cơ bản', color: 'text-emerald-400' },
  { label: 'Quản lý rủi ro', color: 'text-yellow-400' },
  { label: 'Giao dịch phái sinh', color: 'text-orange-400' },
  { label: 'Crypto', color: 'text-blue-400' },
  { label: 'Tâm lý thị trường', color: 'text-pink-400' },
  { label: 'Forex', color: 'text-emerald-300' },
  { label: 'DeFi', color: 'text-purple-400' },
  { label: 'Chiến lược giao dịch', color: 'text-red-400' },
];

export const TERMS: Term[] = [
  // ── Phân tích kỹ thuật ──
  { id: 'support-resistance', term: 'Hỗ Trợ & Kháng Cự', english: 'Support & Resistance', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Vùng giá mà lực mua (hỗ trợ) hoặc lực bán (kháng cự) đủ mạnh để ngăn giá đi xa hơn.', example: 'BTC có hỗ trợ mạnh tại $60,000 — giá đã bounce 3 lần từ vùng này.' },
  { id: 'trendline', term: 'Đường Xu Hướng', english: 'Trendline', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Đường thẳng nối các đỉnh hoặc đáy liên tiếp, thể hiện hướng đi chính của giá.', example: 'Trendline tăng kéo dài 3 tháng — mỗi đáy sau cao hơn đáy trước.' },
  { id: 'fibonacci', term: 'Fibonacci Retracement', english: 'Fibonacci Retracement', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Công cụ vẽ các mức thoái lui (23.6%, 38.2%, 50%, 61.8%, 78.6%) dựa trên dãy Fibonacci, giúp xác định vùng giá có thể đảo chiều.', example: 'BTC pullback từ $73K về mức Fib 61.8% ($64K) rồi bật tăng mạnh — vùng Golden Zone.' },
  { id: 'chart-pattern', term: 'Mô Hình Giá', english: 'Chart Pattern', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Các hình dạng lặp lại trên biểu đồ (Head & Shoulders, Double Top/Bottom, Triangle, Wedge, Flag) giúp dự đoán hướng giá tiếp theo.', example: 'BTC tạo mô hình Double Bottom tại $56K → phá neckline $62K → target $68K.' },
  { id: 'candlestick', term: 'Nến Nhật', english: 'Candlestick', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Biểu đồ nến hiển thị giá Open, High, Low, Close trong 1 khung thời gian. Các mô hình nến (Doji, Hammer, Engulfing) giúp đọc tâm lý thị trường.', example: 'Nến Hammer xuất hiện tại hỗ trợ $60K với bóng dưới dài → tín hiệu đảo chiều tăng.' },
  { id: 'price-action', term: 'Price Action', english: 'Price Action', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Phương pháp phân tích chỉ dựa trên biến động giá thuần (nến, S/R, trendline) mà không cần indicator.', example: 'Pin bar + rejection tại kháng cự → Short entry mà không cần RSI hay MACD.' },
  { id: 'supply-demand', term: 'Vùng Cung Cầu', english: 'Supply & Demand Zone', category: 'Phân tích kỹ thuật', categoryColor: 'text-cyan-400', definition: 'Vùng giá nơi lệnh mua/bán lớn tích tụ, tạo ra sự mất cân bằng cung cầu. Giá thường phản ứng mạnh khi quay lại vùng này.', example: 'Demand zone $62K-$63K: giá tạo nến tăng mạnh lần đầu → quay lại vùng này sẽ bounce.' },

  // ── Chỉ báo kỹ thuật ──
  { id: 'rsi', term: 'RSI', english: 'Relative Strength Index', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Chỉ báo đo lường tốc độ thay đổi giá (0-100). RSI > 70 = quá mua, RSI < 30 = quá bán.', example: 'RSI 14 chạm 28 — vùng quá bán, theo dõi tín hiệu đảo chiều tăng.' },
  { id: 'macd', term: 'MACD', english: 'Moving Average Convergence Divergence', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Indicator kết hợp trend + momentum. MACD cắt lên Signal = mua, cắt xuống = bán. Histogram thể hiện sức mạnh.', example: 'MACD line cắt lên Signal line + Histogram dương → Xác nhận đà tăng.' },
  { id: 'bollinger-bands', term: 'Bollinger Bands', english: 'Bollinger Bands', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Dải biến động gồm 3 đường: SMA 20 ± 2 độ lệch chuẩn. Khi dải siết lại (Squeeze) báo hiệu biến động lớn sắp xảy ra.', example: 'BB Squeeze 2 tuần → giá phá lên dải trên với volume lớn → Breakout xác nhận.' },
  { id: 'ema', term: 'EMA', english: 'Exponential Moving Average', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Đường trung bình động hàm mũ, phản ứng nhanh hơn SMA. EMA 9, 21, 50, 200 là các mức phổ biến.', example: 'EMA 9 cắt lên EMA 21 (Golden Cross ngắn hạn) → tín hiệu mua scalping.' },
  { id: 'divergence', term: 'Phân Kỳ', english: 'Divergence', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Khi giá và indicator đi ngược hướng. Regular Divergence báo đảo chiều, Hidden Divergence báo tiếp tục xu hướng.', example: 'BTC tạo đỉnh mới nhưng RSI đi xuống — phân kỳ giảm, cảnh báo điều chỉnh.' },
  { id: 'ichimoku', term: 'Ichimoku Cloud', english: 'Ichimoku Kinko Hyo', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Hệ thống indicator "nhìn một cái biết tất cả" gồm 5 đường: Tenkan, Kijun, Senkou A/B (tạo mây), Chikou. Giá trên mây = xu hướng tăng.', example: 'BTC trên mây xanh dày + Tenkan cắt lên Kijun → xác nhận xu hướng tăng mạnh.' },
  { id: 'stochastic', term: 'Stochastic', english: 'Stochastic Oscillator', category: 'Chỉ báo kỹ thuật', categoryColor: 'text-violet-400', definition: 'Chỉ báo momentum so sánh giá đóng cửa với dải giá trong 14 phiên. %K > 80 = quá mua, %K < 20 = quá bán.', example: '%K cắt lên %D tại vùng 15 → tín hiệu mua tại vùng quá bán.' },

  // ── Cơ bản ──
  { id: 'volume', term: 'Khối Lượng', english: 'Volume', category: 'Cơ bản', categoryColor: 'text-emerald-400', definition: 'Tổng số lượng tài sản được giao dịch trong một khoảng thời gian. Volume xác nhận xu hướng giá.', example: 'Giá tăng + Volume tăng = Xu hướng mạnh. Giá tăng + Volume giảm = Cảnh báo.' },
  { id: 'liquidity', term: 'Thanh Khoản', english: 'Liquidity', category: 'Cơ bản', categoryColor: 'text-emerald-400', definition: 'Khả năng mua/bán tài sản nhanh chóng mà không ảnh hưởng đáng kể đến giá. Thanh khoản cao = spread thấp.', example: 'BTC có thanh khoản cao — spread chỉ $5-10 trên Binance.' },
  { id: 'spread', term: 'Spread', english: 'Bid-Ask Spread', category: 'Cơ bản', categoryColor: 'text-emerald-400', definition: 'Chênh lệch giữa giá mua (Bid) và giá bán (Ask). Spread càng nhỏ = thanh khoản càng tốt.', example: 'EUR/USD spread 0.1 pip trên Binance, nhưng coin nhỏ spread có thể 1-2%.' },
  { id: 'market-cap', term: 'Vốn Hóa Thị Trường', english: 'Market Capitalization', category: 'Cơ bản', categoryColor: 'text-emerald-400', definition: 'Tổng giá trị thị trường = Giá × Tổng cung lưu hành. Dùng để đánh giá quy mô tài sản.', example: 'BTC market cap $1.3T — chiếm ~50% tổng vốn hóa crypto.' },
  { id: 'order-types', term: 'Các Loại Lệnh', english: 'Order Types', category: 'Cơ bản', categoryColor: 'text-emerald-400', definition: 'Market Order (mua/bán ngay), Limit Order (đặt giá chờ), Stop Order (kích hoạt khi đạt giá), OCO (One-Cancels-Other).', example: 'Limit Buy $65K — lệnh sẽ khớp khi giá BTC giảm xuống $65K.' },

  // ── Quản lý rủi ro ──
  { id: 'stop-loss', term: 'Cắt Lỗ', english: 'Stop Loss', category: 'Quản lý rủi ro', categoryColor: 'text-yellow-400', definition: 'Lệnh tự động đóng vị thế khi giá đạt mức lỗ đã định trước, bảo vệ vốn.', example: 'Entry BTC $67K — đặt SL tại $65,500 (risk 2.2%).' },
  { id: 'take-profit', term: 'Chốt Lời', english: 'Take Profit', category: 'Quản lý rủi ro', categoryColor: 'text-yellow-400', definition: 'Lệnh tự động đóng vị thế khi giá đạt mức lời đã định trước.', example: 'TP1: $69K (chốt 50%) | TP2: $71K (chốt 30%) | TP3: trailing.' },
  { id: 'risk-reward', term: 'Tỷ Lệ R:R', english: 'Risk/Reward Ratio', category: 'Quản lý rủi ro', categoryColor: 'text-yellow-400', definition: 'Tỷ lệ rủi ro/phần thưởng. Trader chuyên nghiệp yêu cầu tối thiểu 1:2. R:R = (TP - Entry) / (Entry - SL).', example: 'Entry $67K, SL $66K, TP $70K → R:R = 1:3 ✅' },
  { id: 'position-sizing', term: 'Quản Lý Khối Lượng', english: 'Position Sizing', category: 'Quản lý rủi ro', categoryColor: 'text-yellow-400', definition: 'Quy tắc xác định khối lượng giao dịch dựa trên % rủi ro trên tổng vốn. Quy tắc 1-2%: không bao giờ risk > 2% vốn/lệnh.', example: 'Vốn $10K, risk 1% = $100/lệnh. SL 2% → Position size = $5,000.' },
  { id: 'drawdown', term: 'Drawdown', english: 'Drawdown', category: 'Quản lý rủi ro', categoryColor: 'text-yellow-400', definition: 'Mức sụt giảm vốn tối đa từ đỉnh. Max Drawdown > 20% là cảnh báo đỏ về quản lý rủi ro.', example: 'Tài khoản từ $10K xuống $7.5K → Drawdown 25% — cần giảm size ngay.' },
  { id: 'trailing-stop', term: 'Trailing Stop', english: 'Trailing Stop', category: 'Quản lý rủi ro', categoryColor: 'text-yellow-400', definition: 'Stop Loss tự động dịch chuyển theo giá có lợi, khóa lời khi xu hướng tiếp tục.', example: 'Entry $67K, trailing 3% → giá lên $70K thì SL tự chuyển lên $67.9K.' },

  // ── Giao dịch phái sinh ──
  { id: 'futures', term: 'Hợp Đồng Tương Lai', english: 'Futures', category: 'Giao dịch phái sinh', categoryColor: 'text-orange-400', definition: 'Hợp đồng mua/bán tài sản ở giá định sẵn tại thời điểm tương lai. Cho phép Long (mua lên) và Short (bán xuống).', example: 'Long BTC Futures $67K × 10x → mỗi 1% tăng = lãi 10%.' },
  { id: 'leverage', term: 'Đòn Bẩy', english: 'Leverage', category: 'Giao dịch phái sinh', categoryColor: 'text-orange-400', definition: 'Vay vốn từ sàn để giao dịch lớn hơn vốn thực. 10x = giao dịch gấp 10 lần vốn. Lãi/lỗ đều nhân lên.', example: 'Vốn $1,000 × 20x = Vị thế $20,000. Giá giảm 5% → mất 100% vốn (liquidation).' },
  { id: 'margin', term: 'Ký Quỹ', english: 'Margin', category: 'Giao dịch phái sinh', categoryColor: 'text-orange-400', definition: 'Số vốn cần đặt cọc để mở vị thế có đòn bẩy. Initial Margin = mở lệnh, Maintenance Margin = duy trì.', example: 'BTC $67K × 10x, margin 10% = cần $6,700 để mở vị thế $67,000.' },
  { id: 'liquidation', term: 'Thanh Lý', english: 'Liquidation', category: 'Giao dịch phái sinh', categoryColor: 'text-orange-400', definition: 'Sàn tự động đóng vị thế khi lỗ chạm mức Maintenance Margin. Đòn bẩy cao = liquidation nhanh.', example: 'Long 50x → giá giảm 2% = mất toàn bộ margin → Liquidation.' },
  { id: 'funding-rate', term: 'Phí Funding', english: 'Funding Rate', category: 'Giao dịch phái sinh', categoryColor: 'text-orange-400', definition: 'Phí trao đổi giữa Long và Short mỗi 8 giờ trên Perpetual Futures, giữ giá futures gần spot.', example: 'Funding +0.03% → Long trả Short. Funding âm → Short trả Long.' },

  // ── Crypto ──
  { id: 'blockchain', term: 'Blockchain', english: 'Blockchain', category: 'Crypto', categoryColor: 'text-blue-400', definition: 'Sổ cái phân tán, ghi lại mọi giao dịch theo chuỗi block. Bất biến, minh bạch, phi tập trung.', example: 'Bitcoin blockchain xử lý ~7 TX/giây, Ethereum ~30 TX/giây.' },
  { id: 'wallet', term: 'Ví Crypto', english: 'Crypto Wallet', category: 'Crypto', categoryColor: 'text-blue-400', definition: 'Công cụ lưu trữ private key để quản lý crypto. Hot Wallet (online) vs Cold Wallet (offline, an toàn hơn).', example: 'Ledger Nano X (cold wallet) — lưu trữ BTC offline, chống hack.' },
  { id: 'halving', term: 'Halving', english: 'Bitcoin Halving', category: 'Crypto', categoryColor: 'text-blue-400', definition: 'Sự kiện giảm 50% phần thưởng block mining mỗi ~4 năm. Giảm cung → lịch sử cho thấy giá tăng mạnh sau halving.', example: 'Halving 2024: reward giảm từ 6.25 → 3.125 BTC/block. Giá từ $28K → $73K.' },
  { id: 'altcoin', term: 'Altcoin', english: 'Alternative Coin', category: 'Crypto', categoryColor: 'text-blue-400', definition: 'Tất cả cryptocurrency ngoài Bitcoin. Bao gồm ETH, SOL, BNB, XRP... Altseason = giai đoạn altcoin tăng mạnh.', example: 'BTC dominance giảm từ 55% → 42% → Altseason bắt đầu, ETH +80%.' },
  { id: 'whale', term: 'Cá Voi', english: 'Whale', category: 'Crypto', categoryColor: 'text-blue-400', definition: 'Cá nhân/tổ chức nắm giữ lượng lớn crypto, có thể ảnh hưởng giá thị trường khi mua/bán.', example: 'Whale chuyển 10,000 BTC lên Binance → cảnh báo bán tháo.' },

  // ── Tâm lý thị trường ──
  { id: 'fomo', term: 'FOMO', english: 'Fear Of Missing Out', category: 'Tâm lý thị trường', categoryColor: 'text-pink-400', definition: 'Sợ bỏ lỡ cơ hội — tâm lý khiến trader mua đuổi giá cao mà không có kế hoạch. Một trong các lỗi phổ biến nhất.', example: 'BTC tăng 20% trong 2 ngày → FOMO mua đỉnh → giá điều chỉnh 15% ngay sau.' },
  { id: 'fud', term: 'FUD', english: 'Fear, Uncertainty, Doubt', category: 'Tâm lý thị trường', categoryColor: 'text-pink-400', definition: 'Tin tức tiêu cực (thật hoặc giả) gây hoảng loạn, khiến nhà đầu tư bán tháo.', example: 'Tin "Trung Quốc cấm Bitcoin" lần thứ N → FUD → giá giảm 10% rồi hồi lại.' },
  { id: 'greed-fear-index', term: 'Chỉ Số Tham Lam & Sợ Hãi', english: 'Fear & Greed Index', category: 'Tâm lý thị trường', categoryColor: 'text-pink-400', definition: 'Chỉ số 0-100 đo tâm lý thị trường. < 25 = Extreme Fear (cơ hội mua), > 75 = Extreme Greed (cảnh báo bán).', example: 'Fear & Greed Index = 15 (Extreme Fear) → Warren Buffett: "Hãy tham lam khi người khác sợ hãi."' },
  { id: 'diamond-hands', term: 'Diamond Hands', english: 'Diamond Hands 💎🙌', category: 'Tâm lý thị trường', categoryColor: 'text-pink-400', definition: 'Người giữ vị thế bất chấp biến động, không bán khi giá giảm. Ngược lại: Paper Hands (bán sớm vì sợ).', example: 'HODLer BTC từ $3K → $69K → crash $16K → vẫn hold → $73K. Diamond Hands.' },

  // ── Forex ──
  { id: 'pip', term: 'Pip', english: 'Percentage In Point', category: 'Forex', categoryColor: 'text-emerald-300', definition: 'Đơn vị đo nhỏ nhất của biến động tỷ giá. 1 pip = 0.0001 (4 số thập phân). Với JPY = 0.01.', example: 'EUR/USD từ 1.0850 → 1.0870 = tăng 20 pips.' },
  { id: 'lot', term: 'Lot', english: 'Lot Size', category: 'Forex', categoryColor: 'text-emerald-300', definition: '1 Standard Lot = 100,000 đơn vị tiền tệ. Mini Lot = 10,000. Micro Lot = 1,000. Nano Lot = 100.', example: '1 lot EUR/USD: 1 pip = $10. 0.1 lot: 1 pip = $1.' },
  { id: 'dxy', term: 'DXY', english: 'US Dollar Index', category: 'Forex', categoryColor: 'text-emerald-300', definition: 'Chỉ số đo sức mạnh USD so với rổ 6 tiền tệ chính (EUR, JPY, GBP, CAD, SEK, CHF). DXY tăng → Vàng/BTC giảm.', example: 'DXY tăng từ 104 → 107 → EUR/USD giảm, Vàng giảm $50.' },
  { id: 'swap', term: 'Phí Qua Đêm', english: 'Swap / Rollover', category: 'Forex', categoryColor: 'text-emerald-300', definition: 'Phí hoặc lãi khi giữ vị thế Forex qua đêm, dựa trên chênh lệch lãi suất giữa 2 đồng tiền.', example: 'Long AUD/JPY (lãi suất AUD > JPY) → nhận swap dương mỗi đêm.' },

  // ── DeFi ──
  { id: 'defi', term: 'DeFi', english: 'Decentralized Finance', category: 'DeFi', categoryColor: 'text-purple-400', definition: 'Tài chính phi tập trung — dịch vụ tài chính (vay, cho vay, swap) chạy trên blockchain, không cần ngân hàng.', example: 'Aave: cho vay USDC, nhận lãi 5% APY. Uniswap: swap token không cần sàn tập trung.' },
  { id: 'yield-farming', term: 'Yield Farming', english: 'Yield Farming', category: 'DeFi', categoryColor: 'text-purple-400', definition: 'Cung cấp thanh khoản cho protocol DeFi để nhận phần thưởng (token + phí giao dịch). APY có thể rất cao nhưng rủi ro.', example: 'Cung cấp ETH/USDC trên Uniswap V3 → nhận phí swap ~15-40% APY.' },
  { id: 'impermanent-loss', term: 'Tổn Thất Tạm Thời', english: 'Impermanent Loss', category: 'DeFi', categoryColor: 'text-purple-400', definition: 'Khi cung cấp LP, nếu tỷ giá 2 token thay đổi nhiều so với lúc nạp → giá trị LP < giá trị nếu chỉ HODL.', example: 'Nạp ETH/USDC khi ETH $3K. ETH lên $4K → IL ~2%. ETH lên $6K → IL ~5.7%.' },
  { id: 'staking', term: 'Staking', english: 'Staking', category: 'DeFi', categoryColor: 'text-purple-400', definition: 'Khóa token trong mạng Proof-of-Stake để xác thực giao dịch và nhận phần thưởng (staking reward).', example: 'Stake 32 ETH → trở thành validator Ethereum → nhận ~4% APY.' },

  // ── Chiến lược giao dịch ──
  { id: 'breakout', term: 'Breakout', english: 'Breakout Trading', category: 'Chiến lược giao dịch', categoryColor: 'text-red-400', definition: 'Chiến lược mua/bán khi giá phá vỡ vùng S/R quan trọng với volume xác nhận. Cần phân biệt với fakeout.', example: 'BTC breakout $68K + volume 3x trung bình → Long entry tại $68.2K, SL $67K.' },
  { id: 'scalping', term: 'Scalping', english: 'Scalping', category: 'Chiến lược giao dịch', categoryColor: 'text-red-400', definition: 'Giao dịch siêu ngắn (vài giây → vài phút), kiếm lợi nhuận nhỏ nhưng nhiều lần/ngày. Yêu cầu tốc độ cao.', example: 'Scalp BTC trên khung M1: entry → TP 0.1-0.3% → lặp lại 20-50 lần/ngày.' },
  { id: 'swing-trading', term: 'Swing Trading', english: 'Swing Trading', category: 'Chiến lược giao dịch', categoryColor: 'text-red-400', definition: 'Giao dịch trung hạn (vài ngày → vài tuần), tận dụng các "nhịp swing" trong xu hướng. Phù hợp người bận.', example: 'Long ETH tại support $3,200 → TP tại resistance $3,800 sau 5 ngày. R:R = 1:3.' },
  { id: 'dca', term: 'DCA', english: 'Dollar Cost Averaging', category: 'Chiến lược giao dịch', categoryColor: 'text-red-400', definition: 'Mua đều đặn một lượng cố định theo lịch trình, bất kể giá, giảm rủi ro timing sai.', example: 'Mua $200 BTC mỗi tuần → trung bình giá entry tốt hơn so với mua 1 lần.' },
  { id: 'reversal', term: 'Đảo Chiều', english: 'Reversal Trading', category: 'Chiến lược giao dịch', categoryColor: 'text-red-400', definition: 'Chiến lược giao dịch khi xu hướng sắp thay đổi, dựa trên divergence, mô hình đảo chiều, exhaustion candle.', example: 'Double Top tại $69K + RSI bearish divergence → Short entry. TP: $64K.' },
  { id: 'grid-trading', term: 'Grid Trading', english: 'Grid Trading', category: 'Chiến lược giao dịch', categoryColor: 'text-red-400', definition: 'Đặt lưới lệnh mua/bán cách đều nhau trong một range giá. Bot tự mua thấp bán cao trong range sideway.', example: 'Grid $60K-$70K, 20 lệnh → bot tự giao dịch mỗi $500, lãi $50-100/lệnh.' },
];

export const TERMS_DETAIL: Record<string, TermDetail> = {
  'support-resistance': {
    term: 'Hỗ Trợ & Kháng Cự', english: 'Support & Resistance', category: 'Phân tích kỹ thuật',
    illustration: '/src/assets/dict/support-resistance.jpg',
    basic: { definition: 'Vùng giá mà tại đó lực mua (hỗ trợ) hoặc lực bán (kháng cự) đủ mạnh để ngăn giá đi xa hơn. S/R là VÙNG, không phải đường chính xác.', example: 'BTC có hỗ trợ tại $60,000 — giá bounce 3 lần từ vùng này.', howToApply: 'Vẽ đường ngang tại các mức giá mà giá đã đảo chiều nhiều lần. Mua gần hỗ trợ, bán gần kháng cự.', commonMistakes: 'Đặt entry ngay tại mức S/R thay vì chờ xác nhận nến. S/R là vùng, không phải đường chính xác.' },
    advanced: {
      definition: 'S/R động (Dynamic S/R) từ EMA 50/200, Bollinger Bands. S/R flipping — khi kháng cự bị phá vỡ sẽ trở thành hỗ trợ và ngược lại. Institutional S/R dựa trên Volume Profile và Order Flow cho thấy vùng tích lũy lệnh lớn.',
      example: 'BTC phá $68K (kháng cự) → retest $68K thành hỗ trợ → Long entry với volume xác nhận tại vùng S/R flip.',
      howToApply: 'Kết hợp S/R với Volume Profile (POC, VAH, VAL), Order Flow và Footprint Chart. Xác nhận bằng nến đảo chiều + volume spike. Multi-timeframe: S/R trên HTF (D1, W1) mạnh hơn LTF.',
      commonMistakes: 'Bỏ qua context (xu hướng lớn). S/R yếu khi volume thấp hoặc đã bị test quá nhiều lần (>3 lần). Không phân biệt S/R tĩnh vs S/R động.',
      proTips: ['Dùng heatmap thanh khoản để xác định vùng S/R ẩn mà retail trader không thấy', 'S/R mạnh nhất là nơi có sự hội tụ (confluence) giữa Fib, EMA, và mức giá tròn', 'Round numbers ($60K, $70K) thường là S/R tâm lý cực mạnh'],
      keyTakeaways: ['S/R là vùng, không phải đường — luôn để buffer 0.5-1%', 'S/R càng nhiều timeframe xác nhận càng mạnh', 'S/R flip (kháng cự → hỗ trợ) là setup entry tin cậy nhất']
    },
  },
  'breakout': {
    term: 'Breakout', english: 'Breakout Trading', category: 'Chiến lược giao dịch',
    illustration: '/src/assets/dict/breakout.jpg',
    basic: { definition: 'Khi giá phá vỡ qua vùng hỗ trợ hoặc kháng cự quan trọng với volume lớn, báo hiệu xu hướng mới.', example: 'ETH breakout trên $4,000 với volume tăng 250%.', howToApply: 'Chờ nến đóng cửa trên/dưới S/R + volume xác nhận. Entry sau breakout hoặc retest.', commonMistakes: 'FOMO vào ngay khi giá chạm S/R, không chờ xác nhận. Dễ bị fakeout.' },
    advanced: {
      definition: 'Breakout with retest, failed breakout (fakeout trap), breakout từ consolidation dài (>20 nến). Phân biệt: True Breakout cần volume > 2x trung bình + nến đóng ngoài S/R. Breakout sau Bollinger Squeeze có xác suất thành công cao nhất.',
      example: 'BTC consolidation 3 tuần trong range $65K-$68K → BB Squeeze → phá $68K + volume 3x → retest $68K hold → Long confirmed, target Fib Ext 1.618.',
      howToApply: 'Dùng multi-timeframe: breakout trên H4+ mới đáng tin. Kết hợp Bollinger Squeeze + volume profile. Entry 2 cách: (1) Aggressive: entry ngay khi nến breakout đóng, (2) Conservative: chờ retest rồi entry.',
      commonMistakes: 'Không phân biệt breakout thật vs fakeout. Cần volume > 2x trung bình 20 phiên. Breakout trên M5/M15 thường là noise — ưu tiên H4+.',
      proTips: ['Fakeout thường xảy ra khi volume thấp — luôn kiểm tra volume trước khi entry', 'Breakout sau consolidation dài (>20 nến) mạnh hơn nhiều so với consolidation ngắn', 'Đặt SL dưới/trên vùng consolidation thay vì ngay tại mức S/R vừa phá'],
      keyTakeaways: ['Volume là yếu tố xác nhận số 1 — không có volume = không tin', 'Retest sau breakout là entry an toàn nhất', 'Fakeout trap có thể trade ngược lại — failed breakout = reversal signal']
    },
  },
  'rsi': {
    term: 'RSI', english: 'Relative Strength Index', category: 'Chỉ báo kỹ thuật',
    illustration: '/src/assets/dict/rsi-divergence.jpg',
    basic: { definition: 'RSI đo tốc độ biến động giá trên thang 0-100. >70 quá mua (overbought), <30 quá bán (oversold). Mặc định dùng RSI 14.', example: 'RSI 14 chạm 25 → vùng quá bán → theo dõi tín hiệu mua.', howToApply: 'Dùng RSI 14 làm mặc định. Tìm vùng quá mua/bán kết hợp S/R zone.', commonMistakes: 'Mua ngay khi RSI < 30 — trong downtrend mạnh, RSI có thể ở vùng quá bán rất lâu.' },
    advanced: {
      definition: 'RSI Regular Divergence (báo đảo chiều): giá đỉnh cao hơn nhưng RSI đỉnh thấp hơn. Hidden Divergence (báo tiếp tục trend): giá đáy cao hơn nhưng RSI đáy thấp hơn. RSI Failure Swing: RSI phá đỉnh/đáy trước đó — tín hiệu sớm hơn cả price action.',
      example: 'BTC tạo đỉnh $73K (RSI 78) → đỉnh $74K (RSI 65) = Bearish Regular Divergence. 2 tuần sau giá giảm 18% về $60K. Hidden Bullish Div tại $60K xác nhận đáy.',
      howToApply: 'Kết hợp RSI divergence với S/R zone + volume. Hidden divergence xác nhận xu hướng tiếp tục — trade theo trend. Regular Divergence cần confluence (Fib, S/R) để entry counter-trend.',
      commonMistakes: 'Dùng RSI đơn lẻ không kết hợp price action. Divergence cần xác nhận bằng nến đảo chiều — đừng entry khi divergence mới hình thành.',
      proTips: ['RSI Failure Swing cho tín hiệu sớm hơn divergence — RSI phá đỉnh/đáy trước khi giá làm', 'Dùng RSI trên HTF (H4, D1) cho divergence — LTF cho quá nhiều noise', 'RSI 50 là "đường giữa" — giá trên 50 = bullish bias, dưới 50 = bearish bias'],
      keyTakeaways: ['Regular Divergence = counter-trend, cần S/R confluence', 'Hidden Divergence = continuation, trade theo trend', 'Đừng entry chỉ vì RSI overbought/oversold — chờ price action xác nhận']
    },
  },
  'macd': {
    term: 'MACD', english: 'Moving Average Convergence Divergence', category: 'Chỉ báo kỹ thuật',
    illustration: '/src/assets/dict/macd.jpg',
    basic: { definition: 'MACD = EMA 12 - EMA 26. Signal Line = EMA 9 của MACD. Histogram = MACD - Signal. Cắt lên = mua, cắt xuống = bán.', example: 'MACD cắt lên Signal + Histogram dương → Xác nhận đà tăng.', howToApply: 'Tìm MACD crossover kết hợp với trend direction. Zero-line crossover là tín hiệu mạnh hơn.', commonMistakes: 'MACD là lagging indicator — chậm hơn giá. Không dùng MACD trong thị trường sideway.' },
    advanced: {
      definition: 'MACD Histogram Divergence phát hiện momentum yếu đi sớm hơn MACD line. Zero-line rejection: MACD chạm zero rồi bật lại = trend continuation mạnh. Multi-timeframe MACD: HTF cho direction, LTF cho entry.',
      example: 'D1 MACD trên zero (bullish) + H4 MACD crossover up = Long entry. Histogram H4 giảm dần khi giá sideways = momentum yếu, chuẩn bị reversal.',
      howToApply: 'Kết hợp MACD Histogram divergence (HTF) với price action (LTF) cho entry chính xác. Zero-line acts as dynamic S/R cho MACD. MACD + Bollinger Bands = combo mạnh.',
      commonMistakes: 'Sử dụng MACD crossover đơn thuần mà không xét context. Trong sideway market, MACD cho rất nhiều false signals. MACD lag nhiều trên LTF.',
      proTips: ['MACD Histogram divergence sớm hơn MACD line divergence 3-5 nến', 'Zero-line rejection là tín hiệu continuation mạnh nhất của MACD', 'Dùng MACD settings (5, 13, 1) cho scalping — phản ứng nhanh hơn mặc định'],
      keyTakeaways: ['MACD là trend-following indicator — chỉ dùng trong trending market', 'Histogram cho tín hiệu sớm nhất, sau đó đến MACD line, cuối cùng là zero-line', 'Multi-timeframe MACD: HTF direction + LTF entry = setup tin cậy']
    },
  },
  'fibonacci': {
    term: 'Fibonacci Retracement', english: 'Fibonacci Retracement', category: 'Phân tích kỹ thuật',
    illustration: '/src/assets/dict/fibonacci.jpg',
    basic: { definition: 'Vẽ các mức thoái lui 23.6%, 38.2%, 50%, 61.8%, 78.6% từ swing low → swing high. Vùng 50%-61.8% = "Golden Zone" — nơi giá hay đảo chiều nhất.', example: 'BTC tăng từ $60K → $73K. Pullback về Fib 61.8% ($65K) rồi bật tăng.', howToApply: 'Vẽ Fib từ đáy đến đỉnh gần nhất. Tìm entry tại Golden Zone (50-61.8%) với nến xác nhận.', commonMistakes: 'Dùng Fibonacci đơn lẻ. Cần kết hợp với S/R, trendline để tìm confluence (hội tụ).' },
    advanced: {
      definition: 'Fibonacci Extension (mục tiêu giá: 1.272, 1.618, 2.618) để đặt Take Profit. Fibonacci Clusters: khi nhiều mức Fib từ các swing khác nhau trùng tại 1 vùng → S/R cực mạnh. Auto-Fib dùng thuật toán pivot detection.',
      example: 'Entry tại Golden Zone Fib 61.8% ($65K) → TP1 tại Fib Extension 1.272 ($76.5K), TP2 tại 1.618 ($82K). R:R = 1:4. Fib Cluster tại $64.5K-$65.5K (3 Fib levels trùng) = confluent demand zone.',
      howToApply: 'Dùng Fib Clusters: khi mức Fib từ nhiều swing khác nhau trùng tại 1 vùng giá → S/R cực mạnh. Kết hợp Fib + EMA + S/R cho "triple confluence" entry.',
      commonMistakes: 'Vẽ Fib trên timeframe quá nhỏ (M1, M5) — không đáng tin. Nên dùng H4+ trở lên. Không sử dụng Fib Extension cho TP — bỏ lỡ profit target chính xác.',
      proTips: ['Golden Zone (50-61.8%) có xác suất bounce >70% trong trending market', 'Fib + round number ($65K) + EMA 200 = "Triple Confluence" — setup A+', 'Dùng Fib Extension cho TP thay vì guess — 1.618 là target phổ biến nhất'],
      keyTakeaways: ['Fibonacci hoạt động vì nhiều trader cùng nhìn và giao dịch tại các mức này', 'Golden Zone (50-61.8%) là vùng entry tốt nhất', 'Luôn tìm confluence — Fib + S/R + EMA = xác suất cao nhất']
    },
  },
  'bollinger-bands': {
    term: 'Bollinger Bands', english: 'Bollinger Bands', category: 'Chỉ báo kỹ thuật',
    illustration: '/src/assets/dict/bollinger-bands.jpg',
    basic: { definition: '3 dải: SMA 20 ± 2 Standard Deviation. Giá chạm dải trên = quá mua, dải dưới = quá bán. BB Squeeze = dải siết lại, báo biến động lớn sắp tới.', example: 'BB siết lại 2 tuần → giá phá lên dải trên → Breakout xác nhận.', howToApply: 'Tìm BB Squeeze (bandwidth thấp) → chờ breakout. Trong ranging market: mua dải dưới, bán dải trên.', commonMistakes: 'Giá chạm dải trên ≠ bán ngay. Trong uptrend, giá "đi dạo" trên dải trên rất lâu.' },
    advanced: {
      definition: 'BB %B indicator (0-1) cho thấy vị trí giá trong dải. Bandwidth indicator đo độ rộng dải — cực thấp = Squeeze sắp nổ. TTM Squeeze: khi BB nằm trong Keltner Channel = Squeeze cực mạnh, xác suất breakout lớn >80%.',
      example: 'BB nằm trong Keltner Channel (TTM Squeeze kích hoạt) → Squeeze 15 nến → phá ra + momentum histogram dương → Breakout tăng mạnh 12% trong 3 ngày.',
      howToApply: 'Dùng TTM Squeeze (BB + Keltner) để phát hiện breakout sớm. BB %B > 1 = overbought extension, < 0 = oversold extension. Kết hợp RSI để xác nhận.',
      commonMistakes: 'BB hoạt động kém trong trending market mạnh — giá "walk the band". Kết hợp với RSI/MACD để lọc tín hiệu. Squeeze không cho biết hướng — cần momentum indicator.',
      proTips: ['TTM Squeeze là một trong những setup breakout đáng tin cậy nhất — học cách dùng', 'BB Bandwidth cực thấp (< 4%) = volatility sắp bùng nổ', 'Trong sideway: Mean Reversion strategy — mua dải dưới, bán dải trên, SL ngoài dải'],
      keyTakeaways: ['Squeeze = biến động lớn sắp xảy ra, nhưng không cho biết hướng', 'TTM Squeeze (BB + Keltner) mạnh hơn BB Squeeze đơn thuần', 'Trend market: trade breakout. Range market: trade mean reversion']
    },
  },
  'leverage': {
    term: 'Đòn Bẩy', english: 'Leverage', category: 'Giao dịch phái sinh',
    illustration: '/src/assets/dict/leverage.jpg',
    basic: { definition: 'Vay vốn từ sàn để giao dịch lớn hơn vốn thực. 10x = kiểm soát vị thế gấp 10 lần. Lãi VÀ lỗ đều nhân lên.', example: 'Vốn $1,000 × 10x = vị thế $10,000. Giá tăng 5% → lãi $500 (50%). Giá giảm 10% → mất hết vốn.', howToApply: 'Người mới: tối đa 3-5x. Chuyên nghiệp: 5-20x với SL chặt. KHÔNG BAO GIỜ dùng 50-125x.', commonMistakes: 'Dùng đòn bẩy cao (50x+) → liquidation nhanh. Đòn bẩy không tăng lợi nhuận, nó tăng RỦI RO.' },
    advanced: {
      definition: 'Cross Margin vs Isolated Margin. Cross: toàn bộ balance làm margin — 1 vị thế liquidation có thể mất hết account. Isolated: chỉ dùng margin riêng cho mỗi vị thế — giới hạn rủi ro. Effective Leverage = Total Position / Total Equity.',
      example: 'Isolated 10x: vốn $1K, chỉ mất tối đa $1K nếu liquidation. Cross 10x với balance $10K: liquidation 1 vị thế có thể kéo toàn bộ $10K. Pro trader: Isolated + SL = kiểm soát hoàn toàn.',
      howToApply: 'LUÔN dùng Isolated Margin để giới hạn rủi ro mỗi trade. Effective Leverage nên < 5x. Tính position size: Risk Amount / (Entry - SL) = Size. Ví dụ: risk $100, SL 2% → size $5,000 = 5x leverage trên $1K.',
      commonMistakes: 'Dùng Cross Margin mặc định mà không biết → liquidation 1 vị thế mất toàn bộ tài khoản. Nhầm lẫn giữa leverage cao = lợi nhuận cao — thực tế là risk cao.',
      proTips: ['Effective Leverage < 5x là nguyên tắc vàng — ngay cả khi sàn cho phép 125x', 'Dùng Position Size Calculator: Risk% × Account / SL distance = Correct Size', 'Trailing Stop + Isolated Margin = combo an toàn nhất cho futures trading'],
      keyTakeaways: ['Leverage KHÔNG tăng lợi nhuận — nó tăng SIZE và RỦI RO', 'Isolated Margin > Cross Margin trong 99% trường hợp', 'Tính position size dựa trên risk management, KHÔNG dựa trên leverage']
    },
  },
  'scalping': {
    term: 'Scalping', english: 'Scalping', category: 'Chiến lược giao dịch',
    illustration: '/src/assets/dict/scalping.jpg',
    basic: { definition: 'Giao dịch siêu ngắn (vài giây → vài phút), kiếm lợi nhuận nhỏ (0.1-0.5%) nhưng giao dịch rất nhiều lần/ngày.', example: 'Scalp BTC khung M1: entry → TP +0.2% → lặp lại 30 lần/ngày = ~6% tổng.', howToApply: 'Dùng khung M1-M5. Cần sàn phí thấp, internet tốc độ cao, và kỷ luật cắt lỗ nhanh.', commonMistakes: 'Để lệnh lỗ chạy (không cắt lỗ). Phí giao dịch ăn hết lợi nhuận nếu size quá nhỏ.' },
    advanced: {
      definition: 'Order Book Scalping: đọc DOM (Depth of Market) để thấy lệnh chờ lớn, spoofing, iceberg orders. Tape Reading: theo dõi Time & Sales để thấy giao dịch lớn real-time. Footprint Chart: kết hợp price + volume tại mỗi mức giá.',
      example: 'DOM hiện sell wall 500 BTC tại $68K → wall bị rút (spoofing) → giá sẽ phá $68K → Long scalp entry $67.9K → TP $68.3K trong 2 phút. Profit $400 trên $10K position.',
      howToApply: 'Học đọc Order Book và Footprint Chart. Dùng DOM để thấy lệnh chờ lớn. Setup: M1 chart + DOM + Time & Sales + Footprint. Cần VPS gần server sàn để giảm latency.',
      commonMistakes: 'Scalping mà không tính phí + slippage — maker/taker fee ăn 50%+ profit. Cần winrate > 60% và R:R tối thiểu 1:1.5. Overtrade khi thua → revenge trading.',
      proTips: ['Chỉ scalp trong giờ volume cao (London Open, NY Open) — thanh khoản tốt, spread thấp', 'Maker fee thấp hơn taker — dùng Limit Order thay Market Order khi có thể', 'Đặt daily loss limit (ví dụ: -2% account) — dừng scalp khi chạm limit'],
      keyTakeaways: ['Scalping không dành cho người mới — cần kỹ năng đọc order flow', 'Phí giao dịch là "kẻ thù" #1 — chọn sàn có phí thấp nhất', 'Kỷ luật > kỹ thuật: daily loss limit và SL cứng là bắt buộc']
    },
  },
  'dca': {
    term: 'DCA', english: 'Dollar Cost Averaging', category: 'Chiến lược giao dịch',
    illustration: '/src/assets/dict/dca.jpg',
    basic: { definition: 'Mua đều đặn một lượng tiền cố định theo lịch trình, bất kể giá cao hay thấp. Giảm rủi ro "timing" sai.', example: 'Mua $200 BTC mỗi tuần trong 1 năm → giá entry trung bình $45K (tốt hơn all-in tại $60K).', howToApply: 'Đặt lịch mua tự động trên sàn (Binance Auto-Invest). Kiên trì ít nhất 6-12 tháng.', commonMistakes: 'DCA vào shitcoin. Chỉ nên DCA vào tài sản mình tin tưởng dài hạn (BTC, ETH).' },
    advanced: {
      definition: 'Value Averaging (VA): DCA thông minh — mua nhiều hơn khi giá dưới giá trị mục tiêu, ít hơn khi giá trên. Kết hợp on-chain metrics (MVRV, NUPL, 200W MA) để điều chỉnh lượng DCA theo chu kỳ thị trường.',
      example: 'BTC dưới 200-week MA → DCA gấp 3x ($600/tuần thay vì $200). BTC NUPL > 0.75 (Euphoria) → ngưng DCA, chờ correction. Kết quả: +40% ROI so với DCA cố định.',
      howToApply: 'Dùng on-chain indicators (MVRV Z-Score, NUPL, Puell Multiple) để điều chỉnh DCA. Tăng size ở accumulation zone, giảm/ngưng ở distribution zone. Kết hợp exit plan: DCA ra (chốt lời từng phần) tại các mốc on-chain.',
      commonMistakes: 'DCA mù quáng không bao giờ chốt lời — cần kế hoạch exit rõ ràng. DCA vào altcoin rủi ro — chỉ DCA vào top 5-10 assets theo market cap. Không điều chỉnh size theo chu kỳ.',
      proTips: ['DCA + On-chain = Smart DCA — tăng size khi MVRV < 1, giảm khi MVRV > 3', 'Luôn có DCA-out plan (ví dụ: bán 10% mỗi khi giá tăng 50%)', 'BTC 200-week MA là "đường giá trị" lịch sử — dưới MA = accumulation zone'],
      keyTakeaways: ['DCA đơn giản nhất nhưng hiệu quả nhất cho nhà đầu tư dài hạn', 'Value Averaging > DCA cố định khi kết hợp on-chain data', 'Luôn có kế hoạch chốt lời — DCA không có nghĩa là hold mãi mãi']
    },
  },
};
