import { useState } from 'react';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { getText } from '../i18n/translations';
import { Language, StoreSettings } from '../types/store';

interface StoreHeaderProps {
  settings: StoreSettings | null;
  lang: Language;
  onChangeLang: (lang: Language) => void;
  cartCount: number;
  onOpenCart: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onNavigate: (path: string) => void;
  onFilterSelect?: (filter: 'all' | 'sale') => void;
}

export function StoreHeader({
  settings,
  lang,
  onChangeLang,
  cartCount,
  onOpenCart,
  searchQuery,
  onSearchChange,
  onNavigate,
  onFilterSelect,
}: StoreHeaderProps) {
  const t = getText(lang);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const announcement =
    lang === 'fr'
      ? settings?.announcementFr
      : lang === 'en'
      ? settings?.announcementEn
      : settings?.announcementAr;

  const brandName =
    lang === 'ar'
      ? settings?.storeNameAr || 'الشمالي شوب'
      : settings?.storeNameEn || 'CHAMALI SHOP';

  return (
    <div className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-sm border-b border-[#E6E2D8]">
      {announcement && (
        <div
          className="h-8 flex items-center justify-center px-4 text-xs text-white truncate"
          style={{ backgroundColor: settings?.primaryColor || '#141413' }}
        >
          <span className="truncate">{announcement}</span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 -ms-2 text-[#141413] hover:opacity-70 focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#141413] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {brandName}
          </button>
        </div>

        {/* Zone 2: 4–5 Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#524E48]">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navHome}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('/');
              onFilterSelect?.('all');
              setTimeout(() => {
                document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
              }, 60);
            }}
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navCollection}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('/');
              onFilterSelect?.('sale');
              setTimeout(() => {
                document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
              }, 60);
            }}
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navSale}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/track')}
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navTrack}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navAdmin}
          </button>
        </nav>

        {/* Zone 3: Compact Utility & Bag Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="p-2 text-[#141413] hover:bg-[#EFECE5] rounded-lg transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => onChangeLang(e.target.value as Language)}
            className="bg-transparent border border-[#DCD6CA] rounded-lg px-2 py-1.5 text-xs font-medium text-[#141413] focus:outline-none focus:border-[#141413] cursor-pointer"
          >
            <option value="ar">العربية</option>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white rounded-lg transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
            style={{ backgroundColor: settings?.primaryColor || '#141413' }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t.bag}</span>
            <span className="tabular-nums font-mono-tabular">({cartCount})</span>
          </button>
        </div>
      </header>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-[#E6E2D8] bg-white px-4 sm:px-8 py-3">
          <div className="max-w-[1360px] mx-auto flex items-center gap-3">
            <Search className="w-4 h-4 text-[#7A746B] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onNavigate('/');
              }}
              placeholder={t.searchPlaceholder}
              autoFocus
              className="w-full bg-transparent text-sm text-[#141413] placeholder:text-[#8E877D] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-xs text-[#7A746B] hover:text-[#141413] px-2 py-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="w-72 h-full bg-[#FAF9F6] p-6 flex flex-col justify-between border-e border-[#E6E2D8]"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E6E2D8]">
                <span className="font-display text-xl font-semibold">{brandName}</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-[#141413]"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-6 flex flex-col gap-4 text-base font-medium text-[#141413]">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/');
                    setMobileMenuOpen(false);
                  }}
                  className="text-start py-2 border-b border-[#EFECE5]"
                >
                  {t.navHome}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/');
                    onFilterSelect?.('all');
                    setMobileMenuOpen(false);
                  }}
                  className="text-start py-2 border-b border-[#EFECE5]"
                >
                  {t.navCollection}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/');
                    onFilterSelect?.('sale');
                    setMobileMenuOpen(false);
                  }}
                  className="text-start py-2 border-b border-[#EFECE5]"
                >
                  {t.navSale}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/track');
                    setMobileMenuOpen(false);
                  }}
                  className="text-start py-2 border-b border-[#EFECE5]"
                >
                  {t.navTrack}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/admin');
                    setMobileMenuOpen(false);
                  }}
                  className="text-start py-2 text-[#9A7B4F]"
                >
                  {t.navAdmin}
                </button>
              </nav>
            </div>
            <p className="text-xs text-[#7A746B]">
              {settings?.phone} · {settings?.email}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
