import { useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Category, ShippingZone, StoreSettings } from '../../types/store';

interface AdminOperationsPanelProps {
  section:
    | 'categories'
    | 'customers'
    | 'inventory'
    | 'shipping'
    | 'coupons'
    | 'settings'
    | 'reports';
  token: string;
  categories: Category[];
  shippingZones: ShippingZone[];
  settings: StoreSettings | null;
  onRefreshStore: () => Promise<void>;
}

export function AdminOperationsPanel({
  section,
  token,
  categories,
  shippingZones,
  settings,
  onRefreshStore,
}: AdminOperationsPanelProps) {
  // Categories state
  const [catNameAr, setCatNameAr] = useState('');
  const [catNameFr, setCatNameFr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catSlug, setCatSlug] = useState('');

  // Customers state
  const [customers, setCustomers] = useState<
    Array<{ id: number; fullName: string; phone: string; city: string; totalOrders: number; totalSpent: number }>
  >([]);

  // Inventory state
  const [invData, setInvData] = useState<{
    stock: Array<{
      variantId: number;
      sku: string;
      productNameAr: string;
      colorNameAr: string;
      size: string;
      quantity: number;
    }>;
    movements: Array<{ id: number; variantId: number; changeAmount: number; reason: string; createdAt: string }>;
  }>({ stock: [], movements: [] });
  const [adjustQty, setAdjustQty] = useState<Record<number, string>>({});

  // Coupons state
  const [coupons, setCoupons] = useState<
    Array<{ id: number; code: string; discountType: string; discountValue: string; usedCount: number; isActive: boolean }>
  >([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponValue, setCouponValue] = useState('15');
  const [couponType, setCouponType] = useState<'percent' | 'fixed'>('percent');

  // Shipping zone create state
  const [cityAr, setCityAr] = useState('');
  const [cityEn, setCityEn] = useState('');
  const [cityFee, setCityFee] = useState('35');
  const [cityDays, setCityDays] = useState('24-48h');

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<StoreSettings | null>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<
    Array<{ id: number; actorEmail: string | null; action: string; entityType: string; createdAt: string }>
  >([]);

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    if (section === 'customers') {
      fetch('/api/admin/customers', { headers })
        .then((r) => r.json())
        .then(setCustomers);
    } else if (section === 'inventory') {
      fetch('/api/admin/inventory', { headers })
        .then((r) => r.json())
        .then(setInvData);
    } else if (section === 'coupons') {
      fetch('/api/admin/coupons', { headers })
        .then((r) => r.json())
        .then(setCoupons);
    } else if (section === 'reports') {
      fetch('/api/admin/audit-logs', { headers })
        .then((r) => r.json())
        .then(setAuditLogs);
    }
  }, [section, token]);

  if (section === 'categories') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">إدارة التصنيفات</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await fetch('/api/admin/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                slug: catSlug || `cat-${Date.now()}`,
                nameAr: catNameAr,
                nameFr: catNameFr || catNameAr,
                nameEn: catNameEn || catNameAr,
                sortOrder: categories.length + 1,
                isActive: true,
              }),
            });
            setCatNameAr('');
            setCatNameFr('');
            setCatNameEn('');
            setCatSlug('');
            await onRefreshStore();
          }}
          className="bg-white border border-[#E6E2D8] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3"
        >
          <input
            required
            placeholder="الاسم بالعربية"
            value={catNameAr}
            onChange={(e) => setCatNameAr(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
          />
          <input
            placeholder="Nom (FR)"
            value={catNameFr}
            onChange={(e) => setCatNameFr(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
          />
          <input
            placeholder="Name (EN)"
            value={catNameEn}
            onChange={(e) => setCatNameEn(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
          />
          <input
            required
            placeholder="slug (ex: perfumes)"
            value={catSlug}
            onChange={(e) => setCatSlug(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs font-mono-tabular"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة</span>
          </button>
        </form>

        <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
              <tr>
                <th className="py-3 px-4 text-start">العربية</th>
                <th className="py-3 px-4 text-start">الفرنسية</th>
                <th className="py-3 px-4 text-start">Slug</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-medium">{c.nameAr}</td>
                  <td className="py-3 px-4 text-xs text-[#524E48]">{c.nameFr}</td>
                  <td className="py-3 px-4 font-mono-tabular text-xs text-[#7A746B]">{c.slug}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'customers') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">إدارة الزبائن</h2>
        <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
              <tr>
                <th className="py-3 px-4 text-start">الاسم</th>
                <th className="py-3 px-4 text-start">الهاتف</th>
                <th className="py-3 px-4 text-start">المدينة</th>
                <th className="py-3 px-4 text-end">عدد الطلبات</th>
                <th className="py-3 px-4 text-end">إجمالي الإنفاق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-medium">{c.fullName}</td>
                  <td className="py-3 px-4 font-mono-tabular text-xs">{c.phone}</td>
                  <td className="py-3 px-4 text-xs">{c.city}</td>
                  <td className="py-3 px-4 text-end tabular-nums">{c.totalOrders}</td>
                  <td className="py-3 px-4 text-end tabular-nums font-semibold">
                    {c.totalSpent.toFixed(0)} MAD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'inventory') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">إدارة المخزون وحركات الدخول والخروج</h2>
        <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
              <tr>
                <th className="py-3 px-4 text-start">المنتج</th>
                <th className="py-3 px-4 text-start">اللون / المقاس</th>
                <th className="py-3 px-4 text-end">الكمية الحالية</th>
                <th className="py-3 px-4 text-end">تعديل المخزون (+/-)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {invData.stock.map((row) => (
                <tr key={row.variantId}>
                  <td className="py-3 px-4 font-medium">{row.productNameAr}</td>
                  <td className="py-3 px-4 text-xs">
                    {row.colorNameAr} · {row.size}
                  </td>
                  <td className="py-3 px-4 text-end tabular-nums font-semibold">
                    <span className={row.quantity <= 3 ? 'text-red-700' : ''}>{row.quantity}</span>
                  </td>
                  <td className="py-3 px-4 text-end">
                    <div className="inline-flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="+5"
                        value={adjustQty[row.variantId] || ''}
                        onChange={(e) =>
                          setAdjustQty((prev) => ({ ...prev, [row.variantId]: e.target.value }))
                        }
                        className="w-20 px-2 py-1 border border-[#DCD6CA] rounded text-xs tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const delta = Number(adjustQty[row.variantId] || 0);
                          if (!delta) return;
                          await fetch('/api/admin/inventory/adjust', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              variantId: row.variantId,
                              changeAmount: delta,
                              reason: 'Manual admin stock adjustment',
                            }),
                          });
                          const refreshed = await fetch('/api/admin/inventory', {
                            headers: { Authorization: `Bearer ${token}` },
                          }).then((r) => r.json());
                          setInvData(refreshed);
                          await onRefreshStore();
                        }}
                        className="px-3 py-1 rounded bg-[#141413] text-white text-xs cursor-pointer"
                      >
                        تطبيق
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'shipping') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">إدارة التوصيل داخل المغرب</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await fetch('/api/admin/shipping-zones', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                cityNameAr: cityAr,
                cityNameFr: cityEn || cityAr,
                cityNameEn: cityEn || cityAr,
                shippingFee: Number(cityFee),
                estimatedDays: cityDays,
                freeShippingThreshold: 700,
              }),
            });
            setCityAr('');
            setCityEn('');
            await onRefreshStore();
          }}
          className="bg-white border border-[#E6E2D8] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3"
        >
          <input
            required
            placeholder="المدينة بالعربية"
            value={cityAr}
            onChange={(e) => setCityAr(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
          />
          <input
            required
            placeholder="City (EN/FR)"
            value={cityEn}
            onChange={(e) => setCityEn(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
          />
          <input
            required
            type="number"
            placeholder="السعر MAD"
            value={cityFee}
            onChange={(e) => setCityFee(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs tabular-nums"
          />
          <input
            required
            placeholder="المدة (24-48h)"
            value={cityDays}
            onChange={(e) => setCityDays(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
          >
            إضافة مدينة
          </button>
        </form>

        <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
              <tr>
                <th className="py-3 px-4 text-start">المدينة</th>
                <th className="py-3 px-4 text-end">سعر التوصيل</th>
                <th className="py-3 px-4 text-start">المدة</th>
                <th className="py-3 px-4 text-end">توصيل مجاني فوق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {shippingZones.map((z) => (
                <tr key={z.id}>
                  <td className="py-3 px-4 font-medium">{z.cityNameAr}</td>
                  <td className="py-3 px-4 text-end tabular-nums">{z.shippingFee} MAD</td>
                  <td className="py-3 px-4 text-xs">{z.estimatedDays}</td>
                  <td className="py-3 px-4 text-end tabular-nums">
                    {z.freeShippingThreshold ? `${z.freeShippingThreshold} MAD` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'coupons') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">إدارة الكوبونات والعروض</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await fetch('/api/admin/coupons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                code: couponCode,
                discountType: couponType,
                discountValue: Number(couponValue),
                minOrderAmount: 150,
              }),
            });
            setCouponCode('');
            const list = await fetch('/api/admin/coupons', {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json());
            setCoupons(list);
          }}
          className="bg-white border border-[#E6E2D8] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            required
            placeholder="كود التخفيض (CHAMALI20)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs uppercase font-mono-tabular"
          />
          <select
            value={couponType}
            onChange={(e) => setCouponType(e.target.value as 'percent' | 'fixed')}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs bg-white"
          >
            <option value="percent">نسبة مئوية (%)</option>
            <option value="fixed">مبلغ ثابت (MAD)</option>
          </select>
          <input
            required
            type="number"
            value={couponValue}
            onChange={(e) => setCouponValue(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs tabular-nums"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
          >
            إنشاء كوبون
          </button>
        </form>

        <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
              <tr>
                <th className="py-3 px-4 text-start">الكود</th>
                <th className="py-3 px-4 text-start">النوع</th>
                <th className="py-3 px-4 text-end">القيمة</th>
                <th className="py-3 px-4 text-end">الاستخدامات</th>
                <th className="py-3 px-4 text-end">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-mono-tabular font-semibold">{c.code}</td>
                  <td className="py-3 px-4 text-xs">{c.discountType}</td>
                  <td className="py-3 px-4 text-end tabular-nums">{c.discountValue}</td>
                  <td className="py-3 px-4 text-end tabular-nums">{c.usedCount}</td>
                  <td className="py-3 px-4 text-end">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/coupons/${c.id}/toggle`, {
                          method: 'PATCH',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const list = await fetch('/api/admin/coupons', {
                          headers: { Authorization: `Bearer ${token}` },
                        }).then((r) => r.json());
                        setCoupons(list);
                      }}
                      className="text-xs font-medium text-[#9A7B4F] cursor-pointer"
                    >
                      {c.isActive ? 'نشط (تعطيل)' : 'معطل (تفعيل)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'settings' && settingsDraft) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSettingsSaved(false);
          const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(settingsDraft),
          });
          if (res.ok) {
            setSettingsSaved(true);
            await onRefreshStore();
          }
        }}
        className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-5"
      >
        <h2 className="text-lg font-semibold">إعدادات الهوية والبنرات والتسويق</h2>
        {settingsSaved && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            تم حفظ إعدادات المتجر وتحديث الواجهة فوراً.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">اسم المتجر بالعربية</label>
            <input
              value={settingsDraft.storeNameAr}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, storeNameAr: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Store Name (EN)</label>
            <input
              value={settingsDraft.storeNameEn}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, storeNameEn: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">رقم WhatsApp Business</label>
            <input
              dir="ltr"
              value={settingsDraft.whatsappNumber}
              onChange={(e) =>
                setSettingsDraft({ ...settingsDraft, whatsappNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm font-mono-tabular"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">عنوان البانر الرئيسي (AR)</label>
            <input
              value={settingsDraft.heroTitleAr}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, heroTitleAr: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">رابط صورة البانر الرئيسي</label>
            <input
              dir="ltr"
              value={settingsDraft.heroImageUrl}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, heroImageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs font-mono-tabular"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">اللون الأساسي</label>
            <input
              type="color"
              value={settingsDraft.primaryColor}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, primaryColor: e.target.value })}
              className="w-full h-10 rounded cursor-pointer border border-[#DCD6CA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">لون التمييز</label>
            <input
              type="color"
              value={settingsDraft.accentColor}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, accentColor: e.target.value })}
              className="w-full h-10 rounded cursor-pointer border border-[#DCD6CA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Meta Pixel ID</label>
            <input
              dir="ltr"
              placeholder="1234567890"
              value={settingsDraft.metaPixelId || ''}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, metaPixelId: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Meta Catalog Feed</label>
            <a
              href="/api/feeds/meta-catalog.csv"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs text-[#9A7B4F] truncate"
            >
              /api/feeds/meta-catalog.csv
            </a>
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
        >
          حفظ إعدادات المتجر
        </button>
      </form>
    );
  }

  // Reports, Database Backup & Audit Logs
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">التقارير والنسخ الاحتياطي وسجل الأمان</h2>
        <button
          type="button"
          onClick={async () => {
            const res = await fetch('/api/admin/backup/export', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chamali-shop-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>تصدير نسخة احتياطية كاملة (JSON)</span>
        </button>
      </div>

      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto">
        <div className="p-4 border-b border-[#E6E2D8] text-xs font-semibold">
          سجل العمليات الإدارية والأمنية (Audit Logs)
        </div>
        <table className="w-full text-xs">
          <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-[#7A746B]">
            <tr>
              <th className="py-2.5 px-4 text-start">العملية</th>
              <th className="py-2.5 px-4 text-start">الكيان</th>
              <th className="py-2.5 px-4 text-start">المسؤول</th>
              <th className="py-2.5 px-4 text-end">التوقيت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE5]">
            {auditLogs.map((l) => (
              <tr key={l.id}>
                <td className="py-2.5 px-4 font-mono-tabular font-medium">{l.action}</td>
                <td className="py-2.5 px-4">{l.entityType}</td>
                <td className="py-2.5 px-4 text-[#524E48]">{l.actorEmail || 'system'}</td>
                <td className="py-2.5 px-4 text-end font-mono-tabular text-[#7A746B]">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
