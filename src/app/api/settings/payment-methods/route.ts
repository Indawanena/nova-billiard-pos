import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '@/lib/api-auth';
import { db } from '@/lib/db';
import {
  normalizePaymentMethodSettings,
  paymentMethodOptions,
  serializePaymentMethodSettings,
} from '@/lib/payment-methods';
import { systemSettings } from '@/schema/settings';

const PAYMENT_METHODS_SETTING_KEY = 'payment_methods';

function buildPaymentMethodResponse(value: unknown) {
  const enabledMethods = normalizePaymentMethodSettings(value);

  return {
    enabledMethods,
    methods: paymentMethodOptions.map((method) => ({
      ...method,
      enabled: enabledMethods.includes(method.id),
    })),
  };
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) return authResult.response;

    const setting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, PAYMENT_METHODS_SETTING_KEY))
      .limit(1);

    return NextResponse.json(buildPaymentMethodResponse(setting[0]?.value));
  } catch (error) {
    console.error('Error fetching payment method settings:', error);
    return NextResponse.json({ error: 'Failed to fetch payment method settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.ok) return authResult.response;

    const body = await request.json();
    const paymentMethods = body.methods || body.enabledMethods || body.paymentMethods;
    const value = serializePaymentMethodSettings(paymentMethods);
    const response = buildPaymentMethodResponse(value);

    const existingSettings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, PAYMENT_METHODS_SETTING_KEY))
      .limit(1);

    if (existingSettings.length > 0) {
      await db
        .update(systemSettings)
        .set({
          value,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, PAYMENT_METHODS_SETTING_KEY));
    } else {
      await db.insert(systemSettings).values({
        key: PAYMENT_METHODS_SETTING_KEY,
        value,
        description: 'Enabled payment methods for cashier transactions',
        isActive: true,
      });
    }

    return NextResponse.json({
      message: 'Payment method settings updated successfully',
      ...response,
    });
  } catch (error) {
    console.error('Error updating payment method settings:', error);
    return NextResponse.json({ error: 'Failed to update payment method settings' }, { status: 500 });
  }
}
