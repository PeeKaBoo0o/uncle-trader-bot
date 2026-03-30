import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, X, Sparkles, ChevronDown, Send, Zap, HelpCircle, Bell, EyeOff } from 'lucide-react';

interface AssistantMessage {
  id: string;
  type: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

const GREETINGS = [
  "Chào bạn 👋 Mình đang theo dõi trang Indicators cùng bạn!",
  "Welcome back — mình có thể giúp bạn đọc tín hiệu và trạng thái chỉ báo.",
  "Hey! Mình ở đây nếu bạn cần hỗ trợ phân tích chỉ báo 📊",
];

const QUICK_ACTIONS = [
  { label: 'Check signals', icon: Zap, action: 'check_signals' },
  { label: 'Explain indicator', icon: HelpCircle, action: 'explain' },
  { label: 'Active alerts', icon: Bell, action: 'alerts' },
  { label: 'Hide assistant', icon: EyeOff, action: 'hide' },
];

interface FloatingAssistantProps {
  latestSignal?: { symbol: string; strength: string; conditions: string[] } | null;
  trendState?: string;
  activePair?: string;
  activeTimeframe?: string;
}

const FloatingAssistant: React.FC<FloatingAssistantProps> = ({
  latestSignal,
  trendState,
  activePair = 'BTC/USDT',
  activeTimeframe = 'H4',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasGreeted, setHasGreeted] = useState(false);

  const dragRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Greeting on mount
  useEffect(() => {
    if (hasGreeted) return;
    const timer = setTimeout(() => {
      setShowBubble(true);
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      setMessages([{ id: '1', type: 'bot', text: greeting, timestamp: new Date() }]);
      setHasGreeted(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasGreeted]);

  // Auto-hide bubble after 6s
  useEffect(() => {
    if (showBubble && !isOpen) {
      const timer = setTimeout(() => setShowBubble(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showBubble, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Dragging logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = window.innerWidth - e.clientX + dragOffset.current.x - 56;
      const y = window.innerHeight - e.clientY + dragOffset.current.y - 56;
      setPosition({
        x: Math.max(0, Math.min(x, window.innerWidth - 60)),
        y: Math.max(0, Math.min(y, window.innerHeight - 60)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'bot',
      text,
      timestamp: new Date(),
    }]);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'check_signals':
        if (latestSignal) {
          addBotMessage(
            `📡 Tín hiệu gần nhất: **${latestSignal.symbol}** — Strength: ${latestSignal.strength}\n` +
            `Conditions: ${latestSignal.conditions.join(', ')}`
          );
        } else {
          addBotMessage('Chưa có tín hiệu mới gần đây. Mình đang theo dõi thị trường cho bạn! 👀');
        }
        break;
      case 'explain':
        addBotMessage(
          `📊 Đang xem ${activePair} trên khung ${activeTimeframe}.\n` +
          `Các chỉ báo giúp bạn xác định xu hướng (EMA, Pro EMA), vùng hỗ trợ/kháng cự (S/R, TP/SL), ` +
          `điểm vào lệnh (Buy/Sell Signal), và phân tích cấu trúc (Wyckoff, MS Engine).`
        );
        break;
      case 'alerts':
        addBotMessage(
          trendState
            ? `🔔 Trạng thái hiện tại: ${trendState}. Mình sẽ cập nhật nếu có thay đổi!`
            : '🔔 Chưa có alert nào đang active. Thị trường khá yên tĩnh.'
        );
        break;
      case 'hide':
        setIsOpen(false);
        setIsMinimized(true);
        break;
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userMsg: AssistantMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: inputValue.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Simple auto-response
    setTimeout(() => {
      addBotMessage(
        `Cảm ơn bạn! 🤖 Tính năng AI chat đang được phát triển. ` +
        `Hiện tại bạn có thể dùng các nút Quick Action bên dưới nhé!`
      );
    }, 800);
  };

  if (isMinimized) {
    return (
      <div
        ref={dragRef}
        className="fixed z-50 cursor-pointer group"
        style={{ right: position.x + 20, bottom: position.y + 20 }}
        onMouseDown={handleMouseDown}
        onClick={() => { if (!isDragging) { setIsMinimized(false); setIsOpen(true); } }}
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20 transition-transform group-hover:scale-110">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0b1120] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dragRef}
      className="fixed z-50"
      style={{ right: position.x + 20, bottom: position.y + 20 }}
    >
      {/* Notification Bubble */}
      {showBubble && !isOpen && (
        <div
          className="absolute bottom-16 right-0 w-64 bg-[#141b2d] border border-white/10 rounded-xl p-3 shadow-xl shadow-black/40 animate-in slide-in-from-bottom-2 fade-in duration-300 cursor-pointer"
          onClick={() => { setShowBubble(false); setIsOpen(true); }}
        >
          <p className="text-xs text-foreground/90 leading-relaxed">
            {messages[messages.length - 1]?.text || ''}
          </p>
          <div className="absolute -bottom-2 right-6 w-4 h-4 bg-[#141b2d] border-r border-b border-white/10 rotate-45" />
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 max-h-[480px] bg-[#0d1526] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-violet-500/10 to-cyan-500/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">Indicator Assistant</p>
              <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online • {activePair}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[180px] max-h-[280px] scrollbar-thin">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  msg.type === 'user'
                    ? 'bg-violet-500/20 text-foreground/90 rounded-br-md'
                    : 'bg-white/5 text-foreground/80 rounded-bl-md'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 border-t border-white/5">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.action}
                  onClick={() => handleQuickAction(qa.action)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  <qa.icon className="w-3 h-3" />
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1">
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5 focus-within:border-violet-500/30 transition-colors">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Hỏi gì đó..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="w-6 h-6 rounded-full bg-violet-500/20 hover:bg-violet-500/30 flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <Send className="w-3 h-3 text-violet-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <div
        className="cursor-pointer group"
        onMouseDown={handleMouseDown}
        onClick={() => { if (!isDragging) { setIsOpen(!isOpen); setShowBubble(false); } }}
      >
        <div className="relative">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
            isOpen
              ? 'bg-[#141b2d] border border-white/10 shadow-black/30'
              : 'bg-gradient-to-br from-violet-500 to-cyan-500 shadow-violet-500/20 group-hover:scale-110 group-hover:shadow-violet-500/40'
          }`}>
            {isOpen ? (
              <X className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
          </div>
          {!isOpen && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0b1120] animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};

export default FloatingAssistant;
