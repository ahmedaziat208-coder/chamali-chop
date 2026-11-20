import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  categories,
  customers,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  shippingZones,
  storeSettings,
  whatsappConversations,
  whatsappMessages,
} from '../../db/schema.ts';
import { normalizeMoroccanPhone, sendOrderStatusNotification } from './whatsapp.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description:
      'Search real products in CHAMALI SHOP PostgreSQL database by keyword, category, or max price. Always call this before stating product names, prices, or discounts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search keyword in Arabic, Darija, French, or English (e.g. صندل, sandal, حذاء, حقيبة, فستان, قميص)',
        },
        categorySlug: {
          type: Type.STRING,
          description: 'Optional category slug: shoes-sandals, mens-clothing, womens-clothing, bags, accessories, fashion',
        },
        maxPrice: {
          type: Type.NUMBER,
          description: 'Optional maximum price in MAD',
        },
      },
    },
  },
  {
    name: 'get_product_details',
    description:
      'Get full details, colors, sizes, and real per-variant stock quantities for a specific product by ID or SKU.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.INTEGER, description: 'Numeric product ID' },
        sku: { type: Type.STRING, description: 'Product SKU' },
      },
    },
  },
  {
    name: 'check_variant_stock',
    description:
      'Verify exact live inventory quantity for a specific product, color, and size before confirming availability to a customer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.INTEGER, description: 'Product ID' },
        color: { type: Type.STRING, description: 'Color name (Arabic, French, or English)' },
        size: { type: Type.STRING, description: 'Size (e.g. 40, 41, 42, M, L, Standard)' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'get_shipping_info',
    description:
      'Get real delivery fees, estimated delivery time, and free-shipping threshold for Moroccan cities.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description: 'Moroccan city name (e.g. Casablanca, الدار البيضاء, Tanger, Marrakech, Rabat)',
        },
      },
    },
  },
  {
    name: 'create_cod_order',
    description:
      'Create a real Cash on Delivery (COD) order in PostgreSQL ONLY AFTER reviewing the complete summary with the customer and receiving their explicit confirmation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: { type: Type.STRING, description: 'Full customer name' },
        customerPhone: { type: Type.STRING, description: 'Moroccan phone number' },
        city: { type: Type.STRING, description: 'Moroccan city name' },
        address: { type: Type.STRING, description: 'Full delivery street address' },
        notes: { type: Type.STRING, description: 'Optional delivery notes' },
        customerConfirmed: {
          type: Type.BOOLEAN,
          description: 'Must be true only after the customer explicitly confirmed the order summary.',
        },
        items: {
          type: Type.ARRAY,
          description: 'Ordered items with variantId and quantity',
          items: {
            type: Type.OBJECT,
            properties: {
              variantId: { type: Type.INTEGER, description: 'Exact variantId from product lookup' },
              quantity: { type: Type.INTEGER, description: 'Quantity >= 1' },
            },
            required: ['variantId', 'quantity'],
          },
        },
      },
      required: ['customerName', 'customerPhone', 'city', 'address', 'customerConfirmed', 'items'],
    },
  },
  {
    name: 'check_order_status',
    description: 'Check real status of an existing order by orderNumber or customer phone.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderNumber: { type: Type.STRING, description: 'Order number like CHM-2026-1001' },
        phone: { type: Type.STRING, description: 'Customer phone number' },
      },
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Pause automated AI replies and hand the conversation over to a human staff member when the customer requests a human agent or has a complex complaint.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: 'Reason for human handoff' },
      },
      required: ['reason'],
    },
  },
];

