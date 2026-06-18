import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fnbItems } from '@/schema/fnb';
import { requireAdmin } from '@/lib/api-auth';

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.ok) return authResult.response;

    const body = await request.json();
    const { stockQuantity } = body;

    if (stockQuantity == null || isNaN(Number(stockQuantity))) {
      return NextResponse.json({ error: 'stockQuantity is required' }, { status: 400 });
    }

    // Update all items to the specified stock quantity
    await db.update(fnbItems)
      .set({ stockQuantity: Number(stockQuantity), updatedAt: new Date() });

    return NextResponse.json({ message: `All items updated to stock ${stockQuantity}` });
  } catch (error) {
    console.error('Failed to bulk update stock:', error);
    return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
  }
}
