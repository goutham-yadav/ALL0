import 'dotenv/config';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱  Seeding database …');

  // ------------------------------------------------------------------
  // Products
  // ------------------------------------------------------------------
  const [iphone, macbook, airpods] = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod_iphone16' },
      update: {},
      create: {
        id: 'prod_iphone16',
        name: 'iPhone 16',
        description: 'Apple iPhone 16 – latest flagship smartphone',
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod_macbookm3' },
      update: {},
      create: {
        id: 'prod_macbookm3',
        name: 'MacBook Air M3',
        description: 'Apple MacBook Air with M3 chip',
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod_airpodspro' },
      update: {},
      create: {
        id: 'prod_airpodspro',
        name: 'AirPods Pro',
        description: 'Apple AirPods Pro (2nd generation)',
      },
    }),
  ]);

  console.log(`  ✔  Products: ${iphone.name}, ${macbook.name}, ${airpods.name}`);

  // ------------------------------------------------------------------
  // Warehouses
  // ------------------------------------------------------------------
  const [mumbai, delhi] = await Promise.all([
    prisma.warehouse.upsert({
      where: { id: 'wh_mumbai' },
      update: {},
      create: {
        id: 'wh_mumbai',
        name: 'Mumbai Hub',
        location: 'Mumbai, Maharashtra, IN',
      },
    }),
    prisma.warehouse.upsert({
      where: { id: 'wh_delhi' },
      update: {},
      create: {
        id: 'wh_delhi',
        name: 'Delhi Hub',
        location: 'New Delhi, Delhi, IN',
      },
    }),
  ]);

  console.log(`  ✔  Warehouses: ${mumbai.name}, ${delhi.name}`);

  // ------------------------------------------------------------------
  // Inventory  (low stock: 2-5 units each, easy to trigger races)
  // ------------------------------------------------------------------
  const inventoryEntries = [
    // iPhone 16
    { productId: iphone.id,  warehouseId: mumbai.id, totalUnits: 3 },
    { productId: iphone.id,  warehouseId: delhi.id,  totalUnits: 2 },
    // MacBook Air M3
    { productId: macbook.id, warehouseId: mumbai.id, totalUnits: 4 },
    { productId: macbook.id, warehouseId: delhi.id,  totalUnits: 2 },
    // AirPods Pro
    { productId: airpods.id, warehouseId: mumbai.id, totalUnits: 5 },
    { productId: airpods.id, warehouseId: delhi.id,  totalUnits: 3 },
  ];

  for (const entry of inventoryEntries) {
    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: {
          productId: entry.productId,
          warehouseId: entry.warehouseId,
        },
      },
      update: { totalUnits: entry.totalUnits },
      create: { ...entry, reservedUnits: 0 },
    });
  }

  console.log(`  ✔  Inventory: ${inventoryEntries.length} entries seeded`);
  console.log('✅  Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
