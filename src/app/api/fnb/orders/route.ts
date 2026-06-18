import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fnbOrders, fnbOrderItems, fnbItems, orderAnalytics } from '@/schema/fnb';
import { eq } from 'drizzle-orm';
import { nextStockQuantity } from '@/lib/transaction-safety';
import { auth } from '@/lib/auth';
import { payments } from '@/schema';
import { normalizePaymentMethodSettings } from '@/lib/payment-methods';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    let orders;

    if (status) {
      orders = await db.select().from(fnbOrders)
        .where(eq(fnbOrders.status, status))
        .orderBy(fnbOrders.createdAt)
        .limit(limit ? parseInt(limit) : 100);
    } else {
      orders = await db.select().from(fnbOrders)
        .orderBy(fnbOrders.createdAt)
        .limit(limit ? parseInt(limit) : 100);
    }
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
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
      context,
      customerName,
      customerPhone,
      tableId,
      staffId,
      subtotal,
      tax,
      total,
      notes,
      paymentMethods = [],
      items
    } = body;

    if (!customerName || !subtotal || !total || !items || items.length === 0 || !staffId) {
      return NextResponse.json({
        error: 'Customer name, subtotal, total, items, and staff ID are required'
      }, { status: 400 });
    }

    // Validate context-specific requirements
    if (context === 'table_session' && !tableId) {
      return NextResponse.json({
        error: 'Table ID is required for table session orders'
      }, { status: 400 });
    }

    // Generate order number with context prefix
    const contextPrefix = context === 'standalone' ? 'FNB' :
                         context === 'waiting' ? 'DRAFT' : 'TABLE';
    const orderNumber = `${contextPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Determine order status based on context
    const orderStatus = context === 'waiting' ? 'draft' : 'pending';

    const { newOrder, paymentRecord } = await db.transaction(async (tx) => {
      const [createdOrder] = await tx.insert(fnbOrders).values({
        orderNumber,
        customerName,
        customerPhone: customerPhone || null,
        tableId: tableId || null,
        staffId: parseInt(staffId),
        subtotal: subtotal.toString(),
        tax: tax?.toString() || '0',
        total: total.toString(),
        status: orderStatus,
        notes: notes || null,
      }).returning();

      const orderId = createdOrder.id;
      let totalItemCount = 0;

      for (const item of items) {
        const { itemId, quantity, unitPrice, subtotal: itemSubtotal } = item;

        await tx.insert(fnbOrderItems).values({
          orderId,
          itemId,
          quantity,
          unitPrice: unitPrice.toString(),
          subtotal: itemSubtotal.toString(),
        });

        totalItemCount += quantity;

        if (orderStatus !== 'draft') {
          const currentItem = await tx.select({ id: fnbItems.id, stockQuantity: fnbItems.stockQuantity })
            .from(fnbItems)
            .where(eq(fnbItems.id, itemId))
            .limit(1);

          if (currentItem.length === 0) throw new Error('F&B item not found');
          const newStock = nextStockQuantity(currentItem[0].stockQuantity, quantity);

          await tx.update(fnbItems)
            .set({
              stockQuantity: newStock,
              updatedAt: new Date(),
            })
            .where(eq(fnbItems.id, itemId));
        }
      }

      const orderDate = new Date();
      await tx.insert(orderAnalytics).values({
        orderId,
        orderDate,
        dayOfWeek: orderDate.getDay(),
        hourOfDay: orderDate.getHours(),
        orderValue: total.toString(),
        itemCount: totalItemCount,
      });

      let paymentRecord = null;
      if (context === 'standalone') {
        const transactionNumber = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const primaryPaymentMethod = normalizePaymentMethodSettings(paymentMethods)[0];

        const [newPayment] = await tx.insert(payments).values({
          transactionNumber,
          customerName,
          customerPhone: customerPhone || null,
          tableAmount: '0',
          fnbAmount: total.toString(),
          discountAmount: '0',
          taxAmount: tax?.toString() || '0',
          totalAmount: total.toString(),
          paymentMethods: JSON.stringify([{ type: primaryPaymentMethod, amount: total.toString() }]),
          staffId: parseInt(staffId),
          status: 'pending',
          transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          midtransOrderId: `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          amount: total.toString(),
          currency: 'IDR',
          paymentMethod: primaryPaymentMethod,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        paymentRecord = newPayment;

        await tx.update(fnbOrders)
          .set({ paymentId: paymentRecord.id, status: 'billed' })
          .where(eq(fnbOrders.id, orderId));
      }

      return { newOrder: createdOrder, paymentRecord };
    });

    return NextResponse.json({
      ...newOrder,
      message: `${context === 'waiting' ? 'Draft order' : 'Order'} created successfully`,
      context,
      paymentRecord: paymentRecord ? {
        id: paymentRecord.id,
        transactionNumber: paymentRecord.transactionNumber,
        status: paymentRecord.status
      } : null
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order';
    if (message === 'Insufficient stock' || message === 'Quantity must be greater than 0') {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
