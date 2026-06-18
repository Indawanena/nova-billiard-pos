import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tableSessions } from '@/schema/tables';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { calculateAddedTimePlan } from '@/lib/session-duration';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const body = await request.json();
    const minutes = Number(body.minutes);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json(
        { error: 'Added minutes must be greater than 0' },
        { status: 400 }
      );
    }

    const [currentSession] = await db
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.id, sessionId), eq(tableSessions.status, 'active')))
      .limit(1);

    if (!currentSession) {
      return NextResponse.json({ error: 'Active session not found' }, { status: 404 });
    }

    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(currentSession.startTime).getTime()) / (1000 * 60)
    );

    const plan = calculateAddedTimePlan({
      currentPlannedDuration: currentSession.plannedDuration || 0,
      elapsedMinutes,
      addedMinutes: minutes,
    });

    const [updatedSession] = await db
      .update(tableSessions)
      .set({
        plannedDuration: plan.plannedDuration,
      })
      .where(eq(tableSessions.id, sessionId))
      .returning();

    return NextResponse.json({
      ...updatedSession,
      previousPlannedDuration: currentSession.plannedDuration || 0,
      addedMinutes: plan.addedMinutes,
      wasOpenSession: plan.wasOpenSession,
      message: 'Session time added successfully',
    });
  } catch (error) {
    console.error('Error adding session time:', error);
    return NextResponse.json({ error: 'Failed to add session time' }, { status: 500 });
  }
}
