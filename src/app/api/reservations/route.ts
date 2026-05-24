import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createReservation } from '@/lib/reservation';

// Validation schema for incoming reservation requests
const reservationRequestSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  warehouseId: z.string().min(1, 'warehouseId is required'),
  quantity: z.number().int().min(1, 'quantity must be at least 1'),
});

/**
 * POST handler to create an inventory reservation.
 * 
 * Validates request format, attempts to lock inventory and run database transaction,
 * and returns success metadata or appropriate HTTP error status.
 */
export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 1. Validate payload with Zod
    const validation = reservationRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          message: 'Validation failed', 
          errors: validation.error.format() 
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = validation.data;

    // 2. Trigger reservation service logic
    const result = await createReservation({
      productId,
      warehouseId,
      quantity,
    });

    // 3. Handle errors returned by the service
    if (result.error) {
      switch (result.error) {
        case 'INSUFFICIENT_STOCK':
          return NextResponse.json(
            { message: 'Insufficient stock' },
            { status: 409 }
          );
        case 'LOCK_FAILED':
          return NextResponse.json(
            { message: 'Please retry' },
            { status: 503 }
          );
        case 'INVENTORY_NOT_FOUND':
          return NextResponse.json(
            { message: 'Inventory record not found for the given product and warehouse' },
            { status: 404 }
          );
        case 'TRANSACTION_FAILED':
        default:
          return NextResponse.json(
            { message: 'Internal transaction error occurred, please try again' },
            { status: 500 }
          );
      }
    }

    // 4. Return success response (201 Created)
    const reservation = result.reservation!;
    return NextResponse.json(
      {
        reservationId: reservation.id,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unhandled error in reservations API route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
