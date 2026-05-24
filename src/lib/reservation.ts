import prisma from './prisma';
import { acquireLock, releaseLock } from './lock';

interface CreateReservationArgs {
  productId: string;
  warehouseId: string;
  quantity: number;
}

/**
 * Creates a race-condition-safe inventory reservation.
 * 
 * Flow:
 * 1. Acquires a Redis lock on key: `lock:inventory:${productId}:${warehouseId}`
 * 2. If the lock is not acquired, returns `{ error: "LOCK_FAILED" }`
 * 3. Opens a Prisma transaction
 * 4. Inside the transaction: reads the inventory row and computes available stock.
 * 5. If available stock < quantity, releases the lock and returns `{ error: "INSUFFICIENT_STOCK" }`
 * 6. Otherwise, increments `reservedUnits` in inventory, creates a pending Reservation, commits, releases lock, and returns the reservation.
 */
export async function createReservation({
  productId,
  warehouseId,
  quantity,
}: CreateReservationArgs) {
  const lockKey = `lock:inventory:${productId}:${warehouseId}`;

  // 1. Acquire Redis lock
  const lockAcquired = await acquireLock(lockKey);
  if (!lockAcquired) {
    return { error: 'LOCK_FAILED' as const };
  }

  try {
    // 3. Open a Prisma transaction
    const reservation = await prisma.$transaction(async (tx) => {
      // 4. Read the inventory row
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId,
          },
        },
      });

      if (!inventory) {
        throw new Error('INVENTORY_NOT_FOUND');
      }

      // Compute available stock
      const available = inventory.totalUnits - inventory.reservedUnits;

      // 5. If available < quantity: throw error to abort transaction
      if (available < quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // 6. Increment reservedUnits by quantity
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedUnits: {
            increment: quantity,
          },
        },
      });

      // Create a Reservation with status PENDING, expiresAt = now + 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const newReservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt,
        },
      });

      return newReservation;
    });

    // 8. Release lock
    await releaseLock(lockKey);

    // 9. Return the created reservation
    return { reservation };
  } catch (error: any) {
    // Ensure the lock is ALWAYS released in case of database failures
    await releaseLock(lockKey);

    if (error.message === 'INSUFFICIENT_STOCK') {
      return { error: 'INSUFFICIENT_STOCK' as const };
    }
    if (error.message === 'INVENTORY_NOT_FOUND') {
      return { error: 'INVENTORY_NOT_FOUND' as const };
    }

    console.error('Reservation creation failed due to database transaction error:', error);
    return { error: 'TRANSACTION_FAILED' as const };
  }
}
