import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  BarChart3,
  Boxes,
  FileBarChart,
  FolderTree,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  Users,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../../lib/firebase';
import { Category, OrderRecord, Product, ShippingZone, StoreSettings } from '../../types/store';
import { AdminOperationsPanel } from './AdminOperationsPanel';
import { AdminOrdersPanel } from './AdminOrdersPanel';
import { AdminProductsPanel } from './AdminProductsPanel';
import { AdminWhatsAppPanel } from './AdminWhatsAppPanel';

interface AdminDashboardProps {
  categories: Category[];
  shippingZones: ShippingZone[];
  settings: StoreSettings | null;
  onRefreshStore: () => Promise<void>;
  onExitAdmin: () => void;
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'whatsapp'
  | 'coupons'
  | 'shipping'
  | 'settings'
  | 'reports';

interface AnalyticsData {
  totalSales: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  productCount: number;
  lowStockCount: number;
  lowStockItems: Array<{
    variantId: number;
    quantity: number;
    productName: string;
    colorName: string;
    size: string;
  }>;
  customerCount: number;
  dailyChart: Array<{ date: string; sales: number; orders: number }>;
  topProducts: Array<{ productName: string; qty: number; revenue: number }>;
}

export function AdminDashboard({
  categories,
  shippingZones,
  settings,
  onRefreshStore,
  onExitAdmin,
}: AdminDashboardProps) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canClaimAdmin, setCanClaimAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([]);

