import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(_request, { params }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  if (batch.status !== 'paused') {
    return NextResponse.json({ error: `Can only resume paused batches (was "${batch.status}")` }, { status: 409 });
  }
  const updated = await prisma.batch.update({ where: { id }, data: { status: 'running' } });
  return NextResponse.json({ batch: updated });
}
