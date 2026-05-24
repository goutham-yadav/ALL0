import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/reservations/[id]
 * Returns the full reservation record for the given id.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            name: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { message: 'Reservation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(reservation, { status: 200 });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
