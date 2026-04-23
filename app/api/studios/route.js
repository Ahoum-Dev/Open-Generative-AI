import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getApiKey } from '@/lib/batchAuth';
import { uploadFileToMuapi } from '@/lib/muapiUpload';
import { saveLocalBackup } from '@/lib/localUploadStore';

export async function GET() {
  const studios = await prisma.studio.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ studios });
}

export async function POST(request) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'MuAPI API key is required. Set it in /studio or pass x-api-key.' },
      { status: 401 },
    );
  }

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

  let muapiUrl;
  try {
    muapiUrl = await uploadFileToMuapi(apiKey, file);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  const studio = await prisma.studio.create({
    data: { name, csvLabel, imageUrl: muapiUrl },
  });

  const localPath = await saveLocalBackup('studios', studio.id, file);
  if (localPath) {
    await prisma.studio.update({
      where: { id: studio.id },
      data: { localPath },
    });
    studio.localPath = localPath;
  }

  return NextResponse.json({ studio }, { status: 201 });
}
