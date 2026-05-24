import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET handler for warehouses.
 * 
 * Returns list of all warehouses in the system.
 */
export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(warehouses, { status: 200 });
  } catch (error) {
    console.error('Unhandled error in GET warehouses API route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
