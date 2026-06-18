import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tableSessions } from '@/schema/tables';
import { pricingPackages } from '@/schema/pricing-packages';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Returns all active table sessions with pricing info so the POS table list
// can render live billiard time + running cost without N separate requests.
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeSessions = await db
      .select({
        id: tableSessions.id,
        tableId: tableSessions.tableId,
        customerName: tableSessions.customerName,
        startTime: tableSessions.startTime,
        plannedDuration: tableSessions.plannedDuration,
        durationType: tableSessions.durationType,
        fnbOrderCount: tableSessions.fnbOrderCount,
        pricingPackage: {
          id: pricingPackages.id,
          name: pricingPackages.name,
          category: pricingPackages.category,
          hourlyRate: pricingPackages.hourlyRate,
          perMinuteRate: pricingPackages.perMinuteRate,
        },
      })
      .from(tableSessions)
      .leftJoin(pricingPackages, eq(tableSessions.pricingPackageId, pricingPackages.id))
      .where(eq(tableSessions.status, 'active'));

    return NextResponse.json(activeSessions);
  } catch (error) {
    console.error('Failed to fetch active sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch active sessions' }, { status: 500 });
  }
}
