import { NextResponse } from 'next/server';
import { getAllSchedules, clearAllSchedules } from '@/lib/db';

export async function GET() {
  const schedules = await getAllSchedules();
  return NextResponse.json({ schedules });
}

export async function DELETE() {
  await clearAllSchedules();
  return NextResponse.json({ ok: true });
}
