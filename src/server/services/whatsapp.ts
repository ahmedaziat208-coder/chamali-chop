import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  orderItems,
  orders,
  storeSettings,
  whatsappConversations,
  whatsappMessages,
  whatsappTemplates,
} from '../../db/schema.ts';

export interface WhatsAppConfigStatus {
  configured: boolean;
  accessTokenSet: boolean;
  phoneNumberIdSet: boolean;
  businessAccountIdSet: boolean;
  verifyTokenSet: boolean;
  appSecretSet: boolean;
  missingVars: string[];
  webhookUrl: string;
}

export function getWhatsAppConfigStatus(): WhatsAppConfigStatus {
  const accessTokenSet = Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim());
  const phoneNumberIdSet = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  const businessAccountIdSet = Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim());
  const verifyTokenSet = Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim());
  const appSecretSet = Boolean(process.env.WHATSAPP_APP_SECRET?.trim());

  const missingVars: string[] = [];
  if (!accessTokenSet) missingVars.push('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberIdSet) missingVars.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!businessAccountIdSet) missingVars.push('WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (!verifyTokenSet) missingVars.push('WHATSAPP_VERIFY_TOKEN');
  if (!appSecretSet) missingVars.push('WHATSAPP_APP_SECRET');

  const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  return {
    configured: accessTokenSet && phoneNumberIdSet && verifyTokenSet,
    accessTokenSet,
    phoneNumberIdSet,
    businessAccountIdSet,
    verifyTokenSet,
    appSecretSet,
    missingVars,
    webhookUrl: `${baseUrl}/api/webhooks/whatsapp`,
  };
}

export function verifyMetaWebhookSignature(rawBody: Buffer, signatureHeader?: string): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!appSecret || !signatureHeader) return false;

  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const receivedSig = signatureHeader.slice(expectedPrefix.length);
  const expectedSig = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const a = Buffer.from(receivedSig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function normalizeMoroccanPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '212' + cleaned.slice(1);
  }
  return cleaned;
}

export async function getOrCreateConversation(waPhone: string, customerName?: string) {
  const normalized = normalizeMoroccanPhone(waPhone);
  const existing = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.waPhone, normalized))
    .limit(1);

  if (existing.length > 0) {
    if (customerName && !existing[0].customerName) {
      const [updated] = await db
        .update(whatsappConversations)
        .set({ customerName, lastMessageAt: new Date() })
        .where(eq(whatsappConversations.id, existing[0].id))
        .returning();
      return updated;
    }
    return existing[0];
  }

  const [created] = await db
    .insert(whatsappConversations)
    .values({
      waPhone: normalized,
      customerName: customerName || null,
      language: 'ar',
      aiEnabled: true,
      status: 'open',
      lastMessageAt: new Date(),
    })
    .returning();

  return created;
}

export async function sendWhatsAppMessage(params: {
  toPhone: string;
  body: string;
  senderType: 'ai' | 'admin' | 'system';
  messageType?: 'text' | 'image' | 'template';
  mediaUrl?: string;
  templateName?: string;
  languageCode?: string;
}) {
  const normalizedPhone = normalizeMoroccanPhone(params.toPhone);
  const conv = await getOrCreateConversation(normalizedPhone);

  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  let waMessageId: string | null = null;
  let deliveryStatus = 'sent';
  let cloudApiDelivered = false;
  let apiError: string | null = null;

  if (token && phoneNumberId) {
    try {
      const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
      let payload: Record<string, unknown>;

      if (params.messageType === 'image' && params.mediaUrl) {
        const absoluteMedia = params.mediaUrl.startsWith('http')
          ? params.mediaUrl
          : `${(process.env.APP_URL || '').replace(/\/$/, '')}${params.mediaUrl}`;
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedPhone,
          type: 'image',
          image: {
            link: absoluteMedia,
            caption: params.body,
          },
        };
      } else if (params.messageType === 'template' && params.templateName) {
        payload = {
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: params.languageCode || 'ar' },
          },
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: params.body,
          },
        };
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await resp.json()) as {
        messages?: { id: string }[];
        error?: { message: string };
      };

      if (resp.ok && data.messages?.[0]?.id) {
        waMessageId = data.messages[0].id;
        cloudApiDelivered = true;
        deliveryStatus = 'sent';
      } else {
        apiError = data.error?.message || `Meta Cloud API HTTP ${resp.status}`;
        deliveryStatus = 'failed';
      }
    } catch (err: unknown) {
      apiError = err instanceof Error ? err.message : 'Network error calling Meta Graph API';
      deliveryStatus = 'failed';
    }
  } else {
    deliveryStatus = 'pending_config';
    apiError = 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured';
  }

  // Persist message in PostgreSQL conversation history
  const [savedMsg] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: conv.id,
      waMessageId,
      direction: 'outbound',
      senderType: params.senderType,
      messageType: params.messageType || 'text',
      body: params.body,
      mediaUrl: params.mediaUrl || null,
      deliveryStatus,
    })
    .returning();

  await db
    .update(whatsappConversations)
    .set({
      lastMessageAt: new Date(),
      ...(params.senderType === 'admin' ? { aiEnabled: false, status: 'human_handoff' } : {}),
    })
    .where(eq(whatsappConversations.id, conv.id));

  return {
    message: savedMsg,
    cloudApiDelivered,
    apiError,
  };
}

export async function sendOrderStatusNotification(
  orderId: number,
  eventKey:
    | 'order_confirmed'
    | 'order_preparing'
    | 'order_shipped'
    | 'order_delivered'
    | 'order_cancelled'
) {
  const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!ord) return { sent: false, reason: 'Order not found' };

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const [tpl] = await db
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.eventKey, eventKey))
    .limit(1);

  const [settings] = await db.select().from(storeSettings).limit(1);
  const storeName = settings?.storeNameAr || 'الشمالي شوب';

  const itemsSummary = items
    .map((it) => `${it.productName} (${it.colorName} / ${it.size}) × ${it.quantity}`)
    .join('، ');

  const rawBody =
    tpl?.bodyAr ||
    `مرحباً {{customer_name}}، تحديث بخصوص طلبك #{{order_number}} من ${storeName}. المجموع: {{total_amount}} درهم.`;

  const rendered = rawBody
    .replaceAll('{{customer_name}}', ord.customerName)
    .replaceAll('{{order_number}}', ord.orderNumber)
    .replaceAll('{{items_summary}}', itemsSummary)
    .replaceAll('{{shipping_fee}}', String(ord.shippingFee))
    .replaceAll('{{total_amount}}', String(ord.totalAmount))
    .replaceAll('{{address}}', `${ord.city} - ${ord.address}`);

  return sendWhatsAppMessage({
    toPhone: ord.customerPhone,
    body: rendered,
    senderType: 'system',
    messageType: 'text',
  });
}
