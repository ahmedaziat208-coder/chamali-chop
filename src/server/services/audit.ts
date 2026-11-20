import { Request } from 'express';
import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';

export async function logAuditEvent(params: {
  actorUid?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
  req?: Request;
}) {
  try {
    const ipAddress = params.req
      ? (params.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        params.req.ip ||
        null
      : null;

    await db.insert(auditLogs).values({
      actorUid: params.actorUid || null,
      actorEmail: params.actorEmail || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId !== undefined && params.entityId !== null ? String(params.entityId) : null,
      detailsJson: params.details || null,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}