async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  context: { conversationId?: number; waPhone?: string }
): Promise<unknown> {
  if (name === 'search_products') {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const categorySlug = typeof args.categorySlug === 'string' ? args.categorySlug.trim() : '';
    const maxPrice = typeof args.maxPrice === 'number' ? args.maxPrice : undefined;

    const allCats = await db.select().from(categories);
    const catIdBySlug = categorySlug
      ? allCats.find((c) => c.slug === categorySlug)?.id
      : undefined;

    const conditions = [eq(products.status, 'active')];
    if (catIdBySlug) {
      conditions.push(eq(products.categoryId, catIdBySlug));
    }
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(
          ilike(products.nameAr, pattern),
          ilike(products.nameFr, pattern),
          ilike(products.nameEn, pattern),
          ilike(products.descriptionAr, pattern),
          ilike(products.sku, pattern)
        )!
      );
    }

    const found = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.isBestSeller), desc(products.id))
      .limit(8);

    const results = [];
    for (const p of found) {
      const effectivePrice = Number(p.salePrice ?? p.originalPrice);
      if (maxPrice !== undefined && effectivePrice > maxPrice) continue;

      const imgs = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, p.id))
        .limit(1);

      const vars = await db
        .select({
          variantId: productVariants.id,
          colorNameAr: productVariants.colorNameAr,
          colorNameFr: productVariants.colorNameFr,
          colorNameEn: productVariants.colorNameEn,
          size: productVariants.size,
          quantity: inventory.quantity,
        })
        .from(productVariants)
        .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
        .where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true)));

      results.push({
        id: p.id,
        sku: p.sku,
        slug: p.slug,
        nameAr: p.nameAr,
        nameFr: p.nameFr,
        nameEn: p.nameEn,
        originalPriceMAD: Number(p.originalPrice),
        salePriceMAD: p.salePrice ? Number(p.salePrice) : null,
        effectivePriceMAD: effectivePrice,
        discountPercent: p.discountPercent,
        imageUrl: imgs[0]?.url || null,
        variants: vars.map((v) => ({
          variantId: v.variantId,
          colorAr: v.colorNameAr,
          colorFr: v.colorNameFr,
          colorEn: v.colorNameEn,
          size: v.size,
          stock: v.quantity ?? 0,
        })),
      });
    }

    return { count: results.length, products: results };
  }

  if (name === 'get_product_details') {
    const productId = typeof args.productId === 'number' ? args.productId : undefined;
    const sku = typeof args.sku === 'string' ? args.sku.trim() : undefined;

    const [p] = await db
      .select()
      .from(products)
      .where(productId ? eq(products.id, productId) : eq(products.sku, sku || ''))
      .limit(1);

    if (!p) return { found: false, message: 'Product not found' };

    const imgs = await db.select().from(productImages).where(eq(productImages.productId, p.id));
    const vars = await db
      .select({
        variantId: productVariants.id,
        colorNameAr: productVariants.colorNameAr,
        colorNameFr: productVariants.colorNameFr,
        colorNameEn: productVariants.colorNameEn,
        size: productVariants.size,
        quantity: inventory.quantity,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(eq(productVariants.productId, p.id));

    return {
      found: true,
      id: p.id,
      sku: p.sku,
      slug: p.slug,
      nameAr: p.nameAr,
      nameFr: p.nameFr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr,
      originalPriceMAD: Number(p.originalPrice),
      salePriceMAD: p.salePrice ? Number(p.salePrice) : null,
      effectivePriceMAD: Number(p.salePrice ?? p.originalPrice),
      images: imgs.map((i) => i.url),
      variants: vars.map((v) => ({
        variantId: v.variantId,
        colorAr: v.colorNameAr,
        colorFr: v.colorNameFr,
        colorEn: v.colorNameEn,
        size: v.size,
        stock: v.quantity ?? 0,
      })),
    };
  }

  if (name === 'check_variant_stock') {
    const productId = Number(args.productId);
    const color = typeof args.color === 'string' ? args.color.trim().toLowerCase() : '';
    const size = typeof args.size === 'string' ? args.size.trim().toLowerCase() : '';

    const vars = await db
      .select({
        variantId: productVariants.id,
        colorNameAr: productVariants.colorNameAr,
        colorNameFr: productVariants.colorNameFr,
        colorNameEn: productVariants.colorNameEn,
        size: productVariants.size,
        quantity: inventory.quantity,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(eq(productVariants.productId, productId));

    const matching = vars.filter((v) => {
      const colorMatch =
        !color ||
        v.colorNameAr.toLowerCase().includes(color) ||
        v.colorNameFr.toLowerCase().includes(color) ||
        v.colorNameEn.toLowerCase().includes(color);
      const sizeMatch = !size || v.size.toLowerCase() === size;
      return colorMatch && sizeMatch;
    });

    return {
      productId,
      matches: matching.map((m) => ({
        variantId: m.variantId,
        colorAr: m.colorNameAr,
        colorFr: m.colorNameFr,
        colorEn: m.colorNameEn,
        size: m.size,
        availableQuantity: m.quantity ?? 0,
        inStock: (m.quantity ?? 0) > 0,
      })),
    };
  }

  if (name === 'get_shipping_info') {
    const city = typeof args.city === 'string' ? args.city.trim() : '';
    const zones = await db
      .select()
      .from(shippingZones)
      .where(eq(shippingZones.isActive, true));

    if (!city) {
      return {
        zones: zones.map((z) => ({
          cityAr: z.cityNameAr,
          cityFr: z.cityNameFr,
          cityEn: z.cityNameEn,
          feeMAD: Number(z.shippingFee),
          estimatedDays: z.estimatedDays,
          freeShippingAboveMAD: z.freeShippingThreshold ? Number(z.freeShippingThreshold) : null,
        })),
      };
    }

    const q = city.toLowerCase();
    const matched =
      zones.find(
        (z) =>
          z.cityNameAr.toLowerCase().includes(q) ||
          z.cityNameFr.toLowerCase().includes(q) ||
          z.cityNameEn.toLowerCase().includes(q)
      ) || zones[zones.length - 1];

    return {
      cityAr: matched?.cityNameAr,
      cityFr: matched?.cityNameFr,
      cityEn: matched?.cityNameEn,
      feeMAD: matched ? Number(matched.shippingFee) : 45,
      estimatedDays: matched?.estimatedDays || '48-72h',
      freeShippingAboveMAD: matched?.freeShippingThreshold
        ? Number(matched.freeShippingThreshold)
        : 800,
    };
  }

  if (name === 'create_cod_order') {
    if (args.customerConfirmed !== true) {
      return {
        created: false,
        error: 'Customer confirmation is required before creating an order.',
      };
    }

    const customerName = String(args.customerName || '').trim();
    const customerPhone = normalizeMoroccanPhone(String(args.customerPhone || context.waPhone || ''));
    const city = String(args.city || '').trim();
    const address = String(args.address || '').trim();
    const notes = typeof args.notes === 'string' ? args.notes.trim() : '';
    const rawItems = Array.isArray(args.items) ? args.items : [];

    if (!customerName || !customerPhone || !city || !address || rawItems.length === 0) {
      return { created: false, error: 'Missing required customer or item information.' };
    }

    try {
      const createdOrder = await db.transaction(async (tx) => {
        let subtotal = 0;
        const resolvedItems: {
          productId: number;
          variantId: number;
          productName: string;
          colorName: string;
          size: string;
          unitPrice: number;
          quantity: number;
        }[] = [];

        for (const item of rawItems as { variantId: number; quantity: number }[]) {
          const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
          const [variant] = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, Number(item.variantId)))
            .limit(1);

          if (!variant) {
            throw new Error(`Variant ${item.variantId} does not exist`);
          }

          const [prod] = await tx
            .select()
            .from(products)
            .where(eq(products.id, variant.productId))
            .limit(1);
          if (!prod || prod.status !== 'active') {
            throw new Error('Product is not available');
          }

          // Atomic stock decrement preventing overselling
          const decremented = await tx
            .update(inventory)
            .set({
              quantity: sql`${inventory.quantity} - ${qty}`,
              updatedAt: new Date(),
            })
            .where(and(eq(inventory.variantId, variant.id), gte(inventory.quantity, qty)))
            .returning();

          if (decremented.length === 0) {
            throw new Error(`Insufficient stock for ${prod.nameAr} (${variant.colorNameAr}, ${variant.size})`);
          }

          const unitPrice = Number(variant.priceOverride ?? prod.salePrice ?? prod.originalPrice);
          subtotal += unitPrice * qty;
          resolvedItems.push({
            productId: prod.id,
            variantId: variant.id,
            productName: prod.nameAr,
            colorName: variant.colorNameAr,
            size: variant.size,
            unitPrice,
            quantity: qty,
          });
        }

        // Lookup shipping zone
        const zones = await tx.select().from(shippingZones).where(eq(shippingZones.isActive, true));
        const q = city.toLowerCase();
        const zone =
          zones.find(
            (z) =>
              z.cityNameAr.toLowerCase().includes(q) ||
              z.cityNameFr.toLowerCase().includes(q) ||
              z.cityNameEn.toLowerCase().includes(q)
          ) || zones[zones.length - 1];

        let shippingFee = zone ? Number(zone.shippingFee) : 45;
        if (zone?.freeShippingThreshold && subtotal >= Number(zone.freeShippingThreshold)) {
          shippingFee = 0;
        }

        const totalAmount = subtotal + shippingFee;

        // Upsert customer
        const existingCust = await tx
          .select()
          .from(customers)
          .where(eq(customers.phone, customerPhone))
          .limit(1);

        let customerId: number;
        if (existingCust.length > 0) {
          customerId = existingCust[0].id;
          await tx
            .update(customers)
            .set({
              fullName: customerName,
              city,
              address,
              totalOrders: sql`${customers.totalOrders} + 1`,
              totalSpent: sql`${customers.totalSpent} + ${totalAmount.toFixed(2)}`,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, customerId));
        } else {
          const [newCust] = await tx
            .insert(customers)
            .values({
              fullName: customerName,
              phone: customerPhone,
              city,
              address,
              totalOrders: 1,
              totalSpent: totalAmount.toFixed(2),
            })
            .returning();
          customerId = newCust.id;
        }

        const orderNumber = `CHM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber,
            customerId,
            customerName,
            customerPhone,
            city: zone?.cityNameAr || city,
            address,
            notes,
            paymentMethod: 'cod',
            status: 'confirmed',
            subtotal: subtotal.toFixed(2),
            shippingFee: shippingFee.toFixed(2),
            discountAmount: '0.00',
            totalAmount: totalAmount.toFixed(2),
            source: 'whatsapp_ai',
          })
          .returning();

        for (const it of resolvedItems) {
          await tx.insert(orderItems).values({
            orderId: order.id,
            productId: it.productId,
            variantId: it.variantId,
            productName: it.productName,
            colorName: it.colorName,
            size: it.size,
            unitPrice: it.unitPrice.toFixed(2),
            quantity: it.quantity,
            totalPrice: (it.unitPrice * it.quantity).toFixed(2),
          });

          await tx.insert(inventoryMovements).values({
            variantId: it.variantId,
            changeAmount: -it.quantity,
            reason: `Order ${orderNumber} via WhatsApp AI`,
            referenceType: 'order',
            referenceId: orderNumber,
          });
        }

        return order;
      });

      // Trigger notification log asynchronously
      sendOrderStatusNotification(createdOrder.id, 'order_confirmed').catch(() => {});

      return {
        created: true,
        orderNumber: createdOrder.orderNumber,
        subtotalMAD: Number(createdOrder.subtotal),
        shippingFeeMAD: Number(createdOrder.shippingFee),
        totalAmountMAD: Number(createdOrder.totalAmount),
        status: createdOrder.status,
      };
    } catch (err: unknown) {
      return {
        created: false,
        error: err instanceof Error ? err.message : 'Order creation failed',
      };
    }
  }

  if (name === 'check_order_status') {
    const orderNumber = typeof args.orderNumber === 'string' ? args.orderNumber.trim() : '';
    const phone = typeof args.phone === 'string' ? normalizeMoroccanPhone(args.phone) : '';

    if (orderNumber) {
      const [ord] = await db
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .limit(1);
      if (!ord) return { found: false };
      return {
        found: true,
        orderNumber: ord.orderNumber,
        status: ord.status,
        city: ord.city,
        totalAmountMAD: Number(ord.totalAmount),
        createdAt: ord.createdAt,
      };
    }

    if (phone) {
      const list = await db
        .select()
        .from(orders)
        .where(eq(orders.customerPhone, phone))
        .orderBy(desc(orders.createdAt))
        .limit(3);
      return {
        found: list.length > 0,
        orders: list.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmountMAD: Number(o.totalAmount),
          createdAt: o.createdAt,
        })),
      };
    }

    return { found: false };
  }

  if (name === 'escalate_to_human') {
    if (context.conversationId) {
      await db
        .update(whatsappConversations)
        .set({ aiEnabled: false, status: 'human_handoff' })
        .where(eq(whatsappConversations.id, context.conversationId));
    }
    return {
      escalated: true,
      message: 'Conversation paused for human staff review.',
    };
  }

  return { error: 'Unknown tool' };
}

export async function generateSalesAssistantReply(params: {
  customerMessage: string;
  history?: { role: 'user' | 'model'; text: string }[];
  conversationId?: number;
  waPhone?: string;
}): Promise<{ reply: string; toolsUsed: string[]; escalated: boolean }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }

  const [settings] = await db.select().from(storeSettings).limit(1);
  const storeNameAr = settings?.storeNameAr || 'الشمالي شوب';
  const storeNameEn = settings?.storeNameEn || 'CHAMALI SHOP';

  const systemInstruction = `You are the official AI Sales Concierge for ${storeNameAr} (${storeNameEn}), a Moroccan luxury fashion & lifestyle e-commerce store.

LANGUAGE RULES:
- Detect the customer's language automatically: Moroccan Darija (الدارجة المغربية), Modern Standard Arabic (العربية), French (Français), or English.
- ALWAYS reply in the EXACT SAME language/dialect as the customer. For Moroccan Darija, use warm, natural, respectful Moroccan Darija (e.g., "مرحبا بيك في الشمالي شوب!", "شحال الثمن", "واش متوفر", "بصحتك").

STRICT GROUNDING RULES (ZERO HALLUCINATION):
1. NEVER invent products, prices, discounts, colors, sizes, or stock quantities.
2. ALWAYS call 'search_products', 'get_product_details', 'check_variant_stock', or 'get_shipping_info' against the real PostgreSQL database before answering any product, price, stock, or shipping question.
3. All prices are in Moroccan Dirham (MAD / درهم). Payment is Cash on Delivery (الدفع عند الاستلام).
4. If an item/size/color has stock 0 or doesn't exist, honestly tell the customer and suggest available alternatives from the tool results.
5. To place an order, collect: Full Name, Moroccan Phone Number, City, Full Address, exact product + color + size + quantity.
6. BEFORE calling 'create_cod_order', present the complete order summary (items, color, size, quantity, subtotal, shipping fee, total MAD, city, address) and ask the customer for explicit confirmation ("واش نأكد ليك الطلب؟" / "Confirmez-vous la commande ?").
7. Only call 'create_cod_order' with customerConfirmed: true AFTER the customer confirms, and only confirm the orderNumber returned by the database.
8. If the customer asks for a human agent or has an issue you cannot resolve, call 'escalate_to_human'.
9. Keep replies concise, helpful, and natural for WhatsApp / mobile chat.`;

  // Load recent conversation history from DB if conversationId provided and history not passed
  let chatHistory = params.history || [];
  if (!params.history && params.conversationId) {
    const msgs = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.conversationId, params.conversationId))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(12);

    chatHistory = msgs
      .reverse()
      .slice(0, -1) // exclude current message if already saved
      .map((m) => ({
        role: m.direction === 'inbound' ? ('user' as const) : ('model' as const),
        text: m.body,
      }));
  }

  const contents: Array<Record<string, unknown>> = [
    ...chatHistory.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: params.customerMessage }],
    },
  ];

  const toolsUsed: string[] = [];
  let escalated = false;

  // Tool-calling loop (max 5 rounds)
  for (let step = 0; step < 5; step++) {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contents as never,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const candidateContent = response.candidates?.[0]?.content;
    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      return {
        reply: response.text?.trim() || 'مرحباً بك في الشمالي شوب! كيف يمكنني مساعدتك اليوم؟',
        toolsUsed,
        escalated,
      };
    }

    if (candidateContent) {
      contents.push(candidateContent as unknown as Record<string, unknown>);
    }

    const functionResponseParts = [];
    for (const call of functionCalls) {
      const fnName = call.name || '';
      toolsUsed.push(fnName);
      if (fnName === 'escalate_to_human') escalated = true;

      const result = await executeAssistantTool(
        fnName,
        (call.args as Record<string, unknown>) || {},
        {
          conversationId: params.conversationId,
          waPhone: params.waPhone,
        }
      );

      functionResponseParts.push({
        functionResponse: {
          id: call.id,
          name: fnName,
          response: { result },
        },
      });
    }

    contents.push({
      role: 'user',
      parts: functionResponseParts,
    });
  }

  return {
    reply: 'مرحباً بك في الشمالي شوب! المرجو توضيح طلبك وسأساعدك فوراً.',
    toolsUsed,
    escalated,
  };
}
