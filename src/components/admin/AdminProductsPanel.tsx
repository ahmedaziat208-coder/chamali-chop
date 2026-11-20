import { useState } from 'react';
import { Edit3, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Category, Product } from '../../types/store';
import { ResilientImage } from '../ResilientImage';

interface AdminProductsPanelProps {
  token: string;
  products: Product[];
  categories: Category[];
  onRefresh: () => Promise<void>;
}

interface VariantDraft {
  id?: number;
  colorNameAr: string;
  colorNameFr: string;
  colorNameEn: string;
  colorHex: string;
  size: string;
  skuSuffix: string;
  quantity: number;
}

export function AdminProductsPanel({
  token,
  products,
  categories,
  onRefresh,
}: AdminProductsPanelProps) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [originalPrice, setOriginalPrice] = useState('299');
  const [salePrice, setSalePrice] = useState('');
  const [status, setStatus] = useState<'active' | 'draft' | 'archived'>('active');
  const [isFeatured, setIsFeatured] = useState(true);
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  const openNew = () => {
    setEditing(null);
    setCreating(true);
    setError(null);
    setSlug(`chamali-item-${Date.now().toString().slice(-4)}`);
    setSku(`CHM-${Date.now().toString().slice(-5)}`);
    setNameAr('');
    setNameFr('');
    setNameEn('');
    setDescriptionAr('');
    setDescriptionFr('');
    setDescriptionEn('');
    setCategoryId(categories[0]?.id || 1);
    setOriginalPrice('299');
    setSalePrice('');
    setStatus('active');
    setIsFeatured(true);
    setIsNewArrival(true);
    setIsBestSeller(false);
    setImages(['/src/assets/images/product_leather_sandal_1795208519056.jpg']);
    setVariants([
      {
        colorNameAr: 'أسود',
        colorNameFr: 'Noir',
        colorNameEn: 'Black',
        colorHex: '#141413',
        size: '41',
        skuSuffix: 'BLK-41',
        quantity: 5,
      },
    ]);
  };

  const openEdit = (p: Product) => {
    setCreating(false);
    setEditing(p);
    setError(null);
    setSlug(p.slug);
    setSku(p.sku);
    setNameAr(p.nameAr);
    setNameFr(p.nameFr);
    setNameEn(p.nameEn);
    setDescriptionAr(p.descriptionAr);
    setDescriptionFr(p.descriptionFr);
    setDescriptionEn(p.descriptionEn);
    setCategoryId(p.categoryId);
    setOriginalPrice(String(p.originalPrice));
    setSalePrice(p.salePrice ? String(p.salePrice) : '');
    setStatus(p.status);
    setIsFeatured(p.isFeatured);
    setIsNewArrival(p.isNewArrival);
    setIsBestSeller(p.isBestSeller);
    setImages(p.images.map((i) => i.url));
    setVariants(
      p.variants.map((v) => ({
        id: v.id,
        colorNameAr: v.colorNameAr,
        colorNameFr: v.colorNameFr,
        colorNameEn: v.colorNameEn,
        colorHex: v.colorHex,
        size: v.size,
        skuSuffix: v.skuSuffix,
        quantity: v.quantity,
      }))
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataBase64 = String(reader.result || '');
          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              dataBase64,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Upload failed');
          } else {
            setImages((prev) => [...prev, data.url]);
          }
        } catch {
          setError('Image upload failed');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      slug: slug.trim(),
      sku: sku.trim(),
      nameAr: nameAr.trim(),
      nameFr: nameFr.trim() || nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      descriptionAr: descriptionAr.trim(),
      descriptionFr: descriptionFr.trim() || descriptionAr.trim(),
      descriptionEn: descriptionEn.trim() || descriptionAr.trim(),
      categoryId: Number(categoryId),
      originalPrice: Number(originalPrice),
      salePrice: salePrice ? Number(salePrice) : null,
      status,
      isFeatured,
      isNewArrival,
      isBestSeller,
      images: images.length > 0 ? images : ['/src/assets/images/product_leather_sandal_1795208519056.jpg'],
      variants,
    };

    try {
      const url = editing ? `/api/admin/products/${editing.id}` : '/api/admin/products';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Save failed');
        setSaving(false);
        return;
      }
      setEditing(null);
      setCreating(false);
      await onRefresh();
    } catch {
      setError('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: number) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#141413]">إدارة المنتجات والمقاسات والألوان</h2>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {(creating || editing) && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-[#DCD6CA] rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#EFECE5] pb-3">
            <h3 className="text-sm font-semibold text-[#141413]">
              {editing ? `تعديل: ${editing.nameAr}` : 'منتج جديد'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              className="p-1 text-[#7A746B] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">الاسم بالعربية *</label>
              <input
                required
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nom (FR)</label>
              <input
                value={nameFr}
                onChange={(e) => setNameFr(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Name (EN)</label>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">SKU *</label>
              <input
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Slug *</label>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">التصنيف *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">السعر الأصلي (MAD) *</label>
              <input
                type="number"
                required
                min="1"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">سعر التخفيض (اختياري)</label>
              <input
                type="number"
                min="1"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">الوصف بالعربية *</label>
              <textarea
                required
                rows={2}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description (FR)</label>
              <textarea
                rows={2}
                value={descriptionFr}
                onChange={(e) => setDescriptionFr(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description (EN)</label>
              <textarea
                rows={2}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD6CA] rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isNewArrival}
                onChange={(e) => setIsNewArrival(e.target.checked)}
              />
              <span>منتج جديد</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isBestSeller}
                onChange={(e) => setIsBestSeller(e.target.checked)}
              />
              <span>الأكثر مبيعاً</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span>منتج مقترح بالرئيسية</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'draft' | 'archived')}
              className="px-2.5 py-1 border border-[#DCD6CA] rounded-md bg-white"
            >
              <option value="active">نشط</option>
              <option value="draft">مسودة</option>
              <option value="archived">مؤرشف</option>
            </select>
          </div>

          {/* Images Manager + File Upload */}
          <div className="border-t border-[#EFECE5] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">صور المنتج</span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#141413] text-xs font-medium cursor-pointer hover:bg-[#F3F1EC]">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                <span>رفع صورة من الجهاز</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="أو أضف رابط صورة..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-[#DCD6CA] rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (newImageUrl.trim()) {
                    setImages((prev) => [...prev, newImageUrl.trim()]);
                    setNewImageUrl('');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#EFECE5] text-xs font-medium cursor-pointer"
              >
                إضافة رابط
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {images.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E6E2D8]">
                  <ResilientImage src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 end-1 p-0.5 bg-black/70 text-white rounded-full cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Variants Matrix */}
          <div className="border-t border-[#EFECE5] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">الخيارات (اللون + المقاس + المخزون المستقل)</span>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      colorNameAr: 'أسود',
                      colorNameFr: 'Noir',
                      colorNameEn: 'Black',
                      colorHex: '#141413',
                      size: '42',
                      skuSuffix: `VAR-${prev.length + 1}`,
                      quantity: 5,
                    },
                  ])
                }
                className="px-3 py-1 rounded-lg border border-[#DCD6CA] text-xs font-medium cursor-pointer"
              >
                + إضافة لون / مقاس
              </button>
            </div>
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={idx} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-center bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E6E2D8]">
                  <input
                    placeholder="اللون (AR)"
                    value={v.colorNameAr}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx].colorNameAr = e.target.value;
                      setVariants(next);
                    }}
                    className="px-2 py-1.5 border border-[#DCD6CA] rounded text-xs bg-white"
                  />
                  <input
                    placeholder="Color (EN)"
                    value={v.colorNameEn}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx].colorNameEn = e.target.value;
                      next[idx].colorNameFr = e.target.value;
                      setVariants(next);
                    }}
                    className="px-2 py-1.5 border border-[#DCD6CA] rounded text-xs bg-white"
                  />
                  <input
                    type="color"
                    value={v.colorHex}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx].colorHex = e.target.value;
                      setVariants(next);
                    }}
                    className="h-8 w-full rounded cursor-pointer border border-[#DCD6CA]"
                  />
                  <input
                    placeholder="المقاس"
                    value={v.size}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx].size = e.target.value;
                      setVariants(next);
                    }}
                    className="px-2 py-1.5 border border-[#DCD6CA] rounded text-xs bg-white"
                  />
                  <input
                    placeholder="SKU Suffix"
                    value={v.skuSuffix}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx].skuSuffix = e.target.value;
                      setVariants(next);
                    }}
                    className="px-2 py-1.5 border border-[#DCD6CA] rounded text-xs font-mono-tabular bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="الكمية"
                    value={v.quantity}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx].quantity = Number(e.target.value);
                      setVariants(next);
                    }}
                    className="px-2 py-1.5 border border-[#DCD6CA] rounded text-xs tabular-nums bg-white"
                  />
                  <button
                    type="button"
                    disabled={variants.length <= 1}
                    onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-700 disabled:opacity-30 cursor-pointer justify-self-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ المنتج في قاعدة البيانات'}
            </button>
          </div>
        </form>
      )}

      {/* Products Table */}
      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-start">
          <thead className="bg-[#FAF9F6] border-b border-[#E6E2D8] text-xs text-[#7A746B]">
            <tr>
              <th className="py-3 px-4 text-start">المنتج</th>
              <th className="py-3 px-4 text-start">SKU</th>
              <th className="py-3 px-4 text-end">السعر</th>
              <th className="py-3 px-4 text-end">المخزون الكلي</th>
              <th className="py-3 px-4 text-start">الحالة</th>
              <th className="py-3 px-4 text-end">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE5]">
            {products.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.quantity, 0);
              return (
                <tr key={p.id} className="hover:bg-[#FAF9F6]/60">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F3F1EC] shrink-0">
                        <ResilientImage
                          src={p.images[0]?.url}
                          alt={p.nameAr}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-medium text-[#141413]">{p.nameAr}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-xs text-[#7A746B]">{p.sku}</td>
                  <td className="py-3 px-4 text-end tabular-nums font-medium">
                    {(p.salePrice ?? p.originalPrice).toFixed(0)} MAD
                  </td>
                  <td className="py-3 px-4 text-end tabular-nums">{stock}</td>
                  <td className="py-3 px-4 text-xs">{p.status}</td>
                  <td className="py-3 px-4 text-end">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-[#524E48] hover:text-[#141413] cursor-pointer"
                        title="تعديل"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(p.id)}
                        className="p-1.5 text-[#7A746B] hover:text-red-700 cursor-pointer"
                        title="أرشفة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
