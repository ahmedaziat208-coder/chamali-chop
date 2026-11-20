import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../../db/index.ts';
import {
  whatsappConversations,
  whatsappMessages,
  whatsappWebhookEvents,
} from '../../db/schema.ts';
import { generateSalesAssistantReply } from '../services/geminiAssistant.ts';
import {
  getOrCreateConversation,
  sendWhatsAppMessage,
  verifyMetaWebhookSignature,
} from '../services/whatsapp.ts';

export const webhooksRouter = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Meta WhatsApp Webhook Verification (GET)
webhooksRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = req.query['hub.challenge'];

  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!configuredToken) {
    return res.status(503).send('WHATSAPP_VERIFY_TOKEN not configured');
  }

  const a = Buffer.from(token);
  const b = Buffer.from(configuredToken);
  const validToken = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (mode === 'subscribe' && validToken) {
    return res.status(200).send(String(challenge || ''));
  }

  return res.sendStatus(403);
});

// Meta WhatsApp Webhook Event Receiver (POST)
webhooksRouter.post('/whatsapp', webhookLimiter, async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const rawBody = (req as { rawBody?: Buffer }).rawBody;

  let signatureValid = false;
  if (appSecret) {
    if (!rawBody || !verifyMetaWebhookSignature(rawBody, signature)) {
      await db.insert(whatsappWebhookEvents).values({
        eventType: 'signature_rejected',
        payloadJson: req.body || {},
        signatureValid: false,
        processed: false,
        errorMessage: 'Invalid X-Hub-Signature-256 header',
      });
      return res.sendStatus(403);
    }
    signatureValid = true;
  }

  // Acknowledge webhook receipt promptly to Meta, then process
  try {
    const body = req.body as {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          field?: string;
          value?: {
            contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
            messages?: Array<{
              id: string;
              from: string;
              type: string;
              text?: { body: string };
            }>;
            statuses?: Array<{
              id: string;
              status: string;
              recipient_id: string;
            }>;
          };
        }>;
      }>;
    };

    const [eventLog] = await db
      .insert(whatsappWebhookEvents)
      .values({
        eventType: body.object || 'whatsapp_business_account',
        payloadJson: body,
        signatureValid,
        processed: false,
      })
      .returning();

    if (body.entry) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const val = change.value;
          if (!val) continue;

          // 1. Update delivery statuses for outbound messages
          if (val.statuses) {
            for (const st of val.statuses) {
              await db
                .update(whatsappMessages)
                .set({ deliveryStatus: st.status })
                .where(eq(whatsappMessages.waMessageId, st.id));
            }
          }

          // 2. Process inbound customer messages
          if (val.messages) {
            for (const msg of val.messages) {
              const contactName = val.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;
              const conv = await getOrCreateConversation(msg.from, contactName);
              const textBody = msg.text?.body || `[${msg.type}]`;

              await db.insert(whatsappMessages).values({
                conversationId: conv.id,
                waMessageId: msg.id,
                direction: 'inbound',
                senderType: 'customer',
                messageType: msg.type === 'text' ? 'text' : 'text',
                body: textBody,
                deliveryStatus: 'received',
              });

              await db
                .update(whatsappConversations)
                .set({ lastMessageAt: new Date() })
                .where(eq(whatsappConversations.id, conv.id));

              // Only auto-reply with Gemini AI if aiEnabled is true (human hasn't paused/taken over)
              if (conv.aiEnabled && msg.type === 'text' && msg.text?.body) {
                try {
                  const aiResult = await generateSalesAssistantReply({
                    customerMessage: msg.text.body,
                    conversationId: conv.id,
                    waPhone: conv.waPhone,
                  });

                  await sendWhatsAppMessage({
                    toPhone: conv.waPhone,
                    body: aiResult.reply,
                    senderType: 'ai',
                  });
                } catch (aiErr) {
                  console.error('WhatsApp AI reply failed:', aiErr);
                }
              }
            }
          }
        }
      }
    }

    await db
      .update(whatsappWebhookEvents)
      .set({ processed: true })
      .where(eq(whatsappWebhookEvents.id, eventLog.id));

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.sendStatus(500);
  }
});
