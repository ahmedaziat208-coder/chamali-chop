import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { count, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  auditLogs,
  categories,
  coupons,
  customers,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  reviews,
  roles,
  shippingZones,
  storeSettings,
  users,
  whatsappConversations,
  whatsappMessages,
  whatsappTemplates,
  whatsappWebhookEvents,
} from '../../db/schema.ts';
import { AuthRequest, requireAdmin, requireAuth } from '../middleware/auth.ts';
import { logAuditEvent } from '../services/audit.ts';
import { generateSalesAssistantReply } from '../services/geminiAssistant.ts';
import {
  getOrCreateConversation,
  getWhatsAppConfigStatus,
  sendOrderStatusNotification,
  sendWhatsAppMessage,
} from '../services/whatsapp.ts';

export const authRouter = Router();
export const adminRouter = Router();

// Check current authenticated user & whether an admin exists yet
authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const adminRoles = await db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.name, ['super_admin', 'admin']));
    const adminRoleIds = adminRoles.map((r) => r.id);

    let adminCount = 0;
    if (adminRoleIds.length > 0) {
      const [row] = await db
        .select({ value: count() })
        .from(users)
        .where(inArray(users.roleId, adminRoleIds));
      adminCount = row?.value ?? 0;
    }

    const configuredAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = (req.dbUser?.email || '').toLowerCase();
    const isAdmin =
      req.dbUser?.roleName === 'super_admin' ||
      req.dbUser?.roleName === 'admin' ||
      req.dbUser?.roleName === 'staff' ||
      configuredAdmins.includes(email);

    res.json({
      user: req.dbUser,
      isAdmin,
      canClaimInitialAdmin: adminCount === 0 && configuredAdmins.length === 0,
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to load auth status' });
  }
});

// One-time atomic initial admin claim when no admin has been provisioned yet
authRouter.post('/claim-admin', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid || req.user.email_verified === false) {
      return res.status(403).json({ error: 'Verified Google account required' });
    }

    const configuredAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (configuredAdmins.length > 0 && !configuredAdmins.includes((req.user.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'Admin access is restricted by ADMIN_EMAILS configuration' });
    }

    const claimed = await db.transaction(async (tx) => {
      const adminRoles = await tx
        .select()
        .from(roles)
        .where(inArray(roles.name, ['super_admin', 'admin']));
      const adminRoleIds = adminRoles.map((r) => r.id);
      const superAdminRole = adminRoles.find((r) => r.name === 'super_admin') || adminRoles[0];

      if (!superAdminRole) throw new Error('Roles not initialized');

      const [existingAdmins] = await tx
        .select({ value: count() })
        .from(users)
        .where(inArray(users.roleId, adminRoleIds));

      if ((existingAdmins?.value ?? 0) > 0) {
        return false;
      }

      await tx
        .update(users)
        .set({ roleId: superAdminRole.id })
        .where(eq(users.uid, req.user!.uid));

      return true;
    });

    if (!claimed) {
      return res.status(409).json({ error: 'An administrator has already been claimed for this store.' });
    }

    await logAuditEvent({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      action: 'ADMIN_CLAIMED',
      entityType: 'user',
      entityId: req.user.uid,
      req,
    });

    res.json({ claimed: true });
  } catch (err) {
    console.error('Claim admin error:', err);
    res.status(500).json({ error: 'Failed to claim admin role' });
  }
});

// Protect all /api/admin/* routes with server-side RBAC
adminRouter.use(requireAdmin);

