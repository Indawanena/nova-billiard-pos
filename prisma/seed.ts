import "dotenv/config";
import { PrismaClient, ProductCategory, TableStatus, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const tables = Array.from({ length: 12 }, (_, index) => {
  const n = index + 1;
  return {
    code: `T${String(n).padStart(2, "0")}`,
    name: `Meja ${String(n).padStart(2, "0")}`,
    status: TableStatus.AVAILABLE,
    hourlyRate: n <= 6 ? 35000 : 45000,
    sortOrder: n,
  };
});

const products = [
  { sku: "DRK-001", name: "Es Teh Manis", category: ProductCategory.BEVERAGE, price: 8000, stock: 100 },
  { sku: "DRK-002", name: "Kopi Hitam", category: ProductCategory.BEVERAGE, price: 12000, stock: 80 },
  { sku: "DRK-003", name: "Air Mineral", category: ProductCategory.BEVERAGE, price: 6000, stock: 120 },
  { sku: "DRK-004", name: "Soda", category: ProductCategory.BEVERAGE, price: 15000, stock: 60 },
  { sku: "FOD-001", name: "Mie Goreng", category: ProductCategory.FOOD, price: 18000, stock: 40 },
  { sku: "FOD-002", name: "Nasi Goreng", category: ProductCategory.FOOD, price: 25000, stock: 35 },
  { sku: "FOD-003", name: "Kentang Goreng", category: ProductCategory.FOOD, price: 22000, stock: 45 },
  { sku: "FOD-004", name: "Chicken Nugget", category: ProductCategory.FOOD, price: 28000, stock: 30 },
  { sku: "OTH-001", name: "Rokok", category: ProductCategory.OTHER, price: 35000, stock: 25 },
];

async function main() {
  const passwordHash = await bcrypt.hash("admin12345", 12);

  await prisma.user.upsert({
    where: { email: "admin@nova.test" },
    update: {
      name: "Nova Admin",
      role: UserRole.OWNER,
      isActive: true,
      passwordHash,
    },
    create: {
      name: "Nova Admin",
      email: "admin@nova.test",
      passwordHash,
      role: UserRole.OWNER,
    },
  });

  for (const table of tables) {
    await prisma.billiardTable.upsert({
      where: { code: table.code },
      update: table,
      create: table,
    });
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
  }

  const [userCount, tableCount, productCount] = await Promise.all([
    prisma.user.count(),
    prisma.billiardTable.count(),
    prisma.product.count(),
  ]);

  console.log(JSON.stringify({ userCount, tableCount, productCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
