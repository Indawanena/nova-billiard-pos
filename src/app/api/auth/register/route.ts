import { NextRequest, NextResponse } from 'next/server';
import { db, dbReady } from '@/lib/db';
import { users } from '@/schema/auth';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { isProductionLike } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    await dbReady;

    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // First user gets admin role, subsequent users get staff
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const isFirstUser = Number(userCount[0]?.count ?? 0) === 0;

    if (!isFirstUser) {
      if (isProductionLike() && process.env.ALLOW_PUBLIC_REGISTER !== 'true') {
        return NextResponse.json({ error: 'Registration is disabled' }, { status: 403 });
      }

      const session = await auth();
      if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
        role: isFirstUser ? 'admin' : 'staff',
        isActive: true,
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    return NextResponse.json({
      message: 'Account created successfully',
      user: { id: newUser.id, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
