import { NextResponse } from 'next/server';
import { getAllSchedules } from '@/lib/db';

export async function GET() {
  const schedules = await getAllSchedules();
  return NextResponse.json({ schedules });
}
