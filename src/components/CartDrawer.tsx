import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { getText } from '../i18n/translations';
import { CartItem, Language } from '../types/store';
import { ResilientImage } from './ResilientImage';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  lang: Language;
  onClose: () => void;
  onUpdateQty: (variantId: number, qty: number) => void;
  onRemove: (variantId: number) => void;
  onCheckout: () => void;
}

export function CartDrawer({
  open,
  items,
  lang,
  onClose,
  onUpdateQty,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  if (!open) return null;
  const t = getText(lang);
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex justify-end" onClick={onClose}>
      <aside
        className="w-full max-w-md bg-[#FAF9F6] h-full flex flex-col border-s border-[#E6E2D8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E6E2D8] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#141413]" />
            <h2 className="text-base font-semibold text-[#141413]">{t.cartTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#524E48] hover:text-[#141413] cursor-pointer"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#7A746B] py-16">
              <ShoppingBag className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm">{t.cartEmpty}</p>
            </div>
          ) : (
            items.map((item) => {
              const title =
                lang === 'fr'
                  ? item.productNameFr
                  : lang === 'en'
                  ? item.productNameEn
                  : item.productNameAr;
              const color =
                lang === 'fr'
                  ? item.colorNameFr
                  : lang === 'en'
                  ? item.colorNameEn
                  : item.colorNameAr;

              return (
                <div
                  key={item.variantId}
                  className="flex gap-4 bg-white border border-[#E6E2D8] rounded-xl p-3"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#F3F1EC] shrink-0">
                    <ResilientImage
                      src={item.imageUrl}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#141413] line-clamp-1">{title}</h3>
                        <p className="text-xs text-[#7A746B] mt-0.5">
                          {color} · {item.size}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.variantId)}
                        className="p-1 text-[#8E877D] hover:text-red-700 cursor-pointer"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-[#DCD6CA] rounded-md">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.variantId, item.quantity - 1)}
                          className="p-1.5 text-[#141413] cursor-pointer"
                          aria-label="Decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.maxStock}
                          onClick={() => onUpdateQty(item.variantId, item.quantity + 1)}
                          className="p-1.5 text-[#141413] disabled:opacity-30 cursor-pointer"
                          aria-label="Increase"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-[#141413] tabular-nums">
                        {(item.unitPrice * item.quantity).toFixed(0)} {t.currency}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 bg-white border-t border-[#E6E2D8] space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#524E48]">{t.subtotal}</span>
              <span className="text-lg font-semibold text-[#141413] tabular-nums">
                {subtotal.toFixed(0)} {t.currency}
              </span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3.5 px-5 rounded-lg bg-[#141413] hover:bg-[#2A2927] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {t.proceedCheckout}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