  const verifyServerAuth = async (user: User) => {
    try {
      const token = await user.getIdToken();
      setIdToken(token);
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setIsAdmin(Boolean(data.isAdmin));
        setCanClaimAdmin(Boolean(data.canClaimInitialAdmin));
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch {
      setAuthError('Failed to verify session');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (u) {
        verifyServerAuth(u);
      } else {
        setIdToken(null);
        setIsAdmin(false);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const loadAdminData = async () => {
    if (!idToken || !isAdmin) return;
    const headers = { Authorization: `Bearer ${idToken}` };
    const [an, prods, ords] = await Promise.all([
      fetch('/api/admin/analytics', { headers }).then((r) => r.json()),
      fetch('/api/admin/products', { headers }).then((r) => r.json()),
      fetch('/api/admin/orders', { headers }).then((r) => r.json()),
    ]);
    setAnalytics(an);
    setAdminProducts(Array.isArray(prods) ? prods : []);
    setAdminOrders(Array.isArray(ords) ? ords : []);
  };

  useEffect(() => {
    if (idToken && isAdmin) {
      loadAdminData();
    }
  }, [idToken, isAdmin]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
    }
  };

  const handleClaimAdmin = async () => {
    if (!idToken) return;
    const res = await fetch('/api/auth/claim-admin', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok && firebaseUser) {
      await verifyServerAuth(firebaseUser);
    } else {
      const data = await res.json();
      setAuthError(data.error || 'Unable to claim admin role');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#141413]" />
      </div>
    );
  }

  if (!firebaseUser || !isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-[#DCD6CA] rounded-xl p-8 text-center space-y-5">
          <ShieldCheck className="w-10 h-10 mx-auto text-[#9A7B4F]" />
          <h1 className="font-display text-2xl font-semibold text-[#141413]">
            لوحة إدارة الشمالي شوب
          </h1>
          <p className="text-xs text-[#524E48] leading-relaxed">
            الوصول إلى لوحة الإدارة محمي ومقتصر على مسؤولي المتجر المعتمدين فقط.
          </p>

          {authError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {authError}
            </div>
          )}

          {!firebaseUser ? (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-5 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-[#2A2927] cursor-pointer"
            >
              تسجيل الدخول بحساب Google للمسؤول
            </button>
          ) : canClaimAdmin ? (
            <div className="space-y-3">
              <p className="text-xs text-[#141413]">
                مسجل باسم: <span className="font-mono-tabular">{firebaseUser.email}</span>
              </p>
              <button
                type="button"
                onClick={handleClaimAdmin}
                className="w-full py-3 px-5 rounded-lg bg-[#9A7B4F] text-white text-xs font-semibold cursor-pointer"
              >
                تفعيل صلاحية المالك الأول (Super Admin)
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-red-700">
                الحساب ({firebaseUser.email}) لا يملك صلاحية إدارة المتجر.
              </p>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="px-4 py-2 rounded-lg border border-[#DCD6CA] text-xs cursor-pointer"
              >
                تسجيل الخروج
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onExitAdmin}
            className="block mx-auto text-xs text-[#7A746B] hover:text-[#141413] cursor-pointer"
          >
            العودة إلى واجهة المتجر
          </button>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'categories', label: 'التصنيفات', icon: FolderTree },
    { id: 'orders', label: 'الطلبات', icon: ShoppingCart },
    { id: 'inventory', label: 'المخزون', icon: Boxes },
    { id: 'customers', label: 'الزبائن', icon: Users },
    { id: 'whatsapp', label: 'WhatsApp & AI', icon: MessageSquare },
    { id: 'coupons', label: 'العروض والكوبونات', icon: Tag },
    { id: 'shipping', label: 'التوصيل بالمغرب', icon: Truck },
    { id: 'settings', label: 'إعدادات المتجر', icon: Settings },
    { id: 'reports', label: 'التقارير والأمان', icon: FileBarChart },
  ];

  const maxDailySales = Math.max(
    1,
    ...(analytics?.dailyChart.map((d) => d.sales) || [1])
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-e border-[#E6E2D8] p-4 flex flex-col justify-between shrink-0 no-print">
        <div>
          <div className="px-3 py-3 border-b border-[#EFECE5] mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-[#141413]">CHAMALI ADMIN</p>
              <p className="text-[11px] text-[#7A746B] truncate max-w-[160px]">
                {firebaseUser.email}
              </p>
            </div>
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#141413] text-white'
                      : 'text-[#524E48] hover:bg-[#F3F1EC] hover:text-[#141413]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-4 border-t border-[#EFECE5]">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full py-2 px-3 rounded-lg border border-[#DCD6CA] text-xs font-medium text-[#141413] hover:bg-[#F3F1EC] cursor-pointer"
          >
            عرض المتجر
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-[1280px]">
        {tab === 'overview' && analytics && (
          <div className="space-y-8">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#141413]">
              لوحة التحكم والمبيعات
            </h1>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5">
                <p className="text-xs text-[#7A746B]">إجمالي المبيعات</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#141413]">
                  {analytics.totalSales.toFixed(0)} MAD
                </p>
              </div>
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5">
                <p className="text-xs text-[#7A746B]">إجمالي الطلبات</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#141413]">
                  {analytics.totalOrders}
                </p>
                <p className="mt-1 text-xs text-[#524E48] tabular-nums">
                  جديدة: {analytics.statusCounts.new} · مسلمة: {analytics.statusCounts.delivered}
                </p>
              </div>
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5">
                <p className="text-xs text-[#7A746B]">المنتجات / منخفض المخزون</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#141413]">
                  {analytics.productCount}{' '}
                  <span className="text-sm text-amber-700">/ {analytics.lowStockCount} تنبيه</span>
                </p>
              </div>
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5">
                <p className="text-xs text-[#7A746B]">الزبائن المسجلين</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#141413]">
                  {analytics.customerCount}
                </p>
              </div>
            </div>

            {/* Daily Sales Chart + Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-white border border-[#E6E2D8] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#9A7B4F]" />
                    <h3 className="text-sm font-semibold">المبيعات اليومية (آخر 14 يوماً)</h3>
                  </div>
                </div>
                <div className="h-48 flex items-end gap-2">
                  {analytics.dailyChart.map((d) => {
                    const pct = Math.max(4, Math.round((d.sales / maxDailySales) * 100));
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div
                          className="w-full bg-[#141413] group-hover:bg-[#9A7B4F] transition-colors rounded-t"
                          style={{ height: `${pct}%` }}
                          title={`${d.date}: ${d.sales} MAD (${d.orders} orders)`}
                        />
                        <span className="text-[10px] font-mono-tabular text-[#7A746B] -rotate-45 origin-top-left mt-1">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-4 bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">تنبيهات المخزون المنخفض</h3>
                {analytics.lowStockItems.length === 0 ? (
                  <p className="text-xs text-[#7A746B]">جميع المقاسات والألوان متوفرة بمخزون جيد.</p>
                ) : (
                  <div className="space-y-2.5">
                    {analytics.lowStockItems.slice(0, 6).map((item) => (
                      <div
                        key={item.variantId}
                        className="flex items-center justify-between text-xs border-b border-[#EFECE5] pb-2"
                      >
                        <div>
                          <p className="font-medium text-[#141413]">{item.productName}</p>
                          <p className="text-[#7A746B]">
                            {item.colorName} · {item.size}
                          </p>
                        </div>
                        <span className="font-mono-tabular font-semibold text-red-700">
                          {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'products' && idToken && (
          <AdminProductsPanel
            token={idToken}
            products={adminProducts}
            categories={categories}
            onRefresh={async () => {
              await loadAdminData();
              await onRefreshStore();
            }}
          />
        )}

        {tab === 'orders' && idToken && (
          <AdminOrdersPanel
            token={idToken}
            orders={adminOrders}
            onRefresh={async () => {
              await loadAdminData();
            }}
          />
        )}

        {tab === 'whatsapp' && idToken && <AdminWhatsAppPanel token={idToken} />}

        {(tab === 'categories' ||
          tab === 'customers' ||
          tab === 'inventory' ||
          tab === 'shipping' ||
          tab === 'coupons' ||
          tab === 'settings' ||
          tab === 'reports') &&
          idToken && (
            <AdminOperationsPanel
              section={tab}
              token={idToken}
              categories={categories}
              shippingZones={shippingZones}
              settings={settings}
              onRefreshStore={async () => {
                await onRefreshStore();
                await loadAdminData();
              }}
            />
          )}
      </main>
    </div>
  );
}
