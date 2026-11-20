import crypto from 'crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import {
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
  shippingZones,
  storeSettings,
} from '../../db/schema.ts';
import { generateSalesAssistantReply } from '../services/geminiAssistant.ts';
import { logAuditEvent } from '../services/audit.ts';
import { normalizeMoroccanPhone, sendOrderStatusNotification } from '../services/whatsapp.ts';

export const publicRouter = Router();

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many order requests. Please wait a moment and try again.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI assistant requests. Please wait briefly.' },
});

async function getHydratedProducts() {
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.status, 'active'))
    .orderBy(desc(products.isFeatured), desc(products.id));

  const allImages = await db.select().from(productImages).orderBy(productImages.sortOrder);
  const allVariants = await db
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
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(productVariants.isActive, true));

  const imagesByProd = new Map<number, typeof allImages>();
  for (const img of allImages) {
    const arr = imagesByProd.get(img.productId) || [];
    arr.push(img);
    imagesByProd.set(img.productId, arr);
  }

  const variantsByProd = new Map<number, typeof allVariants>();
  for (const v of allVariants) {
    const arr = variantsByProd.get(v.productId) || [];
    arr.push(v);
    variantsByProd.set(v.productId, arr);
  }

  return allProducts.map((p) => {
    const vars = (variantsByProd.get(p.id) || []).map((v) => ({
      ...v,
      quantity: v.quantity ?? 0,
      lowStockThreshold: v.lowStockThreshold ?? 3,
    }));
    const totalStock = vars.reduce((sum, v) => sum + v.quantity, 0);
    return {
      ...p,
      originalPrice: Number(p.originalPrice),
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      images: imagesByProd.get(p.id) || [],
      variants: vars,
      totalStock,
    };
  });
}

// Storefront bootstrap (settings, categories, active products, shipping zones, reviews)
publicRouter.get('/store/bootstrap', async (_req, res) => {
  try {
    await ensureDatabaseSeeded();
    const [settings] = await db.select().from(storeSettings).limit(1);
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.sortOrder, categories.id);
    const zones = await db
      .select()
      .from(shippingZones)
      .where(eq(shippingZones.isActive, true))
      .orderBy(shippingZones.sortOrder, shippingZones.id);
    const prods = await getHydratedProducts();
    const approvedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.isApproved, true))
      .orderBy(desc(reviews.id));

    res.json({
      settings,
      categories: cats,
      shippingZones: zones.map((z) => ({
        ...z,
        shippingFee: Number(z.shippingFee),
        freeShippingThreshold: z.freeShippingThreshold ? Number(z.freeShippingThreshold) : null,
      })),
      products: prods,
      reviews: approvedReviews,
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Failed to load store data' });
  }
});

// Single product by slug or id
publicRouter.get('/products/:slugOrId', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const raw = req.params.slugOrId;
    const isNum = /^\d+$/.test(raw);
    const [product] = await db
      .select()
      .from(products)
      .where(isNum ? eq(products.id, Number(raw)) : eq(products.slug, raw))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const imgs = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(productImages.sortOrder);

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
      })
      .from(productVariants)
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.isActive, true)));

    res.json({
      ...product,
      originalPrice: Number(product.originalPrice),
      salePrice: product.salePrice ? Number(product.salePrice) : null,
      images: imgs,
      variants: vars.map((v) => ({ ...v, quantity: v.quantity ?? 0 })),
    });
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

// Coupon validation
publicRouter.post('/coupons/validate', async (req, res) => {
  try {
    const schema = z.object({
      code: z.string().min(1).max(40),
      subtotal: z.number().nonnegative(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid coupon request' });
    }

    const code = parsed.data.code.trim().toUpperCase();
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);

    if (!coupon || !coupon.isActive) {
      return res.status(404).json({ valid: false, error: 'Coupon code is invalid or inactive' });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ valid: false, error: 'Coupon code has expired' });
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ valid: false, error: 'Coupon usage limit reached' });
    }
    if (parsed.data.subtotal < Number(coupon.minOrderAmount)) {
      return res.status(400).json({
        valid: false,
        error: `Minimum order of ${Number(coupon.minOrderAmount)} MAD required`,
      });
    }

    const discountAmount =
      coupon.discountType === 'percent'
        ? Math.round((parsed.data.subtotal * Number(coupon.discountValue)) / 100)
        : Math.min(parsed.data.subtotal, Number(coupon.discountValue));

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
    });
  } catch (err) {
    console.error('Coupon validate error:', err);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Create COD Order (with DB transaction, real price calculation, atomic inventory deduction & duplicate order protection)
const checkoutSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(8).max(25),
  cityId: z.number().int().positive(),
  address: z.string().min(4).max(300),
  notes: z.string().max(400).optional().default(''),
  paymentMethod: z.enum(['cod', 'card']).default('cod'),
  couponCode: z.string().max(40).optional().nullable(),
  idempotencyKey: z.string().min(8).max(120).optional(),
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(30),
});

