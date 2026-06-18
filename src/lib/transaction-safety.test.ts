import { assertUnpaid, hasExistingPayment, nextStockQuantity, parsePositiveInt, requireActiveStatus } from './transaction-safety';

describe('transaction safety helpers', () => {
  it('parses positive integer ids only', () => {
    expect(parsePositiveInt('12')).toBe(12);
    expect(parsePositiveInt(3)).toBe(3);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parsePositiveInt('-1')).toBeNull();
    expect(parsePositiveInt('abc')).toBeNull();
    expect(parsePositiveInt(null)).toBeNull();
  });

  it('detects existing payment links', () => {
    expect(hasExistingPayment({ paymentId: 1 })).toBe(true);
    expect(hasExistingPayment({ paymentId: null })).toBe(false);
    expect(hasExistingPayment({})).toBe(false);
  });

  it('blocks duplicate payment links', () => {
    expect(() => assertUnpaid({ paymentId: 7 }, 'Session')).toThrow('Session already has a payment');
    expect(() => assertUnpaid({ paymentId: null }, 'Session')).not.toThrow();
  });

  it('requires expected active state', () => {
    expect(() => requireActiveStatus({ status: 'completed' }, 'active', 'Session')).toThrow('Session is not active');
    expect(() => requireActiveStatus({ status: 'active' }, 'active', 'Session')).not.toThrow();
  });

  it('prevents negative stock deduction', () => {
    expect(nextStockQuantity(10, 3)).toBe(7);
    expect(() => nextStockQuantity(2, 3)).toThrow('Insufficient stock');
    expect(() => nextStockQuantity(2, 0)).toThrow('Quantity must be greater than 0');
  });
});
