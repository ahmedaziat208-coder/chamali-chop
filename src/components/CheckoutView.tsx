import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Loader2, Tag, Truck } from 'lucide-react';
import { getText } from '../i18n/translations';
import { CartItem, Language, OrderRecord, ShippingZone } from '../types/store';
import { ResilientImage } from './ResilientImage';

interface CheckoutViewProps {
  items: CartItem[];
  shippingZones: ShippingZone[];
  lang: Language;
  onBack: () => void;
  onOrderSuccess: (order: OrderRecord) => void;
  onTrackOrder: (orderNumber: string, phone: string) => void;
}

export function CheckoutView({
  items,
  shippingZones,
  lang,
  onBack,
  onOrderSuccess,
  onTrackOrder,
}: CheckoutViewProps) {
  const t = getText(lang);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cityId, setCityId] = useState<number>(shippingZones[0]?.id || 0);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(
    null
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null);
  const [idempotencyKey] = useState(
    () => `chm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [items]
  );

  const selectedZone = useMemo(
    () => shippingZones.find((z) => z.id === cityId) || shippingZones[0],
    [shippingZones, cityId]
  );

  const discountAmount = appliedCoupon?.discountAmount || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const shippingFee = useMemo(() => {
    if (!selectedZone) return 0;
    if (
      selectedZone.freeShippingThreshold &&
      afterDiscount >= selectedZone.freeShippingThreshold
    ) {
      return 0;
    }
    return selectedZone.shippingFee;
  }, [selectedZone, afterDiscount]);

  const totalAmount = afterDiscount + shippingFee;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null);
        setCouponError(data.error || 'Invalid coupon');
        return;
      }
      setAppliedCoupon({ code: data.code, discountAmount: data.discountAmount });
    } catch {
      setCouponError('Network error validating coupon');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || items.length === 0) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: fullName.trim(),
          customerPhone: phone.trim(),
          cityId: selectedZone?.id || cityId,
          address: address.trim(),
          notes: notes.trim(),
          paymentMethod: 'cod',
          couponCode: appliedCoupon?.code || null,
          idempotencyKey,
          items: items.map((it) => ({ variantId: it.variantId, quantity: it.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not place order');
        setSubmitting(false);
        return;
      }

      const created: OrderRecord = {
        ...data.order,
        subtotal: Number(data.order.subtotal),
        shippingFee: Number(data.order.shippingFee),
        discountAmount: Number(data.order.discountAmount),
        totalAmount: Number(data.order.totalAmount),
        items: data.items,
      };
      setCompletedOrder(created);
      onOrderSuccess(created);
    } catch {
      setError('Connection failed. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  if (completedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-14">
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#141413]">
            {t.orderSuccessTitle}
          </h1>
          <p className="text-sm text-[#524E48]">
            {t.orderNumber}:{' '}
            <span className="font-mono-tabular font-semibold text-[#141413]">
              {completedOrder.orderNumber}
            </span>
          </p>

          <div className="bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg p-5 text-start space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#7A746B]">{t.fullName}</span>
              <span className="font-medium text-[#141413]">{completedOrder.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7A746B]">{t.city}</span>
              <span className="font-medium text-[#141413]">{completedOrder.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7A746B]">{t.deliveryFee}</span>
              <span className="tabular-nums">
                {completedOrder.shippingFee === 0
                  ? t.freeDelivery
                  : `${completedOrder.shippingFee.toFixed(0)} ${t.currency}`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E6E2D8] font-semibold text-base">
              <span>{t.total}</span>
              <span className="tabular-nums">
                {completedOrder.totalAmount.toFixed(0)} {t.currency}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                onTrackOrder(completedOrder.orderNumber, completedOrder.customerPhone)
              }
              className="px-5 py-3 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
            >
              {t.navTrack}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 rounded-lg border border-[#DCD6CA] text-[#141413] text-xs font-semibold cursor-pointer"
            >
              {t.backToStore}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-[#524E48] hover:text-[#141413] mb-6 cursor-pointer"
      >
        <BackIcon className="w-4 h-4" />
        <span>{t.backToStore}</span>
      </button>

      <h1 className="font-display text-3xl font-semibold text-[#141413] mb-8">{t.checkoutTitle}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-[#E6E2D8] rounded-xl p-6 sm:p-8 space-y-5"
        >
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#141413] mb-1.5">
                {t.fullName} *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm focus:outline-none focus:border-[#141413]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#141413] mb-1.5">
                {t.phone} *
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                placeholder="06XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm font-mono-tabular focus:outline-none focus:border-[#141413]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">{t.city} *</label>
            <select
              value={selectedZone?.id || ''}
              onChange={(e) => setCityId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm bg-white focus:outline-none focus:border-[#141413]"
            >
              {shippingZones.map((z) => {
                const name =
                  lang === 'fr' ? z.cityNameFr : lang === 'en' ? z.cityNameEn : z.cityNameAr;
                return (
                  <option key={z.id} value={z.id}>
                    {name} — {z.shippingFee} {t.currency} ({z.estimatedDays})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">
              {t.address} *
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm focus:outline-none focus:border-[#141413]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">{t.notes}</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD6CA] text-sm focus:outline-none focus:border-[#141413]"
            />
          </div>

          <div className="pt-2">
            <label className="block text-xs font-medium text-[#141413] mb-2">
              {t.paymentMethod}
            </label>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 p-3.5 rounded-lg border border-[#141413] bg-[#FAF9F6] cursor-pointer">
                <input type="radio" name="payment" checked readOnly className="accent-[#141413]" />
                <Truck className="w-4 h-4 text-[#9A7B4F]" />
                <span className="text-sm font-medium text-[#141413]">{t.codLabel}</span>
              </label>
              <div className="flex items-center gap-3 p-3.5 rounded-lg border border-[#E6E2D8] bg-[#F7F6F2] opacity-60">
                <CreditCard className="w-4 h-4 text-[#7A746B]" />
                <span className="text-xs text-[#7A746B]">{t.cardLabel}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="w-full py-3.5 px-6 rounded-lg bg-[#141413] hover:bg-[#2A2927] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {t.confirmOrder} — {totalAmount.toFixed(0)} {t.currency}
            </span>
          </button>
        </form>

        {/* Order Summary */}
        <aside className="lg:col-span-5 bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-[#141413]">{t.cartTitle}</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {items.map((it) => {
              const title =
                lang === 'fr'
                  ? it.productNameFr
                  : lang === 'en'
                  ? it.productNameEn
                  : it.productNameAr;
              return (
                <div key={it.variantId} className="flex items-center gap-3 text-sm">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F3F1EC] shrink-0">
                    <ResilientImage
                      src={it.imageUrl}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#141413] truncate">{title}</p>
                    <p className="text-xs text-[#7A746B]">
                      {it.colorNameAr} · {it.size} × {it.quantity}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {(it.unitPrice * it.quantity).toFixed(0)} {t.currency}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Coupon */}
          <div className="pt-3 border-t border-[#EFECE5]">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-[#7A746B] absolute top-3 start-3" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={t.couponCode}
                  className="w-full ps-9 pe-3 py-2 rounded-lg border border-[#DCD6CA] text-xs uppercase focus:outline-none focus:border-[#141413]"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCoupon}
                className="px-4 py-2 rounded-lg border border-[#141413] text-xs font-semibold hover:bg-[#F3F1EC] cursor-pointer"
              >
                {t.apply}
              </button>
            </div>
            {couponError && <p className="mt-1.5 text-xs text-red-700">{couponError}</p>}
            {appliedCoupon && (
              <p className="mt-1.5 text-xs text-emerald-800">
                {appliedCoupon.code}: -{appliedCoupon.discountAmount} {t.currency}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-[#EFECE5] space-y-2 text-sm">
            <div className="flex justify-between text-[#524E48]">
              <span>{t.subtotal}</span>
              <span className="tabular-nums">
                {subtotal.toFixed(0)} {t.currency}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>{t.discount}</span>
                <span className="tabular-nums">
                  -{discountAmount.toFixed(0)} {t.currency}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[#524E48]">
              <span>
                {t.deliveryFee} ({selectedZone?.estimatedDays})
              </span>
              <span className="tabular-nums">
                {shippingFee === 0 ? t.freeDelivery : `${shippingFee.toFixed(0)} ${t.currency}`}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#E6E2D8] text-base font-semibold text-[#141413]">
              <span>{t.total}</span>
              <span className="tabular-nums">
                {totalAmount.toFixed(0)} {t.currency}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
