import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fnbItems, systemSettings } from '@/schema';
import {
  PackageIncludedItemWithName,
  normalizePackageIncludedItems,
  packageBundleSettingKey,
  parsePackageIncludedItemsSetting,
} from '@/lib/pricing-package-bundles';

export async function getPackageIncludedItems(packageId: string): Promise<PackageIncludedItemWithName[]> {
  const key = packageBundleSettingKey(packageId);
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  const includedItems = parsePackageIncludedItemsSetting(setting?.value);
  if (includedItems.length === 0) return [];

  const itemIds = includedItems.map((item) => item.itemId);
  const items = await db
    .select({
      id: fnbItems.id,
      name: fnbItems.name,
      unit: fnbItems.unit,
    })
    .from(fnbItems)
    .where(inArray(fnbItems.id, itemIds));

  const itemMap = new Map(items.map((item) => [item.id, item]));

  return includedItems
    .filter((item) => itemMap.has(item.itemId))
    .map((item) => ({
      ...item,
      name: itemMap.get(item.itemId)?.name || null,
      unit: itemMap.get(item.itemId)?.unit || null,
    }));
}

export async function attachIncludedItemsToPackages<T extends { id: string }>(packages: T[]) {
  const packagesWithIncludedItems = await Promise.all(
    packages.map(async (pkg) => ({
      ...pkg,
      includedItems: await getPackageIncludedItems(pkg.id),
    }))
  );

  return packagesWithIncludedItems;
}

export async function savePackageIncludedItems(packageId: string, value: unknown) {
  const normalized = normalizePackageIncludedItems(value);
  const key = packageBundleSettingKey(packageId);
  const serialized = JSON.stringify(normalized);

  const [existing] = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(systemSettings)
      .set({
        value: serialized,
        description: 'Included F&B items for pricing package',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, key));
    return normalized;
  }

  await db.insert(systemSettings).values({
    key,
    value: serialized,
    description: 'Included F&B items for pricing package',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return normalized;
}

export async function deletePackageIncludedItems(packageId: string) {
  await db
    .delete(systemSettings)
    .where(eq(systemSettings.key, packageBundleSettingKey(packageId)));
}
