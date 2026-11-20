import { getText, pickLocalized } from '../i18n/translations';
import { Category, Language, Product } from '../types/store';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
  category?: Category;
  lang: Language;
  onSelect: (slug: string) => void;
}

export function ProductCard({ product, category, lang, onSelect }: ProductCardProps) {
  const t = getText(lang);
  const title = pickLocalized(product, lang);
  const categoryName = category ? pickLocalized(category, lang) : '';
  const primaryImg = product.images[0]?.url;
  const effectivePrice = product.salePrice ?? product.originalPrice;
  const hasDiscount = product.salePrice !== null && product.salePrice < product.originalPrice;

  // Unique color hexes for clean swatch preview
  const uniqueColors = Array.from(
    new Map(product.variants.map((v) => [v.colorHex, v.colorNameAr])).entries()
  ).slice(0, 4);

  return (
    <article
      onClick={() => onSelect(product.slug)}
      className="group cursor-pointer flex flex-col bg-white border border-[#E6E2D8] rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-[#F3F1EC] overflow-hidden">
        <ResilientImage
          src={primaryImg}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#7A746B]">
            <span>{categoryName}</span>
            {hasDiscount && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#9A7B4F] font-medium">-{product.discountPercent}%</span>
              </>
            )}
            {product.totalStock === 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-red-700 font-medium">{t.outOfStock}</span>
              </>
            )}
          </div>

          <h3 className="mt-1 text-base font-semibold text-[#141413] line-clamp-1">{title}</h3>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[15px] font-semibold text-[#141413]">
              {effectivePrice.toFixed(0)} {t.currency}
            </span>
            {hasDiscount && (
              <span className="text-xs text-[#8E877D] line-through">
                {product.originalPrice.toFixed(0)} {t.currency}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {uniqueColors.map(([hex, label]) => (
              <span
                key={hex}
                title={label}
                className="w-3 h-3 rounded-full border border-black/15"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
