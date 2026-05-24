import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST handler to confirm a reservation by id.
 * 
 * Flow:
 * 1. Fetch reservation by id (dynamic path parameter).
 * 2. If not found, returns `404 Not Found`.
 * 3. If status is not `PENDING`, returns `400 Bad Request`.
 * 4. If reservation has expired (`expiresAt` is in the past):
 *    - In a transaction: updates status to `EXPIRED` and decrements `reservedUnits` in inventory to release hold.
 *    - Returns `410 Gone`.
 * 5. If valid and active:
 *    - In a transaction: updates status to `CONFIRMED`.
 *    - Returns `200 OK` with the confirmed reservation metadata.
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

    // 2. Verify status is PENDING
    if (reservation.status !== 'PENDING') {
      return NextResponse.json(
        { message: 'Reservation is not pending' },
        { status: 400 }
      );
    }

    // 3. Verify expiration
    const now = new Date();
    const isExpired = reservation.expiresAt < now;

    if (isExpired) {
      // Expiration flow: rollback reserved inventory count and mark reservation as EXPIRED
      const expiredReservation = await prisma.$transaction(async (tx) => {
        const updatedRes = await tx.reservation.update({
          where: { id },
          data: { status: 'EXPIRED' },
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
          // Decrement reserved units to free up stock
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

      return NextResponse.json(
        { 
          message: 'Reservation expired',
          reservation: expiredReservation
        },
        { status: 410 }
      );
    }

    // 4. Confirmation flow: mark reservation as CONFIRMED
    const confirmedReservation = await prisma.$transaction(async (tx) => {
      return await tx.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      });
    });

    return NextResponse.json(confirmedReservation, { status: 200 });
  } catch (error) {
    console.error('Unhandled error confirming reservation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
