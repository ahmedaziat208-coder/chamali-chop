import { useEffect, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { getText } from '../i18n/translations';
import { Language, OrderRecord } from '../types/store';

interface OrderTrackingViewProps {
  lang: Language;
  initialOrderNumber?: string;
  initialPhone?: string;
}

const statusLabels: Record<string, Record<Language, string>> = {
  new: { ar: 'طلب جديد', fr: 'Nouvelle commande', en: 'New Order' },
  pending_confirmation: { ar: 'قيد التأكيد', fr: 'En confirmation', en: 'Pending Confirmation' },
  confirmed: { ar: 'مؤكد', fr: 'Confirmée', en: 'Confirmed' },
  preparing: { ar: 'قيد التجهيز', fr: 'En préparation', en: 'Preparing' },
  shipped: { ar: 'تم الشحن', fr: 'Expédiée', en: 'Shipped' },
  delivered: { ar: 'تم التسليم', fr: 'Livrée', en: 'Delivered' },
  cancelled: { ar: 'ملغى', fr: 'Annulée', en: 'Cancelled' },
};

export function OrderTrackingView({
  lang,
  initialOrderNumber = '',
  initialPhone = '',
}: OrderTrackingViewProps) {
  const t = getText(lang);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderRecord | null>(null);

  const performLookup = async (ordNum: string, ph: string) => {
    if (!ordNum.trim() || !ph.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/track?orderNumber=${encodeURIComponent(ordNum.trim())}&phone=${encodeURIComponent(
          ph.trim()
        )}`
      );
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error || 'Order not found');
      } else {
        setResult({
          ...data.order,
          subtotal: Number(data.order.subtotal),
          shippingFee: Number(data.order.shippingFee),
          discountAmount: Number(data.order.discountAmount),
          totalAmount: Number(data.order.totalAmount),
          items: data.items,
        });
      }
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber && initialPhone) {
      performLookup(initialOrderNumber, initialPhone);
    }
  }, [initialOrderNumber, initialPhone]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <PackageSearch className="w-6 h-6 text-[#9A7B4F]" />
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#141413]">
            {t.trackTitle}
          </h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            performLookup(orderNumber, phone);
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <input
            type="text"
            required
            placeholder="CHM-2026-1001"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm font-mono-tabular focus:outline-none focus:border-[#141413]"
          />
          <input
            type="tel"
            required
            dir="ltr"
            placeholder="06XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm font-mono-tabular focus:outline-none focus:border-[#141413]"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
          >
            {loading ? '...' : t.trackBtn}
          </button>
        </form>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        {result && (
          <div className="pt-4 border-t border-[#E6E2D8] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-[#7A746B]">{t.orderNumber}</p>
                <p className="font-mono-tabular text-lg font-semibold text-[#141413]">
                  {result.orderNumber}
                </p>
              </div>
              <div className="text-end">
                <p className="text-xs text-[#7A746B]">Status</p>
                <p className="text-sm font-semibold text-[#9A7B4F]">
                  {statusLabels[result.status]?.[lang] || result.status}
                </p>
              </div>
            </div>

            <div className="bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg p-4 space-y-2 text-sm">
              {result.items?.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>
                    {it.productName} ({it.colorName} · {it.size}) × {it.quantity}
                  </span>
                  <span className="tabular-nums font-medium">
                    {Number(it.totalPrice).toFixed(0)} {t.currency}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-[#E6E2D8] flex justify-between font-semibold">
                <span>{t.total}</span>
                <span className="tabular-nums">
                  {result.totalAmount.toFixed(0)} {t.currency}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
