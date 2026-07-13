import { NextRequest, NextResponse } from 'next/server';
import { getSchedule, saveSchedule } from '@/lib/db';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });
  const containers = await getSchedule(date);
  return NextResponse.json({ containers });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.date !== 'string' || !Array.isArray(body.containers)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  await saveSchedule(body.date, body.containers);
  return NextResponse.json({ ok: true });
}
