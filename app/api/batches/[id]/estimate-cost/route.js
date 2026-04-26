import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getApiKey } from '@/lib/batchAuth';
import { getProvider } from '@/lib/providers';

export async function POST(request, { params }) {
  const { id } = await params;
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
      provider: true,
      model: true,
      duration: true,
      quality: true,
      aspectRatio: true,
      total: true,
    },
  });
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  let provider;
  try {
    provider = getProvider(batch.provider);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (!provider.estimateCost) {
    return NextResponse.json(
      { error: `Provider "${batch.provider}" does not support cost estimation` },
      { status: 400 },
    );
  }

  try {
    const { perJob, currency, raw } = await provider.estimateCost({ apiKey, batch });
    return NextResponse.json({
      perJob,
      rows: batch.total,
      total: perJob * batch.total,
      currency,
      raw,
    });
  } catch (err) {
    return NextResponse.json({ error: `Cost estimate failed: ${err.message}` }, { status: 502 });
  }
}
