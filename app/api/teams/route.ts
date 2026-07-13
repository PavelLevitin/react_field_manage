import { NextRequest, NextResponse } from 'next/server';
import { getTeams, addTeam, removeTeam, renameTeam } from '@/lib/db';

export async function GET() {
  const teams = await getTeams();
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (body.action === 'add') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    const teams = await addTeam(name);
    return NextResponse.json({ teams });
  }

  if (body.action === 'remove') {
    const name = typeof body.name === 'string' ? body.name : '';
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    const teams = await removeTeam(name);
    return NextResponse.json({ teams });
  }

  if (body.action === 'rename') {
    const original = typeof body.original === 'string' ? body.original : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!original || !name) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const teams = await renameTeam(original, name);
    return NextResponse.json({ teams });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
