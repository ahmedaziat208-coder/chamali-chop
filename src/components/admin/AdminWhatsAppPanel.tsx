import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Send, UserCheck, AlertTriangle } from 'lucide-react';

interface AdminWhatsAppPanelProps {
  token: string;
}

interface ConfigStatus {
  configured: boolean;
  accessTokenSet: boolean;
  phoneNumberIdSet: boolean;
  businessAccountIdSet: boolean;
  verifyTokenSet: boolean;
  appSecretSet: boolean;
  missingVars: string[];
  webhookUrl: string;
}

interface Conversation {
  id: number;
  waPhone: string;
  customerName: string | null;
  aiEnabled: boolean;
  status: string;
  lastMessageAt: string;
}

interface WaMessage {
  id: number;
  direction: string;
  senderType: string;
  body: string;
  deliveryStatus: string;
  createdAt: string;
}

interface WaTemplate {
  id: number;
  eventKey: string;
  metaTemplateName: string;
  bodyAr: string;
  bodyFr: string;
  bodyEn: string;
  isActive: boolean;
}

export function AdminWhatsAppPanel({ token }: AdminWhatsAppPanelProps) {
  const [loading, setLoading] = useState(true);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [testPhone, setTestPhone] = useState('212661000111');
  const [testMsg, setTestMsg] = useState('السلام، واش عندكم صندل الأطلس مقاس 42؟');
  const [testing, setTesting] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setConfigStatus(data.configStatus);
        setGeminiConfigured(data.geminiConfigured);
        setConversations(data.conversations || []);
        setTemplates(data.templates || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conv: Conversation) => {
    setActiveConv(conv);
    const res = await fetch(`/api/admin/whatsapp/conversations/${conv.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMessages(await res.json());
    }
  };

  useEffect(() => {
    loadOverview();
  }, [token]);

  const handleManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !replyText.trim()) return;
    await fetch(`/api/admin/whatsapp/conversations/${activeConv.id}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ body: replyText.trim() }),
    });
    setReplyText('');
    await loadOverview();
    await loadMessages({ ...activeConv, aiEnabled: false });
  };

  const handleToggleAi = async (conv: Conversation) => {
    const res = await fetch(`/api/admin/whatsapp/conversations/${conv.id}/ai`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ aiEnabled: !conv.aiEnabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setActiveConv(updated);
      await loadOverview();
    }
  };

  const handleTestInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMsg.trim() || testing) return;
    setTesting(true);
    try {
      const res = await fetch('/api/admin/whatsapp/test-inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: testPhone,
          customerName: 'عميل تجريبي',
          message: testMsg.trim(),
        }),
      });
      const data = await res.json();
      await loadOverview();
      if (data.conversation) {
        await loadMessages(data.conversation);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSaveTemplate = async (tpl: WaTemplate) => {
    await fetch(`/api/admin/whatsapp/templates/${tpl.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(tpl),
    });
    await loadOverview();
  };

  if (loading) {
    return <div className="p-8 text-sm text-[#7A746B]">جاري تحميل إعدادات ومحادثات WhatsApp...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Official Meta Cloud API & Gemini Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#141413]">
              حالة WhatsApp Business Cloud API الرسمي (Meta)
            </h3>
            {configStatus?.configured ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>متصل ومفعل</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                <span>يحتاج مفاتيح Meta</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#524E48]">
            رابط Webhook للربط في Meta Developer Portal:
          </p>
          <code className="block p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E6E2D8] text-xs font-mono-tabular break-all">
            {configStatus?.webhookUrl}
          </code>
          {configStatus && configStatus.missingVars.length > 0 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              المتغيرات الناقصة في Secrets / البيئة:{' '}
              <span className="font-mono-tabular">{configStatus.missingVars.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Live AI Sales Assistant Test against Real DB */}
        <form
          onSubmit={handleTestInbound}
          className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#141413]">
              اختبار المساعد الذكي Gemini AI على قاعدة البيانات
            </h3>
            <span className="text-xs text-[#7A746B]">
              Gemini: {geminiConfigured ? 'متصل' : 'غير مضبوط'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              dir="ltr"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="2126XXXXXXXX"
              className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs font-mono-tabular"
            />
            <input
              type="text"
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              placeholder="رسالة الزبون بالدارجة أو العربية..."
              className="sm:col-span-2 px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            <span>محاكاة رسالة زبون وتوليد رد AI حقيقي</span>
          </button>
        </form>
      </div>

      {/* Conversations Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-[#E6E2D8] rounded-xl overflow-hidden min-h-[420px]">
        <div className="lg:col-span-4 border-e border-[#E6E2D8] divide-y divide-[#EFECE5] overflow-y-auto max-h-[460px]">
          <div className="p-4 bg-[#FAF9F6] text-xs font-semibold text-[#141413]">
            المحادثات ({conversations.length})
          </div>
          {conversations.length === 0 ? (
            <div className="p-6 text-xs text-[#7A746B]">لا توجد محادثات WhatsApp بعد.</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadMessages(c)}
                className={`w-full text-start p-4 hover:bg-[#FAF9F6] transition-colors cursor-pointer ${
                  activeConv?.id === c.id ? 'bg-[#F3F1EC]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular text-xs font-semibold text-[#141413]">
                    {c.waPhone}
                  </span>
                  <span className="text-[11px] text-[#7A746B]">
                    {c.aiEnabled ? 'AI مفعل' : 'تحكم بشري'}
                  </span>
                </div>
                <p className="text-xs text-[#524E48] mt-1">{c.customerName || 'زبون واتساب'}</p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col justify-between">
          {activeConv ? (
            <>
              <div className="p-4 border-b border-[#E6E2D8] flex items-center justify-between bg-[#FAF9F6]">
                <div>
                  <p className="text-sm font-semibold text-[#141413]">
                    {activeConv.customerName || activeConv.waPhone}
                  </p>
                  <p className="font-mono-tabular text-xs text-[#7A746B]">{activeConv.waPhone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAi(activeConv)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    activeConv.aiEnabled
                      ? 'border-emerald-700 text-emerald-800 bg-emerald-50'
                      : 'border-amber-700 text-amber-800 bg-amber-50'
                  }`}
                >
                  {activeConv.aiEnabled ? <Bot className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>
                    {activeConv.aiEnabled ? 'AI يعمل تلقائياً (اضغط للإيقاف)' : 'تحكم بشري (إعادة تشغيل AI)'}
                  </span>
                </button>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[300px]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-xl text-xs whitespace-pre-wrap ${
                        m.direction === 'outbound'
                          ? 'bg-[#141413] text-white'
                          : 'bg-[#F3F1EC] text-[#141413]'
                      }`}
                    >
                      <div className="text-[10px] opacity-65 mb-1">
                        {m.senderType} · {m.deliveryStatus}
                      </div>
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleManualReply}
                className="p-3 border-t border-[#E6E2D8] flex gap-2 bg-white"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="رد يدوي كموظف (يوقف الرد التلقائي للذكاء الاصطناعي)..."
                  className="flex-1 px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1F6F4A] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#7A746B] p-8">
              اختر محادثة لعرض الرسائل أو التحكم في المساعد الذكي.
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Notification Templates */}
      <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#141413]">
          قوالب إشعارات الطلبات المعتمدة عبر WhatsApp
        </h3>
        <div className="space-y-4">
          {templates.map((tpl, idx) => (
            <div key={tpl.id} className="p-4 rounded-lg border border-[#E6E2D8] bg-[#FAF9F6] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono-tabular font-semibold">{tpl.eventKey}</span>
                <button
                  type="button"
                  onClick={() => handleSaveTemplate(tpl)}
                  className="px-3 py-1 rounded bg-[#141413] text-white text-xs cursor-pointer"
                >
                  حفظ القالب
                </button>
              </div>
              <textarea
                rows={2}
                value={tpl.bodyAr}
                onChange={(e) => {
                  const next = [...templates];
                  next[idx].bodyAr = e.target.value;
                  setTemplates(next);
                }}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs bg-white"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
