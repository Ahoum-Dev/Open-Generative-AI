import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(_request, { params }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  if (['completed', 'cancelled'].includes(batch.status)) {
    return NextResponse.json({ error: `Batch already ${batch.status}` }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.job.updateMany({
      where: { batchId: id, status: { in: ['queued', 'draft'] } },
      data: { status: 'cancelled' },
    }),
    prisma.batch.update({ where: { id }, data: { status: 'cancelled' } }),
  ]);

  const updated = await prisma.batch.findUnique({ where: { id } });
  return NextResponse.json({ batch: updated });
}
