"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SessionStatus, TableStatus, PaymentMethod } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect("/login");
  return userId;
}

export async function startTableSession(formData: FormData) {
  const userId = await requireUserId();
  const tableId = String(formData.get("tableId") ?? "");

  if (!tableId) throw new Error("tableId is required");

  await prisma.$transaction(async (tx) => {
    const table = await tx.billiardTable.findUnique({ where: { id: tableId } });
    if (!table) throw new Error("Meja tidak ditemukan");
    if (table.status !== TableStatus.AVAILABLE) throw new Error("Meja tidak tersedia");

    const activeSession = await tx.tableSession.findFirst({
      where: { tableId, status: SessionStatus.ACTIVE },
    });
    if (activeSession) throw new Error("Meja masih punya sesi aktif");

    await tx.tableSession.create({
      data: {
        tableId,
        openedById: userId,
        status: SessionStatus.ACTIVE,
      },
    });

    await tx.billiardTable.update({
      where: { id: tableId },
      data: { status: TableStatus.OCCUPIED },
    });
  });

  revalidatePath("/");
}

export async function checkoutTableSession(formData: FormData) {
  const userId = await requireUserId();
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!sessionId) throw new Error("sessionId is required");

  await prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true, orders: { include: { items: true } } },
    });

    if (!session) throw new Error("Sesi tidak ditemukan");
    if (session.status !== SessionStatus.ACTIVE) throw new Error("Sesi sudah tidak aktif");

    const endedAt = new Date();
    const totalMinutes = Math.max(1, Math.ceil((endedAt.getTime() - session.startedAt.getTime()) / 60000));
    const tableAmount = Math.ceil((totalMinutes / 60) * Number(session.table.hourlyRate));
    const fnbAmount = session.orders.reduce((sum, order) => sum + Number(order.subtotal), 0);
    const totalAmount = tableAmount + fnbAmount;

    await tx.tableSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        closedById: userId,
        status: SessionStatus.CLOSED,
        totalMinutes,
        tableAmount,
      },
    });

    if (totalAmount > 0) {
      await tx.payment.create({
        data: {
          sessionId,
          userId,
          method: PaymentMethod.CASH,
          amount: totalAmount,
        },
      });
    }

    await tx.billiardTable.update({
      where: { id: session.tableId },
      data: { status: TableStatus.AVAILABLE },
    });
  });

  revalidatePath("/");
}
