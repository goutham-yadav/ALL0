import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST handler to release a reservation by id.
 * 
 * Flow:
 * 1. Fetch reservation by id (dynamic path parameter).
 * 2. If not found, returns `404 Not Found`.
 * 3. If status is already `RELEASED` or `EXPIRED`, returns `400 Bad Request`.
 * 4. Otherwise (for `PENDING` or `CONFIRMED` status):
 *    - In a transaction: sets status to `RELEASED`.
 *    - Decrements `reservedUnits` in associated inventory to free up stock.
 *    - Returns `200 OK` with updated reservation metadata.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch reservation by id
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { message: 'Reservation not found' },
        { status: 404 }
      );
    }

    // 2. Prevent releasing already released/expired reservations
    if (reservation.status === 'RELEASED' || reservation.status === 'EXPIRED') {
      return NextResponse.json(
        { message: 'Already released' },
        { status: 400 }
      );
    }

    // 3. Release flow: mark reservation as RELEASED and return stock
    const releasedReservation = await prisma.$transaction(async (tx) => {
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
      });

      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
      });

      if (inventory) {
        // Decrement reserved units to release hold
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedUnits: {
              decrement: Math.min(reservation.quantity, inventory.reservedUnits),
            },
          },
        });
      }

      return updatedRes;
    });

    return NextResponse.json(releasedReservation, { status: 200 });
  } catch (error) {
    console.error('Unhandled error releasing reservation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
