import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../../db/index.ts';
import { roles, users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    roleName: string;
  };
}

function getConfiguredAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function syncFirebaseUserToDb(decoded: DecodedIdToken) {
  const email = (decoded.email || '').toLowerCase();
  const fullName = decoded.name || email.split('@')[0] || 'User';

  // Ensure default roles exist
  await db
    .insert(roles)
    .values([
      { name: 'super_admin', description: 'Owner & full admin' },
      { name: 'admin', description: 'Store administrator' },
      { name: 'staff', description: 'Operations staff' },
      { name: 'customer', description: 'Customer' },
    ])
    .onConflictDoNothing({ target: roles.name });

  const allRoles = await db.select().from(roles);
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

  const existing = await db
    .select({
      id: users.id,
      uid: users.uid,
      email: users.email,
      roleId: users.roleId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.uid, decoded.uid))
    .limit(1);

  if (existing.length > 0) {
    const roleRow = allRoles.find((r) => r.id === existing[0].roleId);
    return {
      id: existing[0].id,
      uid: existing[0].uid,
      email: existing[0].email,
      roleName: roleRow?.name || 'customer',
      isActive: existing[0].isActive,
    };
  }

  // Determine initial role on first login
  const configuredAdmins = getConfiguredAdminEmails();
  const isEnvAdmin = email && decoded.email_verified !== false && configuredAdmins.includes(email);

  let targetRoleName = isEnvAdmin ? 'super_admin' : 'customer';

  const [inserted] = await db
    .insert(users)
    .values({
      uid: decoded.uid,
      email: email || `${decoded.uid}@chamali.local`,
      fullName,
      roleId: roleMap[targetRoleName] || roleMap['customer'],
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: email || `${decoded.uid}@chamali.local`,
        fullName,
      },
    })
    .returning();

  return {
    id: inserted.id,
    uid: inserted.uid,
    email: inserted.email,
    roleName: targetRoleName,
    isActive: inserted.isActive,
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    const dbUser = await syncFirebaseUserToDb(decoded);
    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Auth token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    const roleName = req.dbUser?.roleName || 'customer';
    const email = (req.dbUser?.email || '').toLowerCase();
    const isEnvAdmin = getConfiguredAdminEmails().includes(email);

    if (roleName === 'super_admin' || roleName === 'admin' || roleName === 'staff' || isEnvAdmin) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden: Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  });
};
