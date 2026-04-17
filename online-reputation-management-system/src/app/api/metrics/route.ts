import { NextResponse } from 'next/server';
import { convexQuery } from '@/lib/convex';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cinemaId = searchParams.get('cinemaId');
  const start = searchParams.get('start') || undefined;
  const end = searchParams.get('end') || undefined;

  if (!cinemaId) {
    return NextResponse.json({ error: 'cinemaId is required' }, { status: 400 });
  }

  try {
    const metrics = await convexQuery<any[]>('metrics:byPlaceId', {
      placeId: cinemaId,
      start,
      end,
    });

    return NextResponse.json({
      cinemaId,
      count: metrics.length,
      metrics,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
