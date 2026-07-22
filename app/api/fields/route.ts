import { NextRequest, NextResponse } from 'next/server';
import { getFields, addField, removeField, renameField } from '@/lib/db';

export async function GET() {
  const fields = await getFields();
  return NextResponse.json({ fields });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (body.action === 'add') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    const fields = await addField(name);
    return NextResponse.json({ fields });
  }

  if (body.action === 'remove') {
    const name = typeof body.name === 'string' ? body.name : '';
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    const fields = await removeField(name);
    return NextResponse.json({ fields });
  }

  if (body.action === 'rename') {
    const original = typeof body.original === 'string' ? body.original : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!original || !name) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const fields = await renameField(original, name);
    return NextResponse.json({ fields });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
