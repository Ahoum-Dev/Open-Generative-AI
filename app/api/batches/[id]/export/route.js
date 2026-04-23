import prisma from '@/lib/prisma';

const COLUMNS = [
  'Row',
  'Practice Name',
  'Trainer',
  'Studio',
  'Status',
  'Video URL',
  'Error',
  'Retries',
];

export async function GET(_request, { params }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { rowIndex: 'asc' },
        include: {
          trainer: { select: { name: true, csvLabel: true } },
          studio: { select: { name: true, csvLabel: true } },
        },
      },
    },
  });
  if (!batch) {
    return new Response('Batch not found', { status: 404 });
  }

  const lines = [COLUMNS.join(',')];
  for (const job of batch.jobs) {
    const cells = [
      job.rowIndex + 1,
      job.practiceName,
      job.trainer ? `${job.trainer.name}${job.trainer.csvLabel ? ` (${job.trainer.csvLabel})` : ''}` : '',
      job.studio ? `${job.studio.name}${job.studio.csvLabel ? ` (${job.studio.csvLabel})` : ''}` : '',
      job.status,
      job.videoUrl || '',
      job.error || '',
      job.retries,
    ];
    lines.push(cells.map(csvCell).join(','));
  }

  const filename = `${slugify(batch.name)}-results.csv`;
  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function csvCell(value) {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'batch';
}
