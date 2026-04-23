import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getApiKey } from '@/lib/batchAuth';
import { uploadFileToMuapi } from '@/lib/muapiUpload';
import { saveLocalBackup, publicUrlFor } from '@/lib/localUploadStore';

export async function GET() {
  const studios = await prisma.studio.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ studios });
}

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const name = (form.get('name') || '').toString().trim();
  const csvLabel = (form.get('csvLabel') || '').toString().trim() || null;
  const file = form.get('image');

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 });
  }

  if (csvLabel) {
    const existing = await prisma.studio.findUnique({ where: { csvLabel } });
    if (existing) {
      return NextResponse.json(
        { error: `csvLabel "${csvLabel}" is already used by studio "${existing.name}"` },
        { status: 409 },
      );
    }
  }

  const studio = await prisma.studio.create({
    data: { name, csvLabel, imageUrl: '' },
  });

  const { localPath, fileName } = await saveLocalBackup('studios', studio.id, file);

  let muapiUrl = null;
  let muapiNote = null;
  const apiKey = getApiKey(request);
  if (apiKey) {
    try {
      muapiUrl = await uploadFileToMuapi(apiKey, file);
    } catch (err) {
      muapiNote = err.message;
    }
  } else {
    muapiNote = 'No MuAPI key — local copy only. Set the key in /studio when credits are available.';
  }

  const imageUrl = muapiUrl || (fileName ? publicUrlFor('studios', fileName) : '');

  if (!imageUrl) {
    await prisma.studio.delete({ where: { id: studio.id } });
    return NextResponse.json(
      { error: `Failed to persist image. MuAPI: ${muapiNote || 'n/a'}. Local: write failed.` },
      { status: 500 },
    );
  }

  const updated = await prisma.studio.update({
    where: { id: studio.id },
    data: { imageUrl, localPath },
  });

  return NextResponse.json({ studio: updated, muapiNote }, { status: 201 });
}
