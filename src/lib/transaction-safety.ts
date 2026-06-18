export function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function hasExistingPayment(entity: { paymentId?: number | null }) {
  return entity.paymentId !== undefined && entity.paymentId !== null;
}

export function assertUnpaid(entity: { paymentId?: number | null }, label: string) {
  if (hasExistingPayment(entity)) {
    throw new Error(`${label} already has a payment`);
  }
}

export function nextStockQuantity(currentStock: number | null | undefined, quantity: number) {
  const stock = currentStock ?? 0;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  if (stock < quantity) {
    throw new Error('Insufficient stock');
  }
  return stock - quantity;
}

export function requireActiveStatus(entity: { status?: string | null }, expectedStatus: string, label: string) {
  if (entity.status !== expectedStatus) {
    throw new Error(`${label} is not ${expectedStatus}`);
  }
}
