import { auth } from '@/lib/auth';

export type AppRole = 'admin' | 'staff' | 'cashier' | string;

export type AuthResult =
  | { ok: true; session: any; role?: AppRole }
  | { ok: false; response: Response };

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      response: jsonError('Unauthorized', 401),
    };
  }

  return { ok: true, session, role: session.user?.role };
}

export async function requireRole(allowedRoles: AppRole[]): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  const role = result.role;
  if (!role || !allowedRoles.includes(role)) {
    return {
      ok: false,
      response: jsonError('Forbidden', 403),
    };
  }

  return result;
}

export async function requireAdmin(): Promise<AuthResult> {
  return requireRole(['admin']);
}

export async function requireStaffOrAdmin(): Promise<AuthResult> {
  return requireRole(['admin', 'staff', 'cashier']);
}

export function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}
