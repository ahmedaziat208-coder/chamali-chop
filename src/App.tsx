import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Star, Truck } from 'lucide-react';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutView } from './components/CheckoutView';
import { OrderTrackingView } from './components/OrderTrackingView';
import { ProductCard } from './components/ProductCard';
import { ProductDetailView } from './components/ProductDetailView';
import { ResilientImage } from './components/ResilientImage';
import { StoreHeader } from './components/StoreHeader';
import { WhatsAppConciergeWidget } from './components/WhatsAppConciergeWidget';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { getText, pickLocalized } from './i18n/translations';
import {
  CartItem,
  Category,
  Language,
  Product,
  Review,
  ShippingZone,
  StoreSettings,
} from './types/store';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [path, setPath] = useState<string>(() => window.location.pathname || '/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [collectionTab, setCollectionTab] = useState<'all' | 'new' | 'best' | 'sale'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [trackInit, setTrackInit] = useState<{ orderNumber?: string; phone?: string }>({});

  const t = getText(lang);

  // Sync RTL / LTR document direction
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Browser back/forward navigation support
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/store/bootstrap');
      if (!res.ok) throw new Error('Failed to load store catalog');
      const data = await res.json();
      setSettings(data.settings || null);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setShippingZones(data.shippingZones || []);
      setReviews(data.reviews || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to store');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Inject Meta Pixel cleanly if configured in Store Settings
  useEffect(() => {
    const pixelId = settings?.metaPixelId?.trim();
    if (!pixelId || (window as unknown as { fbq?: unknown }).fbq) return;
    const script = document.createElement('script');
    script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixelId.replace(/[^0-9]/g, '')}');fbq('track', 'PageView');`;
    document.head.appendChild(script);
  }, [settings?.metaPixelId]);

  const handleAddToCart = (item: CartItem, openDrawer = true) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.variantId === item.variantId);
      if (existing) {
        return prev.map((it) =>
          it.variantId === item.variantId
            ? { ...it, quantity: Math.min(it.maxStock, it.quantity + item.quantity) }
            : it
        );
      }
      return [...prev, item];
    });
    if (openDrawer) setCartOpen(true);
  };

  const handleUpdateQty = (variantId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((it) => it.variantId !== variantId));
    } else {
      setCart((prev) =>
        prev.map((it) =>
          it.variantId === variantId ? { ...it, quantity: Math.min(it.maxStock, qty) } : it
        )
      );
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.categoryId !== activeCategory) return false;
      if (collectionTab === 'new' && !p.isNewArrival) return false;
      if (collectionTab === 'best' && !p.isBestSeller) return false;
      if (collectionTab === 'sale' && !(p.salePrice && p.salePrice < p.originalPrice)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          p.nameAr.toLowerCase().includes(q) ||
          p.nameFr.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [products, activeCategory, collectionTab, searchQuery]);

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="w-7 h-7 animate-spin text-[#141413]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] px-4 text-center gap-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={fetchBootstrap}
          className="px-5 py-2.5 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // Admin Route
  if (path.startsWith('/admin')) {
    return (
      <AdminDashboard
        categories={categories}
        shippingZones={shippingZones}
        settings={settings}
        onRefreshStore={fetchBootstrap}
        onExitAdmin={() => navigate('/')}
      />
    );
  }

  const productMatch = path.match(/^\/product\/([^/?#]+)/);
  const activeProduct = productMatch
    ? products.find((p) => p.slug === decodeURIComponent(productMatch[1]))
    : null;

  const heroTitle =
    lang === 'fr'
      ? settings?.heroTitleFr
      : lang === 'en'
      ? settings?.heroTitleEn
      : settings?.heroTitleAr;
  const heroSubtitle =
    lang === 'fr'
      ? settings?.heroSubtitleFr
      : lang === 'en'
      ? settings?.heroSubtitleEn
      : settings?.heroSubtitleAr;

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#141413]">
      <StoreHeader
        settings={settings}
        lang={lang}
        onChangeLang={setLang}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNavigate={navigate}
        onFilterSelect={(f) => {
          setActiveCategory('all');
          setCollectionTab(f);
        }}
      />

      <main className="flex-1">
        {productMatch && activeProduct ? (
          <ProductDetailView
            product={activeProduct}
            allProducts={products}
            categories={categories}
            settings={settings}
            lang={lang}
            onBack={() => navigate('/')}
            onSelectProduct={(slug) => navigate(`/product/${slug}`)}
            onAddToCart={handleAddToCart}
            onBuyNow={(item) => {
              handleAddToCart(item, false);
              navigate('/checkout');
            }}
          />
        ) : path === '/checkout' ? (
          <CheckoutView
            items={cart}
            shippingZones={shippingZones}
            lang={lang}
            onBack={() => navigate('/')}
            onOrderSuccess={() => {
              setCart([]);
              fetchBootstrap();
            }}
            onTrackOrder={(orderNumber, phone) => {
              setTrackInit({ orderNumber, phone });
              navigate('/track');
            }}
          />
        ) : path === '/track' ? (
          <OrderTrackingView
            lang={lang}
            initialOrderNumber={trackInit.orderNumber}
            initialPhone={trackInit.phone}
          />
        ) : (
          <>
            {/* 1. Storefront Architectural Split Hero */}
            <section className="max-w-[1360px] mx-auto px-4 sm:px-8 pt-6 pb-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#E6E2D8] rounded-2xl overflow-hidden items-stretch">
                <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between gap-8">
                  <div className="space-y-4">
                    <p className="text-xs font-medium tracking-wide text-[#9A7B4F]">
                      {lang === 'fr'
                        ? settings?.taglineFr
                        : lang === 'en'
                        ? settings?.taglineEn
                        : settings?.taglineAr}
                    </p>
                    <h1
                      className="font-display font-semibold text-[#141413] leading-[1.15]"
                      style={{
                        fontSize: 'clamp(2rem, 3.6vw, 3.25rem)',
                        textWrap: 'balance',
                      }}
                    >
                      {heroTitle}
                    </h1>
                    <p className="text-sm sm:text-base text-[#524E48] leading-relaxed max-w-md">
                      {heroSubtitle}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <a
                      href="#collection"
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById('collection')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-3 px-6 py-3.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: settings?.primaryColor || '#141413' }}
                    >
                      <span>{t.shopCollection}</span>
                      <ArrowIcon className="w-4 h-4" />
                    </a>

                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[#EFECE5] text-xs text-[#524E48]">
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

                <div className="lg:col-span-7 min-h-[320px] lg:min-h-[520px] bg-[#F3F1EC]">
                  <ResilientImage
                    src={settings?.heroImageUrl}
                    alt={heroTitle || 'CHAMALI SHOP'}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </section>

            {/* 2. Categories & Curated Collection Grid */}
            <section id="collection" className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#141413]">
                    {t.navCollection}
                  </h2>
                  <p className="text-xs text-[#7A746B] mt-1">
                    {filteredProducts.length} {lang === 'ar' ? 'منتج متاح' : 'items'}
                  </p>
                </div>

                {/* Segmented Collection Tabs */}
                <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE5] rounded-lg self-start">
                  {(
                    [
                      ['all', t.filterAll],
                      ['new', t.filterNew],
                      ['best', t.filterBest],
                      ['sale', t.filterSale],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCollectionTab(key)}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        collectionTab === key
                          ? 'bg-white text-[#141413] shadow-sm'
                          : 'text-[#524E48] hover:text-[#141413]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter Strip */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-4 mb-6">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-4 py-2 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-[#141413] text-white border-[#141413]'
                      : 'bg-white text-[#524E48] border-[#E6E2D8] hover:border-[#141413]'
                  }`}
                >
                  {t.filterAll}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-white text-[#524E48] border-[#E6E2D8] hover:border-[#141413]'
                    }`}
                  >
                    {pickLocalized(cat, lang)}
                  </button>
                ))}
              </div>

              {/* 3-Column Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    category={categories.find((c) => c.id === product.categoryId)}
                    lang={lang}
                    onSelect={(slug) => navigate(`/product/${slug}`)}
                  />
                ))}
              </div>
            </section>

            {/* 3. Craftsmanship & Verified Client Reviews */}
            <section className="max-w-[1360px] mx-auto px-4 sm:px-8 py-14 border-t border-[#E6E2D8]">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#141413]">
                    {t.craftTitle}
                  </h2>
                  <p className="text-sm text-[#524E48] leading-relaxed">{t.craftBody}</p>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {reviews.map((rev) => {
                    const comment =
                      lang === 'fr'
                        ? rev.commentFr
                        : lang === 'en'
                        ? rev.commentEn
                        : rev.commentAr;
                    return (
                      <div
                        key={rev.id}
                        className="bg-white border border-[#E6E2D8] rounded-xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-0.5 text-[#9A7B4F]">
                            {Array.from({ length: rev.rating }).map((_, idx) => (
                              <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                            ))}
                          </div>
                          <p className="text-xs leading-relaxed text-[#524E48]">{comment}</p>
                        </div>
                        <div className="pt-3 border-t border-[#EFECE5] text-xs">
                          <p className="font-semibold text-[#141413]">{rev.customerName}</p>
                          <p className="text-[#7A746B]">
                            {rev.city} · {rev.productName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="bg-white border-t border-[#E6E2D8] mt-12 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-xs text-[#524E48]">
          <div className="space-y-2">
            <p className="font-display text-lg font-semibold text-[#141413]">
              {settings?.storeNameAr || 'الشمالي شوب'} · {settings?.storeNameEn || 'CHAMALI SHOP'}
            </p>
            <p>{lang === 'fr' ? settings?.taglineFr : lang === 'en' ? settings?.taglineEn : settings?.taglineAr}</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-[#141413]">التواصل والمبيعات</p>
            <p dir="ltr" className="font-mono-tabular">{settings?.phone}</p>
            <p>{settings?.email}</p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-[#141413]">روابط المتجر</p>
            <div className="flex flex-wrap gap-4">
              <a
                href={settings?.instagramUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#141413] underline-offset-4 hover:underline"
              >
                Instagram
              </a>
              <a
                href={settings?.facebookUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#141413] underline-offset-4 hover:underline"
              >
                Facebook
              </a>
              <button
                type="button"
                onClick={() => navigate('/track')}
                className="hover:text-[#141413] cursor-pointer"
              >
                {t.navTrack}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="hover:text-[#141413] cursor-pointer"
              >
                {t.navAdmin}
              </button>
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        items={cart}
        lang={lang}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemove={(variantId) =>
          setCart((prev) => prev.filter((it) => it.variantId !== variantId))
        }
        onCheckout={() => {
          setCartOpen(false);
          navigate('/checkout');
        }}
      />

      <WhatsAppConciergeWidget settings={settings} lang={lang} />
    </div>
  );
}
