import { useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { OrderRecord } from '../../types/store';

interface AdminOrdersPanelProps {
  token: string;
  orders: OrderRecord[];
  onRefresh: () => Promise<void>;
}

const ORDER_STATUSES = [
  { value: 'new', label: 'جديد' },
  { value: 'pending_confirmation', label: 'قيد التأكيد' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'preparing', label: 'قيد التجهيز' },
  { value: 'shipped', label: 'تم الشحن' },
  { value: 'delivered', label: 'تم التسليم' },
  { value: 'cancelled', label: 'ملغى' },
];

export function AdminOrdersPanel({ token, orders, onRefresh }: AdminOrdersPanelProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.city.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const handleStatusChange = async (orderId: number, status: string) => {
    setUpdatingId(orderId);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, notifyWhatsapp: true }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefresh();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
        }
        if (data.whatsappNotice?.cloudApiDelivered) {
          setNotice('تم تحديث الحالة وإرسال إشعار WhatsApp للزبون.');
        } else if (data.whatsappNotice) {
          setNotice('تم تحديث الحالة وحفظ الإشعار في سجل المحادثات.');
        }
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <h2 className="text-lg font-semibold text-[#141413]">إدارة الطلبات والفواتير</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7A746B] absolute top-2.5 start-3" />
            <input
              type="text"
              placeholder="بحث برقم الطلب أو الهاتف..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ps-9 pe-3 py-2 border border-[#DCD6CA] rounded-lg text-xs bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs bg-white"
          >
            <option value="all">جميع الحالات</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 no-print">
          {notice}
        </div>
      )}

      {selectedOrder && (
        <div className="bg-white border border-[#DCD6CA] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EFECE5] pb-3">
            <div>
              <h3 className="text-base font-semibold text-[#141413]">
                فاتورة الطلب #{selectedOrder.orderNumber}
              </h3>
              <p className="text-xs text-[#7A746B]">
                الشمالي شوب – CHAMALI SHOP · {new Date(selectedOrder.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#141413] text-xs font-medium cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الفاتورة</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 text-xs text-[#7A746B] hover:text-[#141413] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-[#7A746B]">الزبون</p>
              <p className="font-semibold text-[#141413] mt-0.5">{selectedOrder.customerName}</p>
              <p className="font-mono-tabular text-[#524E48]">{selectedOrder.customerPhone}</p>
            </div>
            <div>
              <p className="text-[#7A746B]">العنوان</p>
              <p className="font-medium text-[#141413] mt-0.5">{selectedOrder.city}</p>
              <p className="text-[#524E48]">{selectedOrder.address}</p>
            </div>
            <div>
              <p className="text-[#7A746B]">الدفع والمصدر</p>
              <p className="font-medium text-[#141413] mt-0.5">
                الدفع عند الاستلام (COD) · {selectedOrder.source}
              </p>
              {selectedOrder.notes && <p className="text-[#524E48]">ملاحظة: {selectedOrder.notes}</p>}
            </div>
          </div>

          <table className="w-full text-xs border-t border-[#EFECE5]">
            <thead>
              <tr className="text-[#7A746B] border-b border-[#EFECE5]">
                <th className="py-2 text-start">المنتج</th>
                <th className="py-2 text-start">اللون / المقاس</th>
                <th className="py-2 text-end">الكمية</th>
                <th className="py-2 text-end">السعر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {selectedOrder.items?.map((it) => (
                <tr key={it.id}>
                  <td className="py-2 font-medium">{it.productName}</td>
                  <td className="py-2">
                    {it.colorName} / {it.size}
                  </td>
                  <td className="py-2 text-end tabular-nums">{it.quantity}</td>
                  <td className="py-2 text-end tabular-nums">{Number(it.totalPrice).toFixed(0)} MAD</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end text-sm font-semibold border-t border-[#E6E2D8] pt-3 tabular-nums">
            المجموع النهائي (مع التوصيل {selectedOrder.shippingFee} MAD): {selectedOrder.totalAmount} MAD
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto no-print">
        <table className="w-full text-sm text-start">
          <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
            <tr>
              <th className="py-3 px-4 text-start">رقم الطلب</th>
              <th className="py-3 px-4 text-start">الزبون</th>
              <th className="py-3 px-4 text-start">المدينة</th>
              <th className="py-3 px-4 text-end">المجموع</th>
              <th className="py-3 px-4 text-start">المصدر</th>
              <th className="py-3 px-4 text-start">الحالة</th>
              <th className="py-3 px-4 text-end">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE5]">
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-[#FAF9F6]/60">
                <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">{o.orderNumber}</td>
                <td className="py-3 px-4">
                  <div className="font-medium text-[#141413]">{o.customerName}</div>
                  <div className="font-mono-tabular text-xs text-[#7A746B]">{o.customerPhone}</div>
                </td>
                <td className="py-3 px-4 text-xs">{o.city}</td>
                <td className="py-3 px-4 text-end tabular-nums font-semibold">
                  {o.totalAmount.toFixed(0)} MAD
                </td>
                <td className="py-3 px-4 text-xs text-[#7A746B]">{o.source}</td>
                <td className="py-3 px-4">
                  <select
                    disabled={updatingId === o.id}
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    className="px-2.5 py-1.5 border border-[#DCD6CA] rounded-lg text-xs bg-white"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4 text-end">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(o)}
                    className="text-xs font-medium text-[#9A7B4F] hover:underline cursor-pointer"
                  >
                    عرض / طباعة
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
