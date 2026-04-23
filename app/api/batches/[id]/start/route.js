import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(_request, { params }) {
  const { id } = await params;

  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  if (batch.status === 'running') return NextResponse.json({ batch });
  if (!['draft', 'paused'].includes(batch.status)) {
    return NextResponse.json({ error: `Cannot start batch in status "${batch.status}"` }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.job.updateMany({
      where: { batchId: id, status: { in: ['draft', 'cancelled'] } },
      data: { status: 'queued' },
    }),
    prisma.batch.update({ where: { id }, data: { status: 'running' } }),
  ]);

  const updated = await prisma.batch.findUnique({ where: { id } });
  return NextResponse.json({ batch: updated });
}
