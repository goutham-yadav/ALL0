import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Force dynamic execution for reading live stock data
export const dynamic = 'force-dynamic';

/**
 * GET handler for products.
 * 
 * Flow:
 * 1. Lazily clean up expired pending reservations:
 *    - In a Prisma transaction, find all `PENDING` reservations where `expiresAt < now`.
 *    - Update their status to `EXPIRED`.
 *    - Decrement `reservedUnits` in associated `Inventory` rows accordingly.
 * 2. Query products with their current active inventories and warehouse names.
 * 3. Map to the requested output structure:
 *    available = totalUnits - reservedUnits (accurately computed per warehouse).
 */
export async function GET() {
  try {
    const now = new Date();

    // 1. Transactional lazy cleanup of expired pending reservations
    await prisma.$transaction(async (tx) => {
      const expiredPending = await tx.reservation.findMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: now,
          },
        },
      });

      if (expiredPending.length > 0) {
        // Mark all identified reservations as EXPIRED
        await tx.reservation.updateMany({
          where: {
            id: {
              in: expiredPending.map((r) => r.id),
            },
          },
          data: { status: 'EXPIRED' },
        });

        // Restitute reserved units for each expired hold
        for (const reservation of expiredPending) {
          const inventory = await tx.inventory.findUnique({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reservedUnits: {
                  decrement: Math.min(reservation.quantity, inventory.reservedUnits),
                },
              },
            });
          }
        }
      }
    });

    // 2. Query products along with their inventories and warehouse mappings
    const products = await prisma.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 3. Format response structure
    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      warehouses: product.inventories.map((inv) => ({
        warehouseId: inv.warehouse.id,
        warehouseName: inv.warehouse.name,
        available: Math.max(0, inv.totalUnits - inv.reservedUnits),
      })),
    }));

    return NextResponse.json(formattedProducts, { status: 200 });
  } catch (error) {
    console.error('Unhandled error in GET products API route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
