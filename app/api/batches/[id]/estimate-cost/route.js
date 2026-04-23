import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getApiKey } from '@/lib/batchAuth';

const MUAPI_BASE = 'https://api.muapi.ai';

export async function POST(request, { params }) {
  const { id } = await params;
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'MuAPI API key required' }, { status: 401 });
  }

  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
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

  const payload = {
    aspect_ratio: batch.aspectRatio,
    duration: batch.duration,
    quality: batch.quality,
  };

  let muapiData;
  try {
    const res = await fetch(`${MUAPI_BASE}/api/v1/app/calculate_dynamic_cost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ task_name: batch.model, payload }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `MuAPI cost endpoint returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    muapiData = await res.json();
  } catch (err) {
    return NextResponse.json({ error: `Cost estimate failed: ${err.message}` }, { status: 502 });
  }

  const perJob =
    typeof muapiData.cost === 'number' ? muapiData.cost
      : typeof muapiData.price === 'number' ? muapiData.price
        : typeof muapiData.amount === 'number' ? muapiData.amount
          : null;

  if (perJob === null) {
    return NextResponse.json(
      { error: `Could not extract cost from MuAPI response: ${JSON.stringify(muapiData).slice(0, 200)}`, raw: muapiData },
      { status: 502 },
    );
  }

  return NextResponse.json({
    perJob,
    rows: batch.total,
    total: perJob * batch.total,
    currency: muapiData.currency || 'USD',
    raw: muapiData,
  });
}
