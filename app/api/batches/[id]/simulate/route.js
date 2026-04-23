import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// Demo-only endpoint: marks a few queued jobs as 'done' (with a placeholder
// video URL) and a smaller number as 'failed', so the progress UI shows
// realistic state during a stakeholder demo without needing the real worker.
export async function POST(_request, { params }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

  const queued = await prisma.job.findMany({
    where: { batchId: id, status: 'queued' },
    orderBy: { rowIndex: 'asc' },
    take: Math.max(1, Math.ceil(batch.total * 0.1)),
    select: { id: true },
  });

  if (queued.length === 0) {
    return NextResponse.json({ message: 'Nothing to simulate — no queued jobs.', batch });
  }

  const failCount = Math.max(0, Math.floor(queued.length * 0.1));
  const doneIds = queued.slice(failCount).map((j) => j.id);
  const failIds = queued.slice(0, failCount).map((j) => j.id);

  await prisma.$transaction([
    prisma.job.updateMany({
      where: { id: { in: doneIds } },
      data: {
        status: 'done',
        videoUrl: SAMPLE_VIDEO,
        completedAt: new Date(),
      },
    }),
    prisma.job.updateMany({
      where: { id: { in: failIds } },
      data: {
        status: 'failed',
        error: 'Simulated failure for demo. Click Retry to requeue.',
        completedAt: new Date(),
      },
    }),
    prisma.batch.update({
      where: { id },
      data: {
        done: { increment: doneIds.length },
        failed: { increment: failIds.length },
      },
    }),
  ]);

  const updated = await prisma.batch.findUnique({ where: { id } });
  return NextResponse.json({
    advanced: doneIds.length + failIds.length,
    done: doneIds.length,
    failed: failIds.length,
    batch: updated,
  });
}
