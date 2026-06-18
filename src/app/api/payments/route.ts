import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payments } from '@/schema/payments';
import { tableSessions, tables } from '@/schema/tables';
import { fnbOrders, fnbOrderItems, fnbItems, fnbCategories, staff } from '@/schema/fnb';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { isPaymentMethodId, normalizePaymentMethodSettings } from '@/lib/payment-methods';
import { assertUnpaid, parsePositiveInt } from '@/lib/transaction-safety';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sessionId = searchParams.get('sessionId');
    const orderId = searchParams.get('orderId');

    let paymentsList: any[];

    if (status) {
      paymentsList = await db.select().from(payments)
        .where(eq(payments.status, status))
        .orderBy(payments.createdAt);
    } else if (sessionId) {
      // Query tableSessions to find the paymentId, then get the payment
      const sessionWithPayment = await db.select({
        paymentId: tableSessions.paymentId
      }).from(tableSessions)
      .where(eq(tableSessions.id, parseInt(sessionId)))
      .limit(1);

      if (sessionWithPayment.length > 0 && sessionWithPayment[0].paymentId) {
        paymentsList = await db.select().from(payments)
          .where(eq(payments.id, sessionWithPayment[0].paymentId))
          .orderBy(payments.createdAt);
      } else {
        paymentsList = [];
      }
    } else if (orderId) {
      // Query fnbOrders to find the paymentId, then get the payment
      const orderWithPayment = await db.select({
        paymentId: fnbOrders.paymentId
      }).from(fnbOrders)
      .where(eq(fnbOrders.id, parseInt(orderId)))
      .limit(1);

      if (orderWithPayment.length > 0 && orderWithPayment[0].paymentId) {
        paymentsList = await db.select().from(payments)
          .where(eq(payments.id, orderWithPayment[0].paymentId))
          .orderBy(payments.createdAt);
      } else {
        paymentsList = [];
      }
    } else {
      paymentsList = await db.select().from(payments).orderBy(sql`${payments.createdAt} desc`);
    }

    // Fetch related data for each payment
    const paymentsWithRelations = await Promise.all(
      paymentsList.map(async (payment) => {
        // Fetch table sessions related to this payment
        const relatedTableSessions = await db
          .select({
            id: tableSessions.id,
            tableId: tableSessions.tableId,
            tableName: tables.name,
            customerName: tableSessions.customerName,
            customerPhone: tableSessions.customerPhone,
            startTime: tableSessions.startTime,
            endTime: tableSessions.endTime,
            plannedDuration: tableSessions.plannedDuration,
            actualDuration: tableSessions.actualDuration,
            totalCost: tableSessions.totalCost,
            status: tableSessions.status,
            sessionRating: tableSessions.sessionRating,
            fnbOrderCount: tableSessions.fnbOrderCount,
          })
          .from(tableSessions)
          .leftJoin(tables, eq(tableSessions.tableId, tables.id))
          .where(eq(tableSessions.paymentId, payment.id));

        // Fetch F&B orders related to this payment
        const relatedFnbOrders = await db
          .select({
            id: fnbOrders.id,
            orderNumber: fnbOrders.orderNumber,
            tableId: fnbOrders.tableId,
            tableName: tables.name,
            customerName: fnbOrders.customerName,
            customerPhone: fnbOrders.customerPhone,
            subtotal: fnbOrders.subtotal,
            tax: fnbOrders.tax,
            total: fnbOrders.total,
            status: fnbOrders.status,
            staffId: fnbOrders.staffId,
            staffName: staff.name,
            notes: fnbOrders.notes,
            createdAt: fnbOrders.createdAt,
          })
          .from(fnbOrders)
          .leftJoin(tables, eq(fnbOrders.tableId, tables.id))
          .leftJoin(staff, eq(fnbOrders.staffId, staff.id))
          .where(eq(fnbOrders.paymentId, payment.id));

        // For each F&B order, fetch the order items
        const fnbOrdersWithItems = await Promise.all(
          relatedFnbOrders.map(async (order) => {
            const orderItems = await db
              .select({
                id: fnbOrderItems.id,
                itemId: fnbOrderItems.itemId,
                itemName: fnbItems.name,
                itemDescription: fnbItems.description,
                categoryName: fnbCategories.name,
                quantity: fnbOrderItems.quantity,
                unitPrice: fnbOrderItems.unitPrice,
                subtotal: fnbOrderItems.subtotal,
                unit: fnbItems.unit,
              })
              .from(fnbOrderItems)
              .leftJoin(fnbItems, eq(fnbOrderItems.itemId, fnbItems.id))
              .leftJoin(fnbCategories, eq(fnbItems.categoryId, fnbCategories.id))
              .where(eq(fnbOrderItems.orderId, order.id));

            return {
              ...order,
              items: orderItems,
            };
          })
        );

        return {
          ...payment,
          tableSessions: relatedTableSessions,
          fnbOrders: fnbOrdersWithItems,
        };
      })
    );

    return NextResponse.json(paymentsWithRelations);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerName,
      customerPhone,
      tableAmount = 0,
      fnbAmount = 0,
      discountAmount = 0,
      taxAmount = 0,
      totalAmount,
      paymentMethods = [],
      staffId,
      // Legacy support for existing integrations
      sessionId,
      orderId,
      amount,
      currency = 'IDR',
      paymentMethod
    } = body;

    // Support both new consolidated format and legacy format
    const finalTotalAmount = totalAmount || amount;
    const finalCustomerName = customerName || 'Walk-in Customer';

    if (!finalTotalAmount) {
      return NextResponse.json({
        error: 'Total amount is required'
      }, { status: 400 });
    }

    const primaryPaymentMethod = normalizePaymentMethodSettings(
      paymentMethods.length > 0 ? paymentMethods : [paymentMethod || 'cash']
    )[0];
    const legacyPaymentMethod = isPaymentMethodId(paymentMethod) ? paymentMethod : primaryPaymentMethod;

    const parsedSessionId = parsePositiveInt(sessionId);
    const parsedOrderId = parsePositiveInt(orderId);
    const parsedTableId = parsePositiveInt(body.tableId);

    // Generate transaction numbers
    const transactionNumber = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const midtransOrderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const newPayment = await db.transaction(async (tx) => {
      if (parsedSessionId) {
        const [targetSession] = await tx.select({ id: tableSessions.id, paymentId: tableSessions.paymentId })
          .from(tableSessions)
          .where(eq(tableSessions.id, parsedSessionId))
          .limit(1);

        if (!targetSession) throw new Error('Session not found');
        assertUnpaid(targetSession, 'Session');
      }

      if (parsedOrderId) {
        const [targetOrder] = await tx.select({ id: fnbOrders.id, paymentId: fnbOrders.paymentId })
          .from(fnbOrders)
          .where(eq(fnbOrders.id, parsedOrderId))
          .limit(1);

        if (!targetOrder) throw new Error('Order not found');
        assertUnpaid(targetOrder, 'Order');
      }

      const [payment] = await tx.insert(payments).values({
        transactionNumber,
        customerName: finalCustomerName,
        customerPhone: customerPhone || null,
        tableAmount: tableAmount.toString(),
        fnbAmount: fnbAmount.toString(),
        discountAmount: discountAmount.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: finalTotalAmount.toString(),
        paymentMethods: JSON.stringify(paymentMethods.length > 0 ? paymentMethods : [{ type: legacyPaymentMethod, amount: finalTotalAmount }]),
        staffId: staffId || null,
        status: 'pending',
        transactionId,
        midtransOrderId,
        amount: finalTotalAmount.toString(),
        currency,
        paymentMethod: legacyPaymentMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const paymentId = payment.id;

      if (parsedSessionId) {
        const updated = await tx.update(tableSessions)
          .set({ paymentId })
          .where(and(eq(tableSessions.id, parsedSessionId), isNull(tableSessions.paymentId)))
          .returning({ id: tableSessions.id });
        if (updated.length === 0) throw new Error('Session already has a payment');
      }

      if (parsedOrderId) {
        const updated = await tx.update(fnbOrders)
          .set({ paymentId })
          .where(and(eq(fnbOrders.id, parsedOrderId), isNull(fnbOrders.paymentId)))
          .returning({ id: fnbOrders.id });
        if (updated.length === 0) throw new Error('Order already has a payment');
      }

      if (parsedTableId) {
        await tx.update(fnbOrders)
          .set({ paymentId, status: 'billed' })
          .where(and(
            eq(fnbOrders.tableId, parsedTableId),
            eq(fnbOrders.status, 'pending'),
            isNull(fnbOrders.paymentId)
          ));
      }

      return payment;
    });

    return NextResponse.json({
      ...newPayment,
      message: 'Payment created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment';
    if (message.includes('already has a payment')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
