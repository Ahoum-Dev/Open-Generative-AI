import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(_request, { params }) {
  const { id } = await params;

  const inUse = await prisma.job.count({
    where: {
      trainerId: id,
      status: { in: ['queued', 'submitting', 'polling'] },
    },
  });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Trainer is referenced by ${inUse} active job(s). Pause or cancel the batch first.` },
      { status: 409 },
    );
  }

  try {
    await prisma.trainer.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
