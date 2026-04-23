import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(_request, { params }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: 'queued',
      retries: 0,
      error: null,
      nextAttemptAt: null,
      muapiRequestId: null,
    },
  });
  return NextResponse.json({ job: updated });
}
