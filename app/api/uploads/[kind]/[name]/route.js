import { NextResponse } from 'next/server';
import { readLocal } from '@/lib/localUploadStore';

const ALLOWED = new Set(['trainers', 'studios', 'videos']);

export async function GET(_request, { params }) {
  const { kind, name } = await params;
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ error: 'unknown asset kind' }, { status: 404 });
  }

  const file = await readLocal(kind, decodeURIComponent(name));
  if (!file) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return new NextResponse(file.buf, {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
