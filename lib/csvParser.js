import Papa from 'papaparse';

// Maps the Rasika-style somatic-practice CSV into our Job shape.
// Expected columns (case-insensitive, trimmed):
//   "Video Generation Model", "Character", "Practice Name",
//   "Practice Description", "Start Position", "Time (Duration)",
//   "Studio", "Camera Angle", "Video Quality", "Status"
//
// Only Character, Practice Name, and Practice Description are required.

const REQUIRED_COLUMNS = ['Character', 'Practice Name', 'Practice Description'];

export function parseBatchCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error at row ${first.row}: ${first.message}`);
  }

  const headers = result.meta.fields || [];
  const missing = REQUIRED_COLUMNS.filter(
    (col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase()),
  );
  if (missing.length > 0) {
    throw new Error(`Missing required column(s): ${missing.join(', ')}`);
  }

  const rows = result.data.map((raw, idx) => normaliseRow(raw, idx));
  return { rows, headers };
}

function normaliseRow(raw, idx) {
  const get = (name) => {
    const key = Object.keys(raw).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? (raw[key] ?? '').toString().trim() : '';
  };

  const character = get('Character');
  const practiceName = get('Practice Name');
  const description = get('Practice Description');
  const startPosition = get('Start Position');
  const cameraAngle = get('Camera Angle');
  const studio = get('Studio');
  const timeStr = get('Time (Duration)');
  const qualityStr = get('Video Quality');

  return {
    rowIndex: idx,
    practiceName,
    characterLabel: character,
    studioLabel: studio || null,
    // Worker renders the full template (lib/promptTemplate.js) at submit
    // time using trainer, studio, and the structured fields below. We just
    // store the raw practice description here so the prompt-builder has
    // clean inputs to work with.
    prompt: description,
    rawDescription: description,
    startPosition: startPosition || null,
    cameraAngle: cameraAngle || null,
    duration: parseDuration(timeStr),
    quality: parseQuality(qualityStr),
  };
}

function parseDuration(s) {
  if (!s) return 15;
  const m = s.match(/(\d+)/);
  if (!m) return 15;
  const n = parseInt(m[1], 10);
  // Seedance 2.0 i2v supports 5, 10, 15. Snap to nearest valid.
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  return 15;
}

function parseQuality(s) {
  if (!s) return 'basic';
  const lower = s.toLowerCase();
  if (lower.includes('1080') || lower === 'high') return 'high';
  return 'basic';
}
