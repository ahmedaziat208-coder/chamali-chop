import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Roles
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // 'super_admin' | 'admin' | 'staff' | 'customer'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Users (Linked to Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  roleId: integer('role_id')
    .references(() => roles.id)
    .notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Categories (Hierarchical: main & subcategories)
export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameFr: text('name_fr').notNull(),
    nameEn: text('name_en').notNull(),
    parentId: integer('parent_id'),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('categories_parent_idx').on(table.parentId)]
);

// 4. Products
export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    sku: text('sku').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameFr: text('name_fr').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionAr: text('description_ar').notNull(),
    descriptionFr: text('description_fr').notNull(),
    descriptionEn: text('description_en').notNull(),
    categoryId: integer('category_id')
      .references(() => categories.id)
      .notNull(),
    subcategoryId: integer('subcategory_id').references(() => categories.id),
    originalPrice: numeric('original_price', { precision: 10, scale: 2 }).notNull(),
    salePrice: numeric('sale_price', { precision: 10, scale: 2 }),
    discountPercent: integer('discount_percent').default(0).notNull(),
    status: text('status').default('active').notNull(), // 'active' | 'draft' | 'archived'
    isFeatured: boolean('is_featured').default(false).notNull(),
    isNewArrival: boolean('is_new_arrival').default(false).notNull(),
    isBestSeller: boolean('is_best_seller').default(false).notNull(),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    relatedProductIds: jsonb('related_product_ids').$type<number[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('products_category_idx').on(table.categoryId),
    index('products_status_idx').on(table.status),
  ]
);

// 5. Product Images
export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    url: text('url').notNull(),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (table) => [index('product_images_product_idx').on(table.productId)]
);

// 6. Product Variants (Color + Size combinations)
export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    colorNameAr: text('color_name_ar').notNull(),
    colorNameFr: text('color_name_fr').notNull(),
    colorNameEn: text('color_name_en').notNull(),
    colorHex: text('color_hex').default('#141413').notNull(),
    size: text('size').notNull(),
    skuSuffix: text('sku_suffix').notNull(),
    priceOverride: numeric('price_override', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    index('variants_product_idx').on(table.productId),
    uniqueIndex('variants_product_color_size_uidx').on(
      table.productId,
      table.colorNameEn,
      table.size
    ),
  ]
);

// 7. Inventory (Per-variant stock)
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  variantId: integer('variant_id')
    .references(() => productVariants.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  quantity: integer('quantity').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(3).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Inventory Movements (Audit trail for stock in/out)
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial('id').primaryKey(),
    variantId: integer('variant_id')
      .references(() => productVariants.id, { onDelete: 'cascade' })
      .notNull(),
    changeAmount: integer('change_amount').notNull(),
    reason: text('reason').notNull(),
    referenceType: text('reference_type'), // 'order' | 'manual' | 'return' | 'restock'
    referenceId: text('reference_id'),
    createdByUid: text('created_by_uid'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('inv_movements_variant_idx').on(table.variantId)]
);

// 9. Customers
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  city: text('city').notNull(),
  address: text('address').notNull(),
  email: text('email'),
  totalOrders: integer('total_orders').default(0).notNull(),
  totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Shipping Zones (Moroccan Cities)
export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  cityNameAr: text('city_name_ar').notNull(),
  cityNameFr: text('city_name_fr').notNull(),
  cityNameEn: text('city_name_en').notNull().unique(),
  shippingFee: numeric('shipping_fee', { precision: 10, scale: 2 }).notNull(),
  estimatedDays: text('estimated_days').notNull(), // e.g. '24-48h'
  freeShippingThreshold: numeric('free_shipping_threshold', { precision: 10, scale: 2 }),
  carrierName: text('carrier_name').default('Amana / Chamali Express').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// 11. Coupons
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountType: text('discount_type').notNull(), // 'percent' | 'fixed'
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').default(0).notNull(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Orders
export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    customerId: integer('customer_id')
      .references(() => customers.id)
      .notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    notes: text('notes'),
    paymentMethod: text('payment_method').default('cod').notNull(), // 'cod' | 'card'
    status: text('status').default('new').notNull(), // 'new' | 'pending_confirmation' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    shippingFee: numeric('shipping_fee', { precision: 10, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    couponCode: text('coupon_code'),
    source: text('source').default('web').notNull(), // 'web' | 'whatsapp' | 'whatsapp_ai'
    idempotencyKey: text('idempotency_key').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_customer_idx').on(table.customerId),
    index('orders_status_idx').on(table.status),
    index('orders_phone_idx').on(table.customerPhone),
  ]
);

// 13. Order Items
export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id)
      .notNull(),
    variantId: integer('variant_id')
      .references(() => productVariants.id)
      .notNull(),
    productName: text('product_name').notNull(),
    colorName: text('color_name').notNull(),
    size: text('size').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    quantity: integer('quantity').notNull(),
    totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index('order_items_order_idx').on(table.orderId)]
);