publicRouter.post('/orders', orderLimiter, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Please check all required order fields.',
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  const normalizedPhone = normalizeMoroccanPhone(data.customerPhone);

  // Duplicate order protection: either client idempotencyKey or 90-second same phone + total window
  const idempotencyKey =
    data.idempotencyKey ||
    crypto
      .createHash('sha256')
      .update(
        `${normalizedPhone}:${JSON.stringify(data.items)}:${Math.floor(Date.now() / 60000)}`
      )
      .digest('hex');

  try {
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingOrder.length > 0) {
      const existingItems = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, existingOrder[0].id));
      return res.status(200).json({
        duplicatePrevented: true,
        order: existingOrder[0],
        items: existingItems,
      });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Validate shipping zone from DB
      const [zone] = await tx
        .select()
        .from(shippingZones)
        .where(and(eq(shippingZones.id, data.cityId), eq(shippingZones.isActive, true)))
        .limit(1);

      if (!zone) {
        throw new Error('CITY_INVALID');
      }

      // 2. Validate variants, real DB prices, and deduct inventory atomically
      let subtotal = 0;
      const lineItems: {
        productId: number;
        variantId: number;
        productName: string;
        colorName: string;
        size: string;
        unitPrice: number;
        quantity: number;
        totalPrice: number;
      }[] = [];

      for (const reqItem of data.items) {
        const [variant] = await tx
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.id, reqItem.variantId), eq(productVariants.isActive, true)))
          .limit(1);

        if (!variant) {
          throw new Error('VARIANT_NOT_FOUND');
        }

        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, variant.productId), eq(products.status, 'active')))
          .limit(1);

        if (!product) {
          throw new Error('PRODUCT_UNAVAILABLE');
        }

        // Atomic conditional stock decrement
        const updatedInv = await tx
          .update(inventory)
          .set({
            quantity: sql`${inventory.quantity} - ${reqItem.quantity}`,
            updatedAt: new Date(),
          })
          .where(and(eq(inventory.variantId, variant.id), gte(inventory.quantity, reqItem.quantity)))
          .returning();

        if (updatedInv.length === 0) {
          throw new Error(`OUT_OF_STOCK:${product.nameAr} (${variant.colorNameAr} - ${variant.size})`);
        }

        const unitPrice = Number(variant.priceOverride ?? product.salePrice ?? product.originalPrice);
        const totalPrice = unitPrice * reqItem.quantity;
        subtotal += totalPrice;

        lineItems.push({
          productId: product.id,
          variantId: variant.id,
          productName: product.nameAr,
          colorName: variant.colorNameAr,
          size: variant.size,
          unitPrice,
          quantity: reqItem.quantity,
          totalPrice,
        });
      }

      // 3. Apply coupon if provided
      let discountAmount = 0;
      let appliedCoupon: string | null = null;
      if (data.couponCode && data.couponCode.trim()) {
        const code = data.couponCode.trim().toUpperCase();
        const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, code)).limit(1);
        if (
          coupon &&
          coupon.isActive &&
          (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date()) &&
          (coupon.maxUses === null || coupon.usedCount < coupon.maxUses) &&
          subtotal >= Number(coupon.minOrderAmount)
        ) {
          discountAmount =
            coupon.discountType === 'percent'
              ? Math.round((subtotal * Number(coupon.discountValue)) / 100)
              : Math.min(subtotal, Number(coupon.discountValue));
          appliedCoupon = coupon.code;
          await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.id, coupon.id));
        }
      }

      // 4. Calculate shipping fee with free threshold
      let shippingFee = Number(zone.shippingFee);
      const afterDiscount = Math.max(0, subtotal - discountAmount);
      if (zone.freeShippingThreshold && afterDiscount >= Number(zone.freeShippingThreshold)) {
        shippingFee = 0;
      }

      const totalAmount = afterDiscount + shippingFee;

      // 5. Upsert customer
      const existingCustomer = await tx
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone))
        .limit(1);

      let customerId: number;
      if (existingCustomer.length > 0) {
        customerId = existingCustomer[0].id;
        await tx
          .update(customers)
          .set({
            fullName: data.customerName.trim(),
            city: zone.cityNameAr,
            address: data.address.trim(),
            totalOrders: sql`${customers.totalOrders} + 1`,
            totalSpent: sql`${customers.totalSpent} + ${totalAmount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, customerId));
      } else {
        const [newCust] = await tx
          .insert(customers)
          .values({
            fullName: data.customerName.trim(),
            phone: normalizedPhone,
            city: zone.cityNameAr,
            address: data.address.trim(),
            totalOrders: 1,
            totalSpent: totalAmount.toFixed(2),
          })
          .returning();
        customerId = newCust.id;
      }

      // 6. Generate unique order number & save order
      const orderNumber = `CHM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const [createdOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId,
          customerName: data.customerName.trim(),
          customerPhone: normalizedPhone,
          city: zone.cityNameAr,
          address: data.address.trim(),
          notes: data.notes?.trim() || null,
          paymentMethod: 'cod',
          status: 'new',
          subtotal: subtotal.toFixed(2),
          shippingFee: shippingFee.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          couponCode: appliedCoupon,
          source: 'web',
          idempotencyKey,
        })
        .returning();

      for (const li of lineItems) {
        await tx.insert(orderItems).values({
          orderId: createdOrder.id,
          productId: li.productId,
          variantId: li.variantId,
          productName: li.productName,
          colorName: li.colorName,
          size: li.size,
          unitPrice: li.unitPrice.toFixed(2),
          quantity: li.quantity,
          totalPrice: li.totalPrice.toFixed(2),
        });

        await tx.insert(inventoryMovements).values({
          variantId: li.variantId,
          changeAmount: -li.quantity,
          reason: `Web checkout order ${orderNumber}`,
          referenceType: 'order',
          referenceId: orderNumber,
        });
      }

      return { order: createdOrder, items: lineItems };
    });

    // Audit & async WhatsApp notification
    await logAuditEvent({
      action: 'ORDER_CREATED',
      entityType: 'order',
      entityId: result.order.orderNumber,
      details: { totalAmount: result.order.totalAmount, source: 'web' },
      req,
    });

    sendOrderStatusNotification(result.order.id, 'order_confirmed').catch(() => {});

    res.status(201).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Checkout failed';
    if (msg.startsWith('OUT_OF_STOCK:')) {
      return res.status(409).json({ error: `Insufficient stock for ${msg.replace('OUT_OF_STOCK:', '')}` });
    }
    if (msg === 'CITY_INVALID') {
      return res.status(400).json({ error: 'Selected delivery city is unavailable.' });
    }
    if (msg === 'VARIANT_NOT_FOUND' || msg === 'PRODUCT_UNAVAILABLE') {
      return res.status(400).json({ error: 'One or more items are no longer available.' });
    }
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Unable to complete order. Please try again.' });
  }
});

