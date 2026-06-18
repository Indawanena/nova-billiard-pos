export const paymentMethodOptions = [
  { id: 'cash', label: 'Cash' },
  { id: 'qr', label: 'QR' },
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'mandiri', label: 'Mandiri' },
] as const;

export type PaymentMethodId = (typeof paymentMethodOptions)[number]['id'];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodId[] = paymentMethodOptions.map(
  (method) => method.id
);

type SavedPaymentMethod = PaymentMethodId | { id?: string; type?: string; enabled?: boolean };

function parseSavedPaymentMethods(value: unknown): SavedPaymentMethod[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

export function normalizePaymentMethodSettings(value: unknown): PaymentMethodId[] {
  const savedMethods = parseSavedPaymentMethods(value);
  const enabledIds = new Set<string>();

  for (const method of savedMethods) {
    if (typeof method === 'string') {
      enabledIds.add(method);
      continue;
    }

    const methodId = method?.id || method?.type;
    if (method && method.enabled !== false && methodId) {
      enabledIds.add(methodId);
    }
  }

  const normalized = DEFAULT_PAYMENT_METHODS.filter((methodId) => enabledIds.has(methodId));
  return normalized.length > 0 ? normalized : DEFAULT_PAYMENT_METHODS;
}

export function serializePaymentMethodSettings(value: unknown): string {
  return JSON.stringify(normalizePaymentMethodSettings(value));
}

export function isPaymentMethodId(value: string | null | undefined): value is PaymentMethodId {
  return DEFAULT_PAYMENT_METHODS.includes(value as PaymentMethodId);
}

export function getPaymentMethodLabel(methodId: string | null | undefined): string {
  return paymentMethodOptions.find((method) => method.id === methodId)?.label || methodId || '';
}
