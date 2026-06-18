export type PackageIncludedItem = {
  itemId: number;
  quantity: number;
};

export type PackageIncludedItemWithName = PackageIncludedItem & {
  name?: string | null;
  unit?: string | null;
};

export const packageBundleSettingKey = (packageId: string) => `pricing_package_bundle:${packageId}`;

export function normalizePackageIncludedItems(value: unknown): PackageIncludedItem[] {
  if (!Array.isArray(value)) return [];

  const merged = new Map<number, number>();

  value.forEach((entry) => {
    const itemId = Number((entry as PackageIncludedItem)?.itemId);
    const quantity = Number((entry as PackageIncludedItem)?.quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) return;
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    merged.set(itemId, (merged.get(itemId) || 0) + Math.floor(quantity));
  });

  return Array.from(merged.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
}

export function parsePackageIncludedItemsSetting(value: string | null | undefined): PackageIncludedItem[] {
  if (!value) return [];

  try {
    return normalizePackageIncludedItems(JSON.parse(value));
  } catch {
    return [];
  }
}
