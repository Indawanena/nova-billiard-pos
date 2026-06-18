/**
 * @jest-environment jsdom
 */

import { TextEncoder, TextDecoder } from 'util';

(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;
const NodeFetchResponse = require('node-fetch').Response;
(globalThis as any).Response = class Response extends NodeFetchResponse {
  static json(data: unknown, init?: ResponseInit) {
    return new NodeFetchResponse(JSON.stringify(data), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string> | undefined) },
    });
  }
};

import { requireAuth, requireRole, requireAdmin, requireStaffOrAdmin, isProductionLike } from './api-auth';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

const { auth } = require('@/lib/auth');


async function jsonOf(response: Response) {
  return response.json();
}

describe('api auth guards', () => {
  const oldEnv = process.env.NODE_ENV;
  const oldVercel = process.env.VERCEL;

  afterEach(() => {
    jest.resetAllMocks();
    Object.defineProperty(process.env, 'NODE_ENV', { value: oldEnv, configurable: true });
    if (oldVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = oldVercel;
  });

  it('returns 401 when session is missing', async () => {
    auth.mockResolvedValue(null);

    const result = await requireAuth();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(jsonOf(result.response as unknown as Response)).resolves.toEqual({ error: 'Unauthorized' });
    }
  });

  it('allows authenticated session', async () => {
    auth.mockResolvedValue({ user: { id: '1', role: 'staff' } });

    const result = await requireAuth();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe('staff');
  });

  it('returns 403 when role is not allowed', async () => {
    auth.mockResolvedValue({ user: { id: '1', role: 'staff' } });

    const result = await requireRole(['admin']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(jsonOf(result.response as unknown as Response)).resolves.toEqual({ error: 'Forbidden' });
    }
  });

  it('allows admin helper for admin only', async () => {
    auth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    await expect(requireAdmin()).resolves.toMatchObject({ ok: true, role: 'admin' });
  });

  it('allows staff or admin helper for cashier role', async () => {
    auth.mockResolvedValue({ user: { id: '1', role: 'cashier' } });
    await expect(requireStaffOrAdmin()).resolves.toMatchObject({ ok: true, role: 'cashier' });
  });

  it('detects production-like Vercel environment', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    process.env.VERCEL = '1';
    expect(isProductionLike()).toBe(true);
  });
});
