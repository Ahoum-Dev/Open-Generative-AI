import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_request, { params }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { rowIndex: 'asc' },
        include: {
          trainer: { select: { id: true, name: true, csvLabel: true, imageUrl: true } },
          studio: { select: { id: true, name: true, csvLabel: true, imageUrl: true } },
        },
      },
    },
  });
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }
  return NextResponse.json({ batch });
}
