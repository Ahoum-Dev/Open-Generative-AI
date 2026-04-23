import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getApiKey } from '@/lib/batchAuth';
import { uploadFileToMuapi } from '@/lib/muapiUpload';
import { saveLocalBackup, publicUrlFor } from '@/lib/localUploadStore';

export async function GET() {
  const trainers = await prisma.trainer.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ trainers });
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
    const existing = await prisma.trainer.findUnique({ where: { csvLabel } });
    if (existing) {
      return NextResponse.json(
        { error: `csvLabel "${csvLabel}" is already used by trainer "${existing.name}"` },
        { status: 409 },
      );
    }
  }

  // Create the row first so we have an id for the local filename.
  const trainer = await prisma.trainer.create({
    data: { name, csvLabel, imageUrl: '' },
  });

  // Always save a local copy.
  const { localPath, fileName } = await saveLocalBackup('trainers', trainer.id, file);

  // Try MuAPI in the background — non-fatal if it fails (no credits, no key, etc).
  // The slice-4 worker will re-upload from the local copy when submitting jobs.
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

  // Pick the best display URL we have. Prefer MuAPI (CDN), fall back to local route.
  const imageUrl = muapiUrl || (fileName ? publicUrlFor('trainers', fileName) : '');

  if (!imageUrl) {
    // Both MuAPI and local backup failed — abandon the row so we don't leave junk.
    await prisma.trainer.delete({ where: { id: trainer.id } });
    return NextResponse.json(
      { error: `Failed to persist image. MuAPI: ${muapiNote || 'n/a'}. Local: write failed.` },
      { status: 500 },
    );
  }

  const updated = await prisma.trainer.update({
    where: { id: trainer.id },
    data: { imageUrl, localPath },
  });

  return NextResponse.json({ trainer: updated, muapiNote }, { status: 201 });
}