// Track order by orderNumber & phone
publicRouter.get('/orders/track', async (req, res) => {
  try {
    const orderNumber = String(req.query.orderNumber || '').trim();
    const rawPhone = String(req.query.phone || '').trim();
    const phone = normalizeMoroccanPhone(rawPhone);

    if (!orderNumber || !phone) {
      return res.status(400).json({ error: 'Order number and phone number are required' });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderNumber, orderNumber),
          sql`(${orders.customerPhone} = ${phone} OR ${orders.customerPhone} = ${rawPhone})`
        )
      )
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found. Check order number and phone.' });
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    res.json({ order, items });
  } catch (err) {
    console.error('Track order error:', err);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// On-site Gemini AI Sales Concierge endpoint (same live PostgreSQL tools as WhatsApp)
publicRouter.post('/ai/chat', aiLimiter, async (req, res) => {
  try {
    const schema = z.object({
      message: z.string().min(1).max(1000),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'model']),
            text: z.string().max(2000),
          })
        )
        .max(20)
        .optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid chat message' });
    }

    const result = await generateSalesAssistantReply({
      customerMessage: parsed.data.message,
      history: parsed.data.history,
    });

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI assistant error';
    console.error('AI chat error:', err);
    res.status(500).json({ error: msg });
  }
});

// Meta Commerce Manager Product Catalog Feed (CSV)
publicRouter.get('/feeds/meta-catalog.csv', async (_req, res) => {
  try {
    await ensureDatabaseSeeded();
    const prods = await getHydratedProducts();
    const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

    const header = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'link',
      'image_link',
      'brand',
    ].join(',');

    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

    const rows = prods.map((p) => {
      const price = `${(p.salePrice ?? p.originalPrice).toFixed(2)} MAD`;
      const availability = p.totalStock > 0 ? 'in stock' : 'out of stock';
      const primaryImg = p.images[0]?.url || '';
      const imgUrl = primaryImg.startsWith('http') ? primaryImg : `${baseUrl}${primaryImg}`;
      const productUrl = `${baseUrl}/product/${p.slug}`;

      return [
        escapeCsv(p.sku),
        escapeCsv(p.nameAr),
        escapeCsv(p.descriptionAr),
        escapeCsv(availability),
        escapeCsv('new'),
        escapeCsv(price),
        escapeCsv(productUrl),
        escapeCsv(imgUrl),
        escapeCsv('CHAMALI SHOP'),
      ].join(',');
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send([header, ...rows].join('\n'));
  } catch (err) {
    console.error('Meta catalog CSV error:', err);
    res.status(500).send('Failed to generate Meta catalog feed');
  }
});
