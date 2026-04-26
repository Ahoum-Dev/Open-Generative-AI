import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const ROOT = process.env.UPLOAD_DIR || '/data/uploads';

export async function saveLocalBackup(kind, id, file) {
  try {
    const dir = path.join(ROOT, kind);
    await mkdir(dir, { recursive: true });
    const ext = inferExtension(file);
    const fileName = `${id}${ext}`;
    const target = path.join(dir, fileName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(target, buf);
    return { localPath: target, fileName };
  } catch (err) {
    console.warn(`[localUploadStore] backup write skipped (${kind}/${id}):`, err.message);
    return { localPath: null, fileName: null };
  }
}

export async function readLocal(kind, fileName) {
  // Reject path traversal — only accept simple names.
  if (!fileName || fileName.includes('/') || fileName.includes('..') || fileName.includes('\\')) {
    return null;
  }
  const target = path.join(ROOT, kind, fileName);
  try {
    await stat(target);
    const buf = await readFile(target);
    return { buf, contentType: contentTypeFor(fileName) };
  } catch {
    return null;
  }
}

export function publicUrlFor(kind, fileName) {
  return `/api/uploads/${kind}/${encodeURIComponent(fileName)}`;
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

function contentTypeFor(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}
