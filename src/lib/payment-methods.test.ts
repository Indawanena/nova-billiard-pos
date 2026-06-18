import {
  DEFAULT_PAYMENT_METHODS,
  isPaymentMethodId,
  normalizePaymentMethodSettings,
  paymentMethodOptions,
  serializePaymentMethodSettings,
} from './payment-methods';

describe('payment method settings', () => {
  it('uses the five supported methods by default', () => {
    expect(DEFAULT_PAYMENT_METHODS).toEqual(['cash', 'qr', 'debit', 'credit', 'bank_transfer', 'mandiri']);
  });

  it('keeps only known enabled methods from saved settings', () => {
    expect(
      normalizePaymentMethodSettings([
        { id: 'cash', enabled: true },
        { id: 'qr', enabled: false },
        { type: 'debit', amount: 25000 },
        { id: 'voucher', enabled: true },
        { id: 'credit', enabled: true },
        { id: 'mandiri', enabled: true },
      ])
    ).toEqual(['cash', 'debit', 'credit', 'mandiri']);
  });

  it('falls back to defaults when saved settings disable every method', () => {
    expect(
      normalizePaymentMethodSettings([
        { id: 'cash', enabled: false },
        { id: 'qr', enabled: false },
      ])
    ).toEqual(DEFAULT_PAYMENT_METHODS);
  });

  it('parses legacy JSON arrays and serializes normalized settings', () => {
    const savedValue = JSON.stringify(['cash', 'bank_transfer', 'mandiri', 'unknown']);

    expect(normalizePaymentMethodSettings(savedValue)).toEqual(['cash', 'bank_transfer', 'mandiri']);
    expect(serializePaymentMethodSettings(['qr', 'mandiri', 'cash', 'qr'])).toBe(JSON.stringify(['cash', 'qr', 'mandiri']));
  });

  it('exposes labels for each available method', () => {
    expect(paymentMethodOptions).toEqual([
      { id: 'cash', label: 'Cash' },
      { id: 'qr', label: 'QR' },
      { id: 'debit', label: 'Debit' },
      { id: 'credit', label: 'Credit' },
      { id: 'bank_transfer', label: 'Bank Transfer' },
      { id: 'mandiri', label: 'Mandiri' },
    ]);
  });

  it('validates payment method ids', () => {
    expect(isPaymentMethodId('bank_transfer')).toBe(true);
    expect(isPaymentMethodId('mandiri')).toBe(true);
    expect(isPaymentMethodId('voucher')).toBe(false);
  });
});
