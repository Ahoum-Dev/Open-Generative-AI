'use client';

import { useState } from 'react';

export default function AddAssetModal({ apiKey, endpoint, label, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [csvLabel, setCsvLabel] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !file) {
      setError('Name and image are required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      if (csvLabel.trim()) form.append('csvLabel', csvLabel.trim());
      form.append('image', file);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed: ${res.status}`);
      }
      await onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-1">Add {label.toLowerCase()}</h2>
        <p className="text-white/40 text-[13px] mb-6">
          Uploads to MuAPI once and saves a local backup. Reused across every batch.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wide mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={label === 'Trainer' ? 'e.g. Raj' : 'e.g. Main studio'}
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wide mb-1.5">
              CSV label (optional)
            </label>
            <input
              type="text"
              value={csvLabel}
              onChange={(e) => setCsvLabel(e.target.value)}
              placeholder={label === 'Trainer' ? 'e.g. Trainer 1' : 'e.g. Studio 1'}
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
            />
            <p className="text-[11px] text-white/30 mt-1">
              Used to auto-match CSV rows. Set once; CSV column value "{label} 1" maps to this {label.toLowerCase()}.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wide mb-1.5">
              Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-[13px] text-white/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-white/10 file:text-white/80 file:text-[12px] file:cursor-pointer hover:file:bg-white/20"
              required
            />
            {previewUrl && (
              <div className="mt-3 rounded-md overflow-hidden bg-black/40 aspect-square max-w-[160px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold border border-white/5 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-10 rounded-md bg-[#d9ff00] text-black hover:bg-[#e5ff33] text-xs font-semibold transition-all disabled:opacity-50"
            >
              {submitting ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
