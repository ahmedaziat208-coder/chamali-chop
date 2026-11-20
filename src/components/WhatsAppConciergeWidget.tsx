import { useState } from 'react';
import { ExternalLink, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { getText } from '../i18n/translations';
import { Language, StoreSettings } from '../types/store';

interface WhatsAppConciergeWidgetProps {
  settings: StoreSettings | null;
  lang: Language;
}

interface ChatMsg {
  role: 'user' | 'model';
  text: string;
}

export function WhatsAppConciergeWidget({ settings, lang }: WhatsAppConciergeWidgetProps) {
  const t = getText(lang);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'model',
      text:
        lang === 'fr'
          ? 'Bonjour chez CHAMALI SHOP ! Posez-moi vos questions sur nos articles, pointures, prix ou livraison au Maroc.'
          : lang === 'en'
          ? 'Welcome to CHAMALI SHOP! Ask me about any product, sizes, colors, prices, or Cash on Delivery across Morocco.'
          : 'مرحباً بك في الشمالي شوب! تقدر تسولني بالدارجة أو العربية أو الفرنسية على الأثمنة، المقاسات، الألوان أو التوصيل لأي مدينة في المغرب.',
    },
  ]);

  const waNum = (settings?.whatsappNumber || '212600000000').replace(/[^\d]/g, '');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || sending) return;

    const nextHistory = [...messages, { role: 'user' as const, text: msg }];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: data.error || 'Unable to reach AI assistant right now.',
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Connection error. Please try WhatsApp directly.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 end-5 z-40 no-print">
      {open && (
        <div className="mb-3 w-[340px] sm:w-[380px] bg-white border border-[#DCD6CA] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
          <div className="px-4 py-3.5 bg-[#141413] text-white flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">{t.aiConciergeTitle}</h3>
              <p className="text-[11px] text-white/75">{t.aiConciergeSubtitle}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={`https://wa.me/${waNum}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-[#1F6F4A] hover:bg-[#195A3C] text-white text-xs inline-flex items-center gap-1"
                title="Open WhatsApp"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6]">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#141413] text-white'
                      : 'bg-white border border-[#E6E2D8] text-[#141413]'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2 rounded-xl bg-white border border-[#E6E2D8] text-xs text-[#7A746B] inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="p-3 bg-white border-t border-[#E6E2D8] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.aiInputPlaceholder}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#DCD6CA] focus:outline-none focus:border-[#141413]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="p-2.5 rounded-lg bg-[#1F6F4A] text-white disabled:opacity-40 cursor-pointer"
              aria-label={t.send}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-13 h-13 rounded-full bg-[#1F6F4A] hover:bg-[#195A3C] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
        aria-label="WhatsApp & AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
}
