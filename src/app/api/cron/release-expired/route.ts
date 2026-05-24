import { NextResponse } from 'next/server';
import { releaseExpiredReservations } from '@/lib/cleanup';

/**
 * GET /api/cron/release-expired
 * Secured webhook invoked by Vercel Cron or standard schedulers.
 * Validates secret token using Authorization Bearer token.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn('CRON_SECRET environment variable is missing.');
      return NextResponse.json(
        { message: 'Cron secret configuration is missing' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const releasedCount = await releaseExpiredReservations();

    return NextResponse.json({ released: releasedCount }, { status: 200 });
  } catch (error) {
    console.error('Error executing release-expired cron:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
