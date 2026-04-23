import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.UPLOAD_DIR || '/data/uploads';

export async function saveLocalBackup(kind, id, file) {
  try {
    const dir = path.join(ROOT, kind);
    await mkdir(dir, { recursive: true });
    const ext = inferExtension(file);
    const target = path.join(dir, `${id}${ext}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(target, buf);
    return target;
  } catch (err) {
    console.warn(`[localUploadStore] backup write skipped (${kind}/${id}):`, err.message);
    return null;
  }
}

function inferExtension(file) {
  const name = file?.name || '';
  const dot = name.lastIndexOf('.');
  if (dot >= 0) return name.slice(dot).toLowerCase();
  const type = file?.type || '';
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  return '.bin';
}
