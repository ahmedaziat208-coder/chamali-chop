export type Language = 'ar' | 'fr' | 'en';

export interface StoreSettings {
  id: number;
  storeNameAr: string;
  storeNameEn: string;
  taglineAr: string;
  taglineFr: string;
  taglineEn: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  facebookUrl: string;
  instagramUrl: string;
  currency: string;
  defaultLanguage: string;
  heroTitleAr: string;
  heroTitleFr: string;
  heroTitleEn: string;
  heroSubtitleAr: string;
  heroSubtitleFr: string;
  heroSubtitleEn: string;
  heroImageUrl: string;
  heroCtaUrl: string;
  announcementAr: string;
  announcementFr: string;
  announcementEn: string;
  homeSectionOrder: string[];
  metaPixelId: string | null;
}

export interface Category {
  id: number;
  slug: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  parentId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: number;
  productId: number;
  colorNameAr: string;
  colorNameFr: string;
  colorNameEn: string;
  colorHex: string;
  size: string;
  skuSuffix: string;
  priceOverride: string | null;
  isActive: boolean;
  quantity: number;
  lowStockThreshold?: number;
}

export interface Product {
  id: number;
  slug: string;
  sku: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEn: string;
  categoryId: number;
  subcategoryId: number | null;
  originalPrice: number;
  salePrice: number | null;
  discountPercent: number;
  status: 'active' | 'draft' | 'archived';
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  relatedProductIds: number[];
  images: ProductImage[];
  variants: ProductVariant[];
  totalStock: number;
}

export interface ShippingZone {
  id: number;
  cityNameAr: string;
  cityNameFr: string;
  cityNameEn: string;
  shippingFee: number;
  estimatedDays: string;
  freeShippingThreshold: number | null;
  carrierName: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Review {
  id: number;
  customerName: string;
  city: string;
  rating: number;
  commentAr: string;
  commentFr: string;
  commentEn: string;
  productName: string;
}

export interface CartItem {
  productId: number;
  slug: string;
  productNameAr: string;
  productNameFr: string;
  productNameEn: string;
  variantId: number;
  colorNameAr: string;
  colorNameFr: string;
  colorNameEn: string;
  colorHex: string;
  size: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  imageUrl: string;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  notes: string | null;
  paymentMethod: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
  source: string;
  createdAt: string;
  items?: Array<{
    id: number;
    productId: number;
    variantId: number;
    productName: string;
    colorName: string;
    size: string;
    unitPrice: number | string;
    quantity: number;
    totalPrice: number | string;
  }>;
}
