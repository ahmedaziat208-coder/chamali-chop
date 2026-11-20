import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Truck,
  ZoomIn,
  X,
} from 'lucide-react';
import { getText, pickLocalized } from '../i18n/translations';
import { CartItem, Category, Language, Product, StoreSettings } from '../types/store';
import { ProductCard } from './ProductCard';
import { ResilientImage } from './ResilientImage';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  categories: Category[];
  settings: StoreSettings | null;
  lang: Language;
  onBack: () => void;
  onSelectProduct: (slug: string) => void;
  onAddToCart: (item: CartItem, openDrawer?: boolean) => void;
  onBuyNow: (item: CartItem) => void;
}

export function ProductDetailView({
  product,
  allProducts,
  categories,
  settings,
  lang,
  onBack,
  onSelectProduct,
  onAddToCart,
  onBuyNow,
}: ProductDetailViewProps) {
  const t = getText(lang);
  const title = pickLocalized(product, lang);
  const description =
    lang === 'fr'
      ? product.descriptionFr
      : lang === 'en'
      ? product.descriptionEn
      : product.descriptionAr;

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Unique colors for this product
  const colors = useMemo(() => {
    const map = new Map<
      string,
      { colorNameEn: string; colorNameAr: string; colorNameFr: string; colorHex: string }
    >();
    for (const v of product.variants) {
      if (!map.has(v.colorNameEn)) {
        map.set(v.colorNameEn, {
          colorNameEn: v.colorNameEn,
          colorNameAr: v.colorNameAr,
          colorNameFr: v.colorNameFr,
          colorHex: v.colorHex,
        });
      }
    }
    return Array.from(map.values());
  }, [product]);

  const [selectedColor, setSelectedColor] = useState<string>(colors[0]?.colorNameEn || '');

  // Sizes available for selected color
  const sizesForColor = useMemo(() => {
    return product.variants.filter((v) => v.colorNameEn === selectedColor);
  }, [product, selectedColor]);

  const [selectedSize, setSelectedSize] = useState<string>(
    sizesForColor.find((v) => v.quantity > 0)?.size || sizesForColor[0]?.size || ''
  );
  const [quantity, setQuantity] = useState(1);

  // Reset selections when switching products
  useEffect(() => {
    const firstColor = colors[0]?.colorNameEn || '';
    setSelectedColor(firstColor);
    const firstSizes = product.variants.filter((v) => v.colorNameEn === firstColor);
    setSelectedSize(firstSizes.find((v) => v.quantity > 0)?.size || firstSizes[0]?.size || '');
    setQuantity(1);
    setActiveImageIdx(0);

    // Update page SEO title dynamically
    document.title = `${title} | CHAMALI SHOP`;
  }, [product.id, colors, title]);

  // Keep selectedSize valid when color changes
  useEffect(() => {
    const valid = sizesForColor.find((v) => v.size === selectedSize);
    if (!valid) {
      const next = sizesForColor.find((v) => v.quantity > 0) || sizesForColor[0];
      setSelectedSize(next?.size || '');
    }
    setQuantity(1);
  }, [selectedColor, sizesForColor, selectedSize]);

  const activeVariant = useMemo(() => {
    return (
      product.variants.find(
        (v) => v.colorNameEn === selectedColor && v.size === selectedSize
      ) || product.variants[0]
    );
  }, [product, selectedColor, selectedSize]);

  const availableStock = activeVariant?.quantity ?? 0;
  const effectivePrice = activeVariant?.priceOverride
    ? Number(activeVariant.priceOverride)
    : product.salePrice ?? product.originalPrice;
  const hasDiscount = product.salePrice !== null && product.salePrice < product.originalPrice;

  const buildCartItem = (): CartItem | null => {
    if (!activeVariant || availableStock <= 0) return null;
    return {
      productId: product.id,
      slug: product.slug,
      productNameAr: product.nameAr,
      productNameFr: product.nameFr,
      productNameEn: product.nameEn,
      variantId: activeVariant.id,
      colorNameAr: activeVariant.colorNameAr,
      colorNameFr: activeVariant.colorNameFr,
      colorNameEn: activeVariant.colorNameEn,
      colorHex: activeVariant.colorHex,
      size: activeVariant.size,
      unitPrice: effectivePrice,
      quantity: Math.min(quantity, availableStock),
      maxStock: availableStock,
      imageUrl: product.images[0]?.url || '',
    };
  };

  const handleWhatsAppDirectOrder = () => {
    const waNum = (settings?.whatsappNumber || '212600000000').replace(/[^\d]/g, '');
    const colorLabel =
      lang === 'fr'
        ? activeVariant?.colorNameFr
        : lang === 'en'
        ? activeVariant?.colorNameEn
        : activeVariant?.colorNameAr;
    const productUrl = `${window.location.origin}/product/${product.slug}`;
    const msg =
      lang === 'fr'
        ? `Bonjour CHAMALI SHOP, je souhaite commander : ${title} | Couleur: ${colorLabel} | Taille: ${selectedSize} | Qté: ${quantity} | Prix: ${effectivePrice} MAD\n${productUrl}`
        : lang === 'en'
        ? `Hello CHAMALI SHOP, I want to order: ${title} | Color: ${colorLabel} | Size: ${selectedSize} | Qty: ${quantity} | Price: ${effectivePrice} MAD\n${productUrl}`
        : `السلام عليكم الشمالي شوب، أود طلب المنتج:\n${title}\nاللون: ${colorLabel}\nالمقاس: ${selectedSize}\nالكمية: ${quantity}\nالثمن: ${effectivePrice} درهم\n${productUrl}`;
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/product/${product.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description.slice(0, 100),
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const similarProducts = allProducts
    .filter((p) => p.id !== product.id)
    .sort((a, b) => (a.categoryId === product.categoryId ? -1 : 1) - (b.categoryId === product.categoryId ? -1 : 1))
    .slice(0, 3);

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-[#524E48] hover:text-[#141413] mb-6 cursor-pointer"
      >
        <BackIcon className="w-4 h-4" />
        <span>{t.backToStore}</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Sticky Gallery */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div
            onClick={() => setZoomOpen(true)}
            className="relative aspect-[4/3] w-full bg-[#F3F1EC] border border-[#E6E2D8] rounded-xl overflow-hidden cursor-zoom-in group"
          >
            <ResilientImage
              src={product.images[activeImageIdx]?.url}
              alt={title}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 bg-white/90 text-[#141413] px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تكبير' : lang === 'fr' ? 'Zoom' : 'Zoom'}</span>
            </span>
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`aspect-[4/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    idx === activeImageIdx
                      ? 'border-[#141413] ring-1 ring-[#141413]'
                      : 'border-[#E6E2D8] opacity-75 hover:opacity-100'
                  }`}
                >
                  <ResilientImage src={img.url} alt={title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-5 bg-white border border-[#E6E2D8] rounded-xl p-6 sm:p-8 flex flex-col gap-6 lg:sticky lg:top-28">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#7A746B]">
              <span>SKU: {product.sku}</span>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 hover:text-[#141413] cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? t.linkCopied : t.shareProduct}</span>
              </button>
            </div>

            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-[#141413]">
              {title}
            </h1>

            <div className="mt-3 flex items-baseline gap-3 tabular-nums">
              <span className="text-2xl font-semibold text-[#141413]">
                {effectivePrice.toFixed(0)} {t.currency}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-[#8E877D] line-through">
                    {product.originalPrice.toFixed(0)} {t.currency}
                  </span>
                  <span className="text-sm font-medium text-[#9A7B4F]">
                    -{product.discountPercent}%
                  </span>
                </>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#524E48] border-t border-[#EFECE5] pt-4">
            {description}
          </p>

          {/* Color Selector */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-[#141413] mb-2.5">
              <span>{t.selectColor}</span>
              <span className="text-[#7A746B]">
                {lang === 'fr'
                  ? activeVariant?.colorNameFr
                  : lang === 'en'
                  ? activeVariant?.colorNameEn
                  : activeVariant?.colorNameAr}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {colors.map((c) => {
                const isSelected = c.colorNameEn === selectedColor;
                const label =
                  lang === 'fr' ? c.colorNameFr : lang === 'en' ? c.colorNameEn : c.colorNameAr;
                return (
                  <button
                    key={c.colorNameEn}
                    type="button"
                    onClick={() => setSelectedColor(c.colorNameEn)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#141413] bg-[#F3F1EC] text-[#141413]'
                        : 'border-[#E6E2D8] bg-white text-[#524E48] hover:border-[#B5AEA2]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/15"
                      style={{ backgroundColor: c.colorHex }}
                    />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Selector */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-[#141413] mb-2.5">
              <span>{t.selectSize}</span>
              <span className="tabular-nums text-xs">
                {availableStock > 0 ? (
                  <span className="text-emerald-800">
                    {t.inStockCount}: {availableStock} {t.pieces}
                  </span>
                ) : (
                  <span className="text-red-700 font-semibold">{t.outOfStock}</span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map((v) => {
                const isSelected = v.size === selectedSize;
                const soldOut = v.quantity <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedSize(v.size)}
                    className={`min-w-[48px] px-3 py-2 rounded-lg border text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#141413] bg-[#141413] text-white'
                        : soldOut
                        ? 'border-[#E6E2D8] bg-[#F7F6F2] text-[#ACA59B] line-through'
                        : 'border-[#E6E2D8] bg-white text-[#141413] hover:border-[#141413]'
                    }`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Stepper */}
          <div className="flex items-center justify-between border-y border-[#EFECE5] py-3.5">
            <span className="text-xs font-medium text-[#141413]">{t.quantity}</span>
            <div className="inline-flex items-center border border-[#DCD6CA] rounded-lg">
              <button
                type="button"
                disabled={quantity <= 1 || availableStock <= 0}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-2 text-[#141413] disabled:opacity-30 cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
              <button
                type="button"
                disabled={quantity >= availableStock || availableStock <= 0}
                onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                className="p-2 text-[#141413] disabled:opacity-30 cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={availableStock <= 0}
              onClick={() => {
                const item = buildCartItem();
                if (item) onBuyNow(item);
              }}
              className="w-full py-3.5 px-5 rounded-lg text-sm font-semibold text-white bg-[#141413] hover:bg-[#2A2927] disabled:bg-[#ACA59B] disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {availableStock > 0 ? t.buyNow : t.outOfStock}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={availableStock <= 0}
                onClick={() => {
                  const item = buildCartItem();
                  if (item) onAddToCart(item, true);
                }}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-xs font-semibold border border-[#141413] text-[#141413] hover:bg-[#F3F1EC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{t.addToCart}</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppDirectOrder}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-xs font-semibold border border-[#1F6F4A] text-[#1F6F4A] hover:bg-[#1F6F4A]/5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.orderWhatsapp}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-[#524E48]">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#9A7B4F] shrink-0" />
              <span>{t.fastMoroccoShipping}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#9A7B4F] shrink-0" />
              <span>{t.codGuarantee}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <section className="mt-16 pt-12 border-t border-[#E6E2D8]">
          <h2 className="font-display text-2xl font-semibold text-[#141413] mb-6">
            {t.similarProducts}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {similarProducts.map((sp) => (
              <ProductCard
                key={sp.id}
                product={sp}
                category={categories.find((c) => c.id === sp.categoryId)}
                lang={lang}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* Image Zoom Lightbox */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-5 end-5 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer"
            aria-label="Close zoom"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={product.images[activeImageIdx]?.url}
            alt={title}
            className="max-w-full max-h-[88vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
