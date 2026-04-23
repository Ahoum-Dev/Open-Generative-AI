import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      model: true,
      duration: true,
      quality: true,
      aspectRatio: true,
      concurrency: true,
      status: true,
      total: true,
      done: true,
      failed: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ batches });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name,
    model = 'seedance-v2.0-i2v',
    duration = 15,
    quality = 'basic',
    aspectRatio = '16:9',
    concurrency = 5,
    jobs = [],
  } = body || {};

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return NextResponse.json({ error: 'jobs must be a non-empty array' }, { status: 400 });
  }

  const cleanedJobs = jobs.map((j, i) => ({
    rowIndex: typeof j.rowIndex === 'number' ? j.rowIndex : i,
    practiceName: String(j.practiceName || `Row ${i + 1}`),
    trainerId: j.trainerId || null,
    studioId: j.studioId || null,
    prompt: String(j.prompt || ''),
    startPosition: j.startPosition || null,
    cameraAngle: j.cameraAngle || null,
    aspectRatio: j.aspectRatio || aspectRatio,
    duration: typeof j.duration === 'number' ? j.duration : duration,
    quality: j.quality || quality,
  }));

  const batch = await prisma.batch.create({
    data: {
      name: name.trim(),
      model,
      duration,
      quality,
      aspectRatio,
      concurrency,
      status: 'draft',
      total: cleanedJobs.length,
      jobs: { create: cleanedJobs },
    },
    select: {
      id: true,
      name: true,
      status: true,
      total: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ batch }, { status: 201 });
}