// Secure image upload endpoint (Base64 image data -> validated /uploads/<safe-file>)
adminRouter.post('/upload', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      filename: z.string().min(1).max(120),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      dataBase64: z.string().min(10).max(8_000_000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid image payload (max ~5MB JPG/PNG/WebP)' });
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const ext = extMap[parsed.data.mimeType];
    const baseDir = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(baseDir, { recursive: true });

    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const targetPath = path.resolve(baseDir, safeName);
    if (!targetPath.startsWith(baseDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const cleanBase64 = parsed.data.dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(targetPath, buffer);

    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'UPLOAD_IMAGE',
      entityType: 'media',
      entityId: safeName,
      req,
    });

    res.json({ url: `/uploads/${safeName}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Dashboard Analytics Overview
adminRouter.get('/analytics', async (_req, res) => {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const [{ value: productCount }] = await db.select({ value: count() }).from(products);
    const [{ value: customerCount }] = await db.select({ value: count() }).from(customers);
    const lowStock = await db
      .select({
        variantId: inventory.variantId,
        quantity: inventory.quantity,
        lowStockThreshold: inventory.lowStockThreshold,
        productName: products.nameAr,
        colorName: productVariants.colorNameAr,
        size: productVariants.size,
        sku: products.sku,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(lte(inventory.quantity, inventory.lowStockThreshold));

    const totalSales = allOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const statusCounts = {
      new: 0,
      pending_confirmation: 0,
      confirmed: 0,
      preparing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const o of allOrders) {
      if (o.status in statusCounts) {
        statusCounts[o.status as keyof typeof statusCounts]++;
      }
    }

    // Group daily revenue (last 14 days)
    const dailyMap = new Map<string, { date: string; sales: number; orders: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, sales: 0, orders: 0 });
    }
    for (const o of allOrders) {
      if (o.status === 'cancelled') continue;
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.sales += Number(o.totalAmount);
        entry.orders += 1;
      }
    }

    // Top selling items
    const items = await db.select().from(orderItems);
    const topProdMap = new Map<string, { productName: string; qty: number; revenue: number }>();
    for (const it of items) {
      const cur = topProdMap.get(it.productName) || {
        productName: it.productName,
        qty: 0,
        revenue: 0,
      };
      cur.qty += it.quantity;
      cur.revenue += Number(it.totalPrice);
      topProdMap.set(it.productName, cur);
    }

    res.json({
      totalSales,
      totalOrders: allOrders.length,
      statusCounts,
      productCount,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
      customerCount,
      dailyChart: Array.from(dailyMap.values()),
      topProducts: Array.from(topProdMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6),
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Admin Products CRUD
adminRouter.get('/products', async (_req, res) => {
  try {
    const prods = await db.select().from(products).orderBy(desc(products.id));
    const imgs = await db.select().from(productImages).orderBy(productImages.sortOrder);
    const vars = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        colorNameAr: productVariants.colorNameAr,
        colorNameFr: productVariants.colorNameFr,
        colorNameEn: productVariants.colorNameEn,
        colorHex: productVariants.colorHex,
        size: productVariants.size,
        skuSuffix: productVariants.skuSuffix,
        priceOverride: productVariants.priceOverride,
        isActive: productVariants.isActive,
        quantity: inventory.quantity,
        lowStockThreshold: inventory.lowStockThreshold,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id));

    res.json(
      prods.map((p) => ({
        ...p,
        originalPrice: Number(p.originalPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        images: imgs.filter((i) => i.productId === p.id),
        variants: vars
          .filter((v) => v.productId === p.id)
          .map((v) => ({ ...v, quantity: v.quantity ?? 0 })),
      }))
    );
  } catch (err) {
    console.error('Admin products error:', err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

const productPayloadSchema = z.object({
  slug: z.string().min(2).max(120),
  sku: z.string().min(2).max(60),
  nameAr: z.string().min(2).max(180),
  nameFr: z.string().min(2).max(180),
  nameEn: z.string().min(2).max(180),
  descriptionAr: z.string().min(2),
  descriptionFr: z.string().min(2),
  descriptionEn: z.string().min(2),
  categoryId: z.number().int().positive(),
  subcategoryId: z.number().int().positive().nullable().optional(),
  originalPrice: z.number().positive(),
  salePrice: z.number().positive().nullable().optional(),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  images: z.array(z.string().min(1)).min(1),
  variants: z
    .array(
      z.object({
        id: z.number().int().optional(),
        colorNameAr: z.string().min(1),
        colorNameFr: z.string().min(1),
        colorNameEn: z.string().min(1),
        colorHex: z.string().default('#141413'),
        size: z.string().min(1),
        skuSuffix: z.string().min(1),
        quantity: z.number().int().min(0),
      })
    )
    .min(1),
});

adminRouter.post('/products', async (req: AuthRequest, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product data', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const discountPercent =
    d.salePrice && d.salePrice < d.originalPrice
      ? Math.round(((d.originalPrice - d.salePrice) / d.originalPrice) * 100)
      : 0;

  try {
    const created = await db.transaction(async (tx) => {
      const [prod] = await tx
        .insert(products)
        .values({
          slug: d.slug.trim(),
          sku: d.sku.trim(),
          nameAr: d.nameAr.trim(),
          nameFr: d.nameFr.trim(),
          nameEn: d.nameEn.trim(),
          descriptionAr: d.descriptionAr.trim(),
          descriptionFr: d.descriptionFr.trim(),
          descriptionEn: d.descriptionEn.trim(),
          categoryId: d.categoryId,
          subcategoryId: d.subcategoryId || null,
          originalPrice: d.originalPrice.toFixed(2),
          salePrice: d.salePrice ? d.salePrice.toFixed(2) : null,
          discountPercent,
          status: d.status,
          isFeatured: d.isFeatured,
          isNewArrival: d.isNewArrival,
          isBestSeller: d.isBestSeller,
          metaTitle: `${d.nameAr} | الشمالي شوب`,
          metaDescription: d.descriptionAr.slice(0, 155),
        })
        .returning();

      for (let i = 0; i < d.images.length; i++) {
        await tx.insert(productImages).values({
          productId: prod.id,
          url: d.images[i],
          altText: d.nameEn,
          sortOrder: i,
          isPrimary: i === 0,
        });
      }

      for (const v of d.variants) {
        const [variant] = await tx
          .insert(productVariants)
          .values({
            productId: prod.id,
            colorNameAr: v.colorNameAr,
            colorNameFr: v.colorNameFr,
            colorNameEn: v.colorNameEn,
            colorHex: v.colorHex,
            size: v.size,
            skuSuffix: v.skuSuffix,
            isActive: true,
          })
          .returning();

        await tx.insert(inventory).values({
          variantId: variant.id,
          quantity: v.quantity,
          lowStockThreshold: 3,
        });

        await tx.insert(inventoryMovements).values({
          variantId: variant.id,
          changeAmount: v.quantity,
          reason: 'Product created',
          referenceType: 'restock',
          referenceId: prod.sku,
          createdByUid: req.dbUser?.uid,
        });
      }

      return prod;
    });

    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'CREATE_PRODUCT',
      entityType: 'product',
      entityId: created.id,
      details: { sku: created.sku },
      req,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product (ensure SKU and slug are unique)' });
  }
});

adminRouter.put('/products/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid product payload' });
  }
  const d = parsed.data;
  const discountPercent =
    d.salePrice && d.salePrice < d.originalPrice
      ? Math.round(((d.originalPrice - d.salePrice) / d.originalPrice) * 100)
      : 0;

  try {
    const updated = await db.transaction(async (tx) => {
      const [prod] = await tx
        .update(products)
        .set({
          slug: d.slug.trim(),
          sku: d.sku.trim(),
          nameAr: d.nameAr.trim(),
          nameFr: d.nameFr.trim(),
          nameEn: d.nameEn.trim(),
          descriptionAr: d.descriptionAr.trim(),
          descriptionFr: d.descriptionFr.trim(),
          descriptionEn: d.descriptionEn.trim(),
          categoryId: d.categoryId,
          subcategoryId: d.subcategoryId || null,
          originalPrice: d.originalPrice.toFixed(2),
          salePrice: d.salePrice ? d.salePrice.toFixed(2) : null,
          discountPercent,
          status: d.status,
          isFeatured: d.isFeatured,
          isNewArrival: d.isNewArrival,
          isBestSeller: d.isBestSeller,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (!prod) throw new Error('NOT_FOUND');

      await tx.delete(productImages).where(eq(productImages.productId, id));
      for (let i = 0; i < d.images.length; i++) {
        await tx.insert(productImages).values({
          productId: id,
          url: d.images[i],
          altText: d.nameEn,
          sortOrder: i,
          isPrimary: i === 0,
        });
      }

      for (const v of d.variants) {
        if (v.id) {
          await tx
            .update(productVariants)
            .set({
              colorNameAr: v.colorNameAr,
              colorNameFr: v.colorNameFr,
              colorNameEn: v.colorNameEn,
              colorHex: v.colorHex,
              size: v.size,
              skuSuffix: v.skuSuffix,
              isActive: true,
            })
            .where(eq(productVariants.id, v.id));

          await tx
            .update(inventory)
            .set({ quantity: v.quantity, updatedAt: new Date() })
            .where(eq(inventory.variantId, v.id));
        } else {
          const [newVar] = await tx
            .insert(productVariants)
            .values({
              productId: id,
              colorNameAr: v.colorNameAr,
              colorNameFr: v.colorNameFr,
              colorNameEn: v.colorNameEn,
              colorHex: v.colorHex,
              size: v.size,
              skuSuffix: v.skuSuffix,
              isActive: true,
            })
            .returning();

          await tx.insert(inventory).values({
            variantId: newVar.id,
            quantity: v.quantity,
            lowStockThreshold: 3,
          });
        }
      }

      return prod;
    });

    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'UPDATE_PRODUCT',
      entityType: 'product',
      entityId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

adminRouter.delete('/products/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    await db.update(products).set({ status: 'archived', updatedAt: new Date() }).where(eq(products.id, id));
    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'ARCHIVE_PRODUCT',
      entityType: 'product',
      entityId: id,
      req,
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to archive product' });
  }
});

// Categories CRUD
adminRouter.get('/categories', async (_req, res) => {
  const list = await db.select().from(categories).orderBy(categories.sortOrder, categories.id);
  res.json(list);
});

adminRouter.post('/categories', async (req: AuthRequest, res) => {
  const schema = z.object({
    slug: z.string().min(2).max(80),
    nameAr: z.string().min(2).max(120),
    nameFr: z.string().min(2).max(120),
    nameEn: z.string().min(2).max(120),
    parentId: z.number().int().positive().nullable().optional(),
    imageUrl: z.string().optional().nullable(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid category payload' });

  const [created] = await db.insert(categories).values(parsed.data).returning();
  await logAuditEvent({
    actorUid: req.dbUser?.uid,
    actorEmail: req.dbUser?.email,
    action: 'CREATE_CATEGORY',
    entityType: 'category',
    entityId: created.id,
    req,
  });
  res.status(201).json(created);
});

adminRouter.delete('/categories/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.update(categories).set({ isActive: false }).where(eq(categories.id, id));
  res.json({ deleted: true });
});

// Orders Management
adminRouter.get('/orders', async (_req, res) => {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const allItems = await db.select().from(orderItems);
    res.json(
      allOrders.map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        shippingFee: Number(o.shippingFee),
        discountAmount: Number(o.discountAmount),
        totalAmount: Number(o.totalAmount),
        items: allItems.filter((i) => i.orderId === o.id),
      }))
    );
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

adminRouter.patch('/orders/:id/status', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    status: z.enum([
      'new',
      'pending_confirmation',
      'confirmed',
      'preparing',
      'shipped',
      'delivered',
      'cancelled',
    ]),
    notifyWhatsapp: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status update' });

  try {
    const [updated] = await db
      .update(orders)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Order not found' });

    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'UPDATE_ORDER_STATUS',
      entityType: 'order',
      entityId: updated.orderNumber,
      details: { status: parsed.data.status },
      req,
    });

    const eventMap: Record<
      string,
      'order_confirmed' | 'order_preparing' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
    > = {
      confirmed: 'order_confirmed',
      preparing: 'order_preparing',
      shipped: 'order_shipped',
      delivered: 'order_delivered',
      cancelled: 'order_cancelled',
    };

    let whatsappNotice = null;
    if (parsed.data.notifyWhatsapp && eventMap[parsed.data.status]) {
      whatsappNotice = await sendOrderStatusNotification(updated.id, eventMap[parsed.data.status]);
    }

    res.json({ order: updated, whatsappNotice });
  } catch (err) {
    console.error('Order status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Customers Management
adminRouter.get('/customers', async (_req, res) => {
  const list = await db.select().from(customers).orderBy(desc(customers.updatedAt));
  res.json(
    list.map((c) => ({
      ...c,
      totalSpent: Number(c.totalSpent),
    }))
  );
});

// Inventory & Movements
adminRouter.get('/inventory', async (_req, res) => {
  const stock = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      sku: products.sku,
      productNameAr: products.nameAr,
      colorNameAr: productVariants.colorNameAr,
      colorHex: productVariants.colorHex,
      size: productVariants.size,
      quantity: inventory.quantity,
      lowStockThreshold: inventory.lowStockThreshold,
      updatedAt: inventory.updatedAt,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .orderBy(inventory.quantity);

  const movements = await db
    .select()
    .from(inventoryMovements)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(50);

  res.json({ stock, movements });
});

adminRouter.post('/inventory/adjust', async (req: AuthRequest, res) => {
  const schema = z.object({
    variantId: z.number().int().positive(),
    changeAmount: z.number().int().min(-1000).max(5000),
    reason: z.string().min(2).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid stock adjustment' });

  try {
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx
        .update(inventory)
        .set({
          quantity: sql`GREATEST(0, ${inventory.quantity} + ${parsed.data.changeAmount})`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.variantId, parsed.data.variantId))
        .returning();

      await tx.insert(inventoryMovements).values({
        variantId: parsed.data.variantId,
        changeAmount: parsed.data.changeAmount,
        reason: parsed.data.reason,
        referenceType: 'manual',
        createdByUid: req.dbUser?.uid,
      });

      return inv;
    });

    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'ADJUST_INVENTORY',
      entityType: 'inventory',
      entityId: parsed.data.variantId,
      details: parsed.data,
      req,
    });

    res.json(result);
  } catch (err) {
    console.error('Inventory adjust error:', err);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

// Shipping Zones CRUD
adminRouter.get('/shipping-zones', async (_req, res) => {
  const zones = await db.select().from(shippingZones).orderBy(shippingZones.sortOrder);
  res.json(
    zones.map((z) => ({
      ...z,
      shippingFee: Number(z.shippingFee),
      freeShippingThreshold: z.freeShippingThreshold ? Number(z.freeShippingThreshold) : null,
    }))
  );
});

adminRouter.post('/shipping-zones', async (req: AuthRequest, res) => {
  const schema = z.object({
    cityNameAr: z.string().min(2).max(80),
    cityNameFr: z.string().min(2).max(80),
    cityNameEn: z.string().min(2).max(80),
    shippingFee: z.number().nonnegative(),
    estimatedDays: z.string().min(1).max(40),
    freeShippingThreshold: z.number().positive().nullable().optional(),
    carrierName: z.string().min(2).max(80).default('Chamali Express'),
    isActive: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid shipping zone data' });

  const [created] = await db
    .insert(shippingZones)
    .values({
      ...parsed.data,
      shippingFee: parsed.data.shippingFee.toFixed(2),
      freeShippingThreshold: parsed.data.freeShippingThreshold
        ? parsed.data.freeShippingThreshold.toFixed(2)
        : null,
    })
    .returning();

  res.status(201).json(created);
});

adminRouter.put('/shipping-zones/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    shippingFee: z.number().nonnegative(),
    estimatedDays: z.string().min(1).max(40),
    freeShippingThreshold: z.number().positive().nullable().optional(),
    carrierName: z.string().min(2).max(80),
    isActive: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid shipping zone update' });

  const [updated] = await db
    .update(shippingZones)
    .set({
      shippingFee: parsed.data.shippingFee.toFixed(2),
      estimatedDays: parsed.data.estimatedDays,
      freeShippingThreshold: parsed.data.freeShippingThreshold
        ? parsed.data.freeShippingThreshold.toFixed(2)
        : null,
      carrierName: parsed.data.carrierName,
      isActive: parsed.data.isActive,
    })
    .where(eq(shippingZones.id, id))
    .returning();

  res.json(updated);
});

// Coupons CRUD
adminRouter.get('/coupons', async (_req, res) => {
  const list = await db.select().from(coupons).orderBy(desc(coupons.id));
  res.json(list);
});

adminRouter.post('/coupons', async (req: AuthRequest, res) => {
  const schema = z.object({
    code: z.string().min(3).max(40),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().positive(),
    minOrderAmount: z.number().nonnegative().default(0),
    maxUses: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid coupon data' });

  const [created] = await db
    .insert(coupons)
    .values({
      code: parsed.data.code.trim().toUpperCase(),
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue.toFixed(2),
      minOrderAmount: parsed.data.minOrderAmount.toFixed(2),
      maxUses: parsed.data.maxUses ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      isActive: parsed.data.isActive,
    })
    .returning();

  res.status(201).json(created);
});

adminRouter.patch('/coupons/:id/toggle', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const [cur] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  if (!cur) return res.status(404).json({ error: 'Coupon not found' });
  const [updated] = await db
    .update(coupons)
    .set({ isActive: !cur.isActive })
    .where(eq(coupons.id, id))
    .returning();
  res.json(updated);
});

// WhatsApp & AI Administration
adminRouter.get('/whatsapp/overview', async (_req, res) => {
  const configStatus = getWhatsAppConfigStatus();
  const conversations = await db
    .select()
    .from(whatsappConversations)
    .orderBy(desc(whatsappConversations.lastMessageAt));
  const templates = await db.select().from(whatsappTemplates).orderBy(whatsappTemplates.id);
  const webhookEvents = await db
    .select()
    .from(whatsappWebhookEvents)
    .orderBy(desc(whatsappWebhookEvents.createdAt))
    .limit(20);

  res.json({
    configStatus,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    conversations,
    templates,
    webhookEvents,
  });
});

adminRouter.get('/whatsapp/conversations/:id/messages', async (req, res) => {
  const convId = Number(req.params.id);
  const msgs = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, convId))
    .orderBy(whatsappMessages.createdAt);
  res.json(msgs);
});

adminRouter.post('/whatsapp/conversations/:id/reply', async (req: AuthRequest, res) => {
  const convId = Number(req.params.id);
  const schema = z.object({ body: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Message body required' });

  const [conv] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, convId))
    .limit(1);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // Sending a manual admin reply automatically pauses AI takeover (human control)
  const sent = await sendWhatsAppMessage({
    toPhone: conv.waPhone,
    body: parsed.data.body,
    senderType: 'admin',
  });

  await logAuditEvent({
    actorUid: req.dbUser?.uid,
    actorEmail: req.dbUser?.email,
    action: 'WHATSAPP_ADMIN_REPLY',
    entityType: 'whatsapp_conversation',
    entityId: convId,
    req,
  });

  res.json(sent);
});

adminRouter.patch('/whatsapp/conversations/:id/ai', async (req: AuthRequest, res) => {
  const convId = Number(req.params.id);
  const schema = z.object({ aiEnabled: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid AI toggle' });

  const [updated] = await db
    .update(whatsappConversations)
    .set({
      aiEnabled: parsed.data.aiEnabled,
      status: parsed.data.aiEnabled ? 'open' : 'human_handoff',
    })
    .where(eq(whatsappConversations.id, convId))
    .returning();

  res.json(updated);
});

// Admin WhatsApp / AI Live Test (writes real conversation & runs real Gemini + DB tools)
adminRouter.post('/whatsapp/test-inbound', async (req: AuthRequest, res) => {
  const schema = z.object({
    phone: z.string().min(8).max(20),
    customerName: z.string().max(80).optional(),
    message: z.string().min(1).max(1000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid test message' });

  const conv = await getOrCreateConversation(parsed.data.phone, parsed.data.customerName);
  await db.insert(whatsappMessages).values({
    conversationId: conv.id,
    direction: 'inbound',
    senderType: 'customer',
    messageType: 'text',
    body: parsed.data.message,
    deliveryStatus: 'received',
  });

  if (!conv.aiEnabled) {
    return res.json({
      conversation: conv,
      aiPaused: true,
      reply: null,
    });
  }

  const aiResult = await generateSalesAssistantReply({
    customerMessage: parsed.data.message,
    conversationId: conv.id,
    waPhone: conv.waPhone,
  });

  const sent = await sendWhatsAppMessage({
    toPhone: conv.waPhone,
    body: aiResult.reply,
    senderType: 'ai',
  });

  res.json({
    conversation: conv,
    aiPaused: false,
    reply: aiResult.reply,
    toolsUsed: aiResult.toolsUsed,
    escalated: aiResult.escalated,
    delivery: sent,
  });
});

adminRouter.put('/whatsapp/templates/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    metaTemplateName: z.string().min(1),
    bodyAr: z.string().min(1),
    bodyFr: z.string().min(1),
    bodyEn: z.string().min(1),
    isActive: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid template update' });

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(whatsappTemplates.id, id))
    .returning();
  res.json(updated);
});

// Store Settings
adminRouter.put('/settings', async (req: AuthRequest, res) => {
  const schema = z.object({
    storeNameAr: z.string().min(2),
    storeNameEn: z.string().min(2),
    taglineAr: z.string().min(2),
    taglineFr: z.string().min(2),
    taglineEn: z.string().min(2),
    logoUrl: z.string().nullable().optional(),
    primaryColor: z.string().min(4),
    accentColor: z.string().min(4),
    phone: z.string().min(5),
    whatsappNumber: z.string().min(5),
    email: z.string().email(),
    facebookUrl: z.string().min(4),
    instagramUrl: z.string().min(4),
    heroTitleAr: z.string().min(2),
    heroTitleFr: z.string().min(2),
    heroTitleEn: z.string().min(2),
    heroSubtitleAr: z.string().min(2),
    heroSubtitleFr: z.string().min(2),
    heroSubtitleEn: z.string().min(2),
    heroImageUrl: z.string().min(2),
    announcementAr: z.string().min(2),
    announcementFr: z.string().min(2),
    announcementEn: z.string().min(2),
    homeSectionOrder: z.array(z.string()).optional(),
    metaPixelId: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid store settings payload' });

  const [existing] = await db.select().from(storeSettings).limit(1);
  if (!existing) return res.status(404).json({ error: 'Store settings not found' });

  const [updated] = await db
    .update(storeSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(storeSettings.id, existing.id))
    .returning();

  await logAuditEvent({
    actorUid: req.dbUser?.uid,
    actorEmail: req.dbUser?.email,
    action: 'UPDATE_STORE_SETTINGS',
    entityType: 'store_settings',
    entityId: existing.id,
    req,
  });

  res.json(updated);
});

// Audit Logs & Full Database JSON Backup Export
adminRouter.get('/audit-logs', async (_req, res) => {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  res.json(logs);
});

adminRouter.get('/backup/export', async (req: AuthRequest, res) => {
  try {
    const [
      cats,
      prods,
      vars,
      inv,
      custs,
      ords,
      items,
      zones,
      coups,
      revs,
      settings,
    ] = await Promise.all([
      db.select().from(categories),
      db.select().from(products),
      db.select().from(productVariants),
      db.select().from(inventory),
      db.select().from(customers),
      db.select().from(orders),
      db.select().from(orderItems),
      db.select().from(shippingZones),
      db.select().from(coupons),
      db.select().from(reviews),
      db.select().from(storeSettings),
    ]);

    await logAuditEvent({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'EXPORT_DATABASE_BACKUP',
      entityType: 'system',
      req,
    });

    res.setHeader('Content-Disposition', `attachment; filename="chamali-shop-backup-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      categories: cats,
      products: prods,
      variants: vars,
      inventory: inv,
      customers: custs,
      orders: ords,
      orderItems: items,
      shippingZones: zones,
      coupons: coups,
      reviews: revs,
      storeSettings: settings,
    });
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: 'Failed to export database backup' });
  }
});