// 14. WhatsApp Conversations
export const whatsappConversations = pgTable('whatsapp_conversations', {
  id: serial('id').primaryKey(),
  waPhone: text('wa_phone').notNull().unique(),
  customerName: text('customer_name'),
  language: text('language').default('ar').notNull(),
  aiEnabled: boolean('ai_enabled').default(true).notNull(),
  status: text('status').default('open').notNull(), // 'open' | 'human_handoff' | 'closed'
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. WhatsApp Messages
export const whatsappMessages = pgTable(
  'whatsapp_messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => whatsappConversations.id, { onDelete: 'cascade' })
      .notNull(),
    waMessageId: text('wa_message_id'),
    direction: text('direction').notNull(), // 'inbound' | 'outbound'
    senderType: text('sender_type').notNull(), // 'customer' | 'ai' | 'admin' | 'system'
    messageType: text('message_type').default('text').notNull(), // 'text' | 'image' | 'template'
    body: text('body').notNull(),
    mediaUrl: text('media_url'),
    deliveryStatus: text('delivery_status').default('sent').notNull(), // 'received' | 'sent' | 'delivered' | 'read' | 'failed'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('wa_messages_conv_idx').on(table.conversationId)]
);

// 16. WhatsApp Webhook Events
export const whatsappWebhookEvents = pgTable('whatsapp_webhook_events', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  payloadJson: jsonb('payload_json').notNull(),
  signatureValid: boolean('signature_valid').default(false).notNull(),
  processed: boolean('processed').default(false).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. WhatsApp Notification Templates
export const whatsappTemplates = pgTable('whatsapp_templates', {
  id: serial('id').primaryKey(),
  eventKey: text('event_key').notNull().unique(), // 'order_confirmed' | 'order_preparing' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  metaTemplateName: text('meta_template_name').notNull(),
  languageCode: text('language_code').default('ar').notNull(),
  bodyAr: text('body_ar').notNull(),
  bodyFr: text('body_fr').notNull(),
  bodyEn: text('body_en').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 18. Store Settings
export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  storeNameAr: text('store_name_ar').default('الشمالي شوب').notNull(),
  storeNameEn: text('store_name_en').default('CHAMALI SHOP').notNull(),
  taglineAr: text('tagline_ar').default('دار الأزياء المغربية المعاصرة').notNull(),
  taglineFr: text('tagline_fr').default('Maison de Mode Marocaine Contemporaine').notNull(),
  taglineEn: text('tagline_en').default('Contemporary Moroccan Fashion House').notNull(),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#141413').notNull(),
  accentColor: text('accent_color').default('#9A7B4F').notNull(),
  phone: text('phone').default('+212 600 000 000').notNull(),
  whatsappNumber: text('whatsapp_number').default('212600000000').notNull(),
  email: text('email').default('contact@chamalishop.ma').notNull(),
  facebookUrl: text('facebook_url').default('https://facebook.com').notNull(),
  instagramUrl: text('instagram_url').default('https://instagram.com').notNull(),
  currency: text('currency').default('MAD').notNull(),
  defaultLanguage: text('default_language').default('ar').notNull(),
  heroTitleAr: text('hero_title_ar').default('أناقة مغربية معاصرة بتوقيع الشمالي شوب').notNull(),
  heroTitleFr: text('hero_title_fr').default('Élégance Marocaine Contemporaine').notNull(),
  heroTitleEn: text('hero_title_en').default('Contemporary Moroccan Craft & Style').notNull(),
  heroSubtitleAr: text('hero_subtitle_ar')
    .default('تشكيلة مختارة من الأحذية الجلدية، الأزياء الراقية، والحقائب المصنوعة بعناية — مع الدفع عند الاستلام في جميع مدن المغرب.')
    .notNull(),
  heroSubtitleFr: text('hero_subtitle_fr')
    .default('Chaussures en cuir, prêt-à-porter et maroquinerie d’exception — Paiement à la livraison partout au Maroc.')
    .notNull(),
  heroSubtitleEn: text('hero_subtitle_en')
    .default('Curated leather footwear, tailored apparel, and signature bags — Cash on Delivery across Morocco.')
    .notNull(),
  heroImageUrl: text('hero_image_url').notNull(),
  heroCtaUrl: text('hero_cta_url').default('#collection').notNull(),
  announcementAr: text('announcement_ar')
    .default('توصيل سريع لجميع مدن المغرب · الدفع عند الاستلام متاح')
    .notNull(),
  announcementFr: text('announcement_fr')
    .default('Livraison rapide partout au Maroc · Paiement à la livraison')
    .notNull(),
  announcementEn: text('announcement_en')
    .default('Fast delivery across Morocco · Cash on Delivery available')
    .notNull(),
  homeSectionOrder: jsonb('home_section_order')
    .$type<string[]>()
    .default(['hero', 'categories', 'collection', 'editorial', 'reviews'])
    .notNull(),
  metaPixelId: text('meta_pixel_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 19. Customer Reviews
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  city: text('city').notNull(),
  rating: integer('rating').default(5).notNull(),
  commentAr: text('comment_ar').notNull(),
  commentFr: text('comment_fr').notNull(),
  commentEn: text('comment_en').notNull(),
  productName: text('product_name').notNull(),
  isApproved: boolean('is_approved').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUid: text('actor_uid'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    detailsJson: jsonb('details_json'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  variants: many(productVariants),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventory: one(inventory, {
    fields: [productVariants.id],
    references: [inventory.variantId],
  }),
  movements: many(inventoryMovements),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const whatsappConversationsRelations = relations(whatsappConversations, ({ many }) => ({
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  conversation: one(whatsappConversations, {
    fields: [whatsappMessages.conversationId],
    references: [whatsappConversations.id],
  }),
}));
