import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pricingPackages } from "@/schema";
import { tables } from "@/schema/tables";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import {
  attachIncludedItemsToPackages,
  deletePackageIncludedItems,
  savePackageIncludedItems,
} from "@/lib/pricing-package-bundle-store";

const updatePackageSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  hourlyRate: z.string().optional(),
  perMinuteRate: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.string().optional(),
  includedItems: z.array(z.object({
    itemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [packageData] = await db
      .select()
      .from(pricingPackages)
      .where(eq(pricingPackages.id, id))
      .limit(1);

    if (!packageData) {
      return NextResponse.json(
        { error: "Pricing package not found" },
        { status: 404 }
      );
    }

    const [packageWithIncludedItems] = await attachIncludedItemsToPackages([packageData]);
    return NextResponse.json(packageWithIncludedItems);
  } catch (error) {
    console.error("Error fetching pricing package:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing package" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updatePackageSchema.parse(body);

    // Get the existing package to check category
    const [existing] = await db
      .select()
      .from(pricingPackages)
      .where(eq(pricingPackages.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Pricing package not found" },
        { status: 404 }
      );
    }

    // If this is set as default, unset other defaults in the same category
    if (validatedData.isDefault) {
      await db
        .update(pricingPackages)
        .set({ isDefault: false })
        .where(eq(pricingPackages.category, existing.category));
    }

    const { includedItems, ...packageFields } = validatedData;

    const [updated] = await db
      .update(pricingPackages)
      .set({
        ...packageFields,
        updatedAt: new Date(),
      })
      .where(eq(pricingPackages.id, id))
      .returning();

    const savedIncludedItems = includedItems !== undefined
      ? await savePackageIncludedItems(id, includedItems)
      : await attachIncludedItemsToPackages([updated]).then(([pkg]) => (pkg as any).includedItems || []);

    return NextResponse.json({ ...updated, includedItems: savedIncludedItems });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating pricing package:", error);
    return NextResponse.json(
      { error: "Failed to update pricing package" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if package is in use by any tables
    const [tablesUsingPackage] = await db
      .select({ count: count() })
      .from(tables)
      .where(eq(tables.pricingPackageId, id));

    if (tablesUsingPackage && tablesUsingPackage.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete package that is in use by tables" },
        { status: 400 }
      );
    }

    await db
      .delete(pricingPackages)
      .where(eq(pricingPackages.id, id));

    await deletePackageIncludedItems(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing package:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing package" },
      { status: 500 }
    );
  }
}
