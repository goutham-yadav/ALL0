import prisma from './prisma';

/**
 * Finds all PENDING reservations that have passed their expiresAt threshold,
 * marks them as EXPIRED, and decrements the reserved units in the respective inventory records.
 * All updates are performed inside a single Prisma transaction to ensure consistency.
 * 
 * @returns The number of expired reservations that were successfully cleaned up.
 */
export async function releaseExpiredReservations(): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Find all PENDING reservations whose expiresAt has passed
    const expiredReservations = await tx.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
    });

    if (expiredReservations.length === 0) {
      return 0;
    }

    // 2. Iterate and update both reservations and inventories
    for (const res of expiredReservations) {
      // Mark the reservation as EXPIRED
      await tx.reservation.update({
        where: { id: res.id },
        data: { status: 'EXPIRED' },
      });

      // Find the corresponding inventory record
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: res.productId,
            warehouseId: res.warehouseId,
          },
        },
      });

      if (inventory) {
        // Safely decrement the inventory hold
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedUnits: {
              decrement: Math.min(res.quantity, inventory.reservedUnits),
            },
          },
        });
      }
    }

    return expiredReservations.length;
  });
}
