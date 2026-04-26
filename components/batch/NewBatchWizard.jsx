'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseBatchCsv } from '@/lib/csvParser';

const DEFAULTS = {
  provider: '',                     // user must pick — no default
  model: 'seedance-v2.0-i2v',
  duration: 15,
  quality: 'basic',
  aspectRatio: '16:9',
  concurrency: 5,
};

export default function NewBatchWizard({ apiKey, onClose, onCreated }) {
  const [step, setStep] = useState(1);

  const [trainers, setTrainers] = useState([]);
  const [studios, setStudios] = useState([]);
  const [providers, setProviders] = useState([]);
  const [libraryError, setLibraryError] = useState(null);

  // Step 1
  const [name, setName] = useState('');
  const [csvText, setCsvText] = useState(null);
  const [csvFileName, setCsvFileName] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);

  // Step 2 — per-row trainer/studio overrides
  const [rowOverrides, setRowOverrides] = useState({}); // { rowIndex: {trainerId, studioId, skipped} }

  // Step 3
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [estimateError, setEstimateError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Load libraries
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tr, st, pv] = await Promise.all([
          fetch('/api/trainers', { headers: { 'x-api-key': apiKey } }).then((r) => r.json()),
          fetch('/api/studios', { headers: { 'x-api-key': apiKey } }).then((r) => r.json()),
          fetch('/api/providers').then((r) => r.json()),
        ]);
        if (cancelled) return;
        setTrainers(tr.trainers || []);
        setStudios(st.studios || []);
        setProviders(pv.providers || []);
      } catch (err) {
        if (!cancelled) setLibraryError(err.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [apiKey]);

  const handleCsvFile = async (file) => {
    setCsvError(null);
    if (!file) {
      setCsvText(null);
      setCsvRows([]);
      setCsvFileName(null);
      return;
    }
    try {
      const text = await file.text();
      const { rows } = parseBatchCsv(text);
      setCsvText(text);
      setCsvRows(rows);
      setCsvFileName(file.name);
      setRowOverrides({});
    } catch (err) {
      setCsvError(err.message);
      setCsvRows([]);
      setCsvText(null);
    }
  };

  // Auto-mapping by csvLabel
  const autoMappedRows = useMemo(() => {
    return csvRows.map((row) => {
      const overrides = rowOverrides[row.rowIndex] || {};
      const trainerId =
        overrides.trainerId !== undefined
          ? overrides.trainerId
          : trainers.find((t) => t.csvLabel?.toLowerCase() === row.characterLabel.toLowerCase())?.id || null;
      const studioId =
        overrides.studioId !== undefined
          ? overrides.studioId
          : (row.studioLabel
            ? studios.find((s) => s.csvLabel?.toLowerCase() === row.studioLabel.toLowerCase())?.id || null
            : studios[0]?.id || null);
      return {
        ...row,
        trainerId,
        studioId,
        skipped: !!overrides.skipped,
      };
    });
  }, [csvRows, trainers, studios, rowOverrides]);

  const issues = useMemo(() => {
    const list = [];
    autoMappedRows.forEach((r) => {
      if (r.skipped) return;
      if (!r.trainerId) list.push({ row: r.rowIndex, msg: `Row ${r.rowIndex + 1} (${r.practiceName || '—'}): no trainer match for "${r.characterLabel}"` });
      if (!r.studioId) list.push({ row: r.rowIndex, msg: `Row ${r.rowIndex + 1}: no studio match for "${r.studioLabel || '(blank)'}"` });
    });
    return list;
  }, [autoMappedRows]);

  const activeRows = autoMappedRows.filter((r) => !r.skipped);

  const overrideRow = (rowIndex, patch) => {
    setRowOverrides((prev) => ({ ...prev, [rowIndex]: { ...(prev[rowIndex] || {}), ...patch } }));
  };

  const bulkAssignTrainer = (trainerId) => {
    const next = {};
    csvRows.forEach((r) => { next[r.rowIndex] = { ...(rowOverrides[r.rowIndex] || {}), trainerId }; });
    setRowOverrides(next);
  };
  const bulkAssignStudio = (studioId) => {
    const next = {};
    csvRows.forEach((r) => { next[r.rowIndex] = { ...(rowOverrides[r.rowIndex] || {}), studioId }; });
    setRowOverrides(next);
  };

  const handleEstimate = async (batchId) => {
    setEstimating(true);
    setEstimateError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/estimate-cost`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Cost estimate failed: ${res.status}`);
      setEstimate(data);
    } catch (err) {
      setEstimateError(err.message);
    } finally {
      setEstimating(false);
    }
  };

  const handleCreate = async (alsoEstimate) => {
    setCreating(true);
    setCreateError(null);
    setEstimate(null);
    setEstimateError(null);
    try {
      const payload = {
        name: name.trim(),
        ...settings,
        jobs: activeRows.map((r) => ({
          rowIndex: r.rowIndex,
          practiceName: r.practiceName,
          trainerId: r.trainerId,
          studioId: r.studioId,
          prompt: r.prompt,
          startPosition: r.startPosition,
          cameraAngle: r.cameraAngle,
          duration: r.duration ?? settings.duration,
          quality: r.quality ?? settings.quality,
          aspectRatio: settings.aspectRatio,
        })),
      };
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Create failed: ${res.status}`);
      if (alsoEstimate) {
        await handleEstimate(data.batch.id);
      }
      // Stay open showing the new batch id; final "Done" closes.
      setStep(3);
      // store created id
      setCreatedBatch(data.batch);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const [createdBatch, setCreatedBatch] = useState(null);

  const canGoToStep2 = name.trim() && csvRows.length > 0 && settings.provider;
  const canGoToStep3 = canGoToStep2 && activeRows.length > 0 && issues.length === 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up p-6">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        <header className="flex-shrink-0 px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">New batch</h2>
            <p className="text-white/40 text-[12px] mt-0.5">
              Step {step} of 3 — {step === 1 ? 'Upload + settings' : step === 2 ? 'Map rows' : 'Estimate + confirm'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {libraryError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] rounded-md px-3 py-2 mb-4">
              Could not load Trainers/Studios: {libraryError}
            </div>
          )}

          {step === 1 && (
            <Step1
              name={name} setName={setName}
              providers={providers}
              settings={settings} setSettings={setSettings}
              csvFileName={csvFileName} csvRows={csvRows}
              csvError={csvError}
              onCsvFile={handleCsvFile}
            />
          )}

          {step === 2 && (
            <Step2
              rows={autoMappedRows}
              trainers={trainers}
              studios={studios}
              issues={issues}
              onOverride={overrideRow}
              onBulkTrainer={bulkAssignTrainer}
              onBulkStudio={bulkAssignStudio}
            />
          )}

          {step === 3 && (
            <Step3
              createdBatch={createdBatch}
              activeRows={activeRows}
              estimate={estimate}
              estimating={estimating}
              estimateError={estimateError}
              createError={createError}
              creating={creating}
              settings={settings}
              onEstimate={() => createdBatch && handleEstimate(createdBatch.id)}
              onCreate={() => handleCreate(true)}
            />
          )}
        </div>

        <footer className="flex-shrink-0 px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[13px] text-white/40 hover:text-white/80 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={creating}
                className="h-10 px-4 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold border border-white/5 transition-all"
              >
                ← Back
              </button>
            )}
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!canGoToStep2}
                className="h-10 px-5 rounded-md bg-[#d9ff00] text-black hover:bg-[#e5ff33] text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={!canGoToStep3}
                className="h-10 px-5 rounded-md bg-[#d9ff00] text-black hover:bg-[#e5ff33] text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            )}
            {step === 3 && !createdBatch && (
              <button
                onClick={() => handleCreate(true)}
                disabled={creating}
                className="h-10 px-5 rounded-md bg-[#d9ff00] text-black hover:bg-[#e5ff33] text-xs font-semibold transition-all disabled:opacity-30"
              >
                {creating ? 'Saving…' : 'Save batch + estimate cost'}
              </button>
            )}
            {step === 3 && createdBatch && (
              <button
                onClick={() => onCreated?.(createdBatch)}
                className="h-10 px-5 rounded-md bg-[#d9ff00] text-black hover:bg-[#e5ff33] text-xs font-semibold transition-all"
              >
                Done
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass =
  'w-full bg-white/5 border border-white/[0.03] rounded-md px-3 py-2 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 text-[13px]';

function Step1({ name, setName, providers, settings, setSettings, csvFileName, csvRows, csvError, onCsvFile }) {
  return (
    <div className="space-y-6">
      <Field label="Batch name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Somatic practices — April run"
          className={inputClass}
        />
      </Field>

      <Field label="Provider" hint="Pick which video API runs this batch. Each provider needs its own API key.">
        <select
          value={settings.provider}
          onChange={(e) => {
            const p = providers.find((x) => x.id === e.target.value);
            setSettings({
              ...settings,
              provider: e.target.value,
              model: p?.defaultModel || settings.model,
            });
          }}
          className={inputClass}
        >
          <option value="" disabled>— pick a provider —</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Field>

      <Field label="CSV file" hint="Drop the Rasika-style CSV. We parse on upload and validate columns.">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onCsvFile(e.target.files?.[0])}
          className="w-full text-[13px] text-white/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-white/10 file:text-white/80 file:text-[12px] file:cursor-pointer hover:file:bg-white/20"
        />
        {csvFileName && (
          <p className="mt-2 text-[12px] text-white/50">
            <span className="text-[#d9ff00]">✓</span> {csvFileName} — {csvRows.length} rows parsed
          </p>
        )}
        {csvError && (
          <div className="mt-2 bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] rounded-md px-3 py-2">
            {csvError}
          </div>
        )}
      </Field>

      <div className="border-t border-white/[0.04] pt-6">
        <h3 className="text-white/70 text-[13px] font-semibold mb-4">Generation settings (apply to every row)</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Model" hint="seedance-v2.0-i2v supports 5/10/15 second clips natively.">
            <input value={settings.model} disabled className={inputClass + ' opacity-60'} />
          </Field>
          <Field label="Duration (s)">
            <select value={settings.duration} onChange={(e) => setSettings({ ...settings, duration: Number(e.target.value) })} className={inputClass}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </Field>
          <Field label="Quality">
            <select value={settings.quality} onChange={(e) => setSettings({ ...settings, quality: e.target.value })} className={inputClass}>
              <option value="basic">basic</option>
              <option value="high">high</option>
            </select>
          </Field>
          <Field label="Aspect ratio">
            <select value={settings.aspectRatio} onChange={(e) => setSettings({ ...settings, aspectRatio: e.target.value })} className={inputClass}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
            </select>
          </Field>
          <Field label="Concurrency" hint="How many provider jobs run in parallel. Worker honours this.">
            <input
              type="number"
              min={1}
              max={20}
              value={settings.concurrency}
              onChange={(e) => setSettings({ ...settings, concurrency: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step2({ rows, trainers, studios, issues, onOverride, onBulkTrainer, onBulkStudio }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <p className="text-[13px] text-white/60">
          {rows.length} rows · {rows.filter((r) => !r.skipped).length} active · {issues.length} issue(s)
        </p>
        <div className="flex gap-2">
          <select
            onChange={(e) => e.target.value && onBulkTrainer(e.target.value)}
            defaultValue=""
            className="bg-white/5 border border-white/[0.03] rounded-md px-2 py-1.5 text-white text-[12px]"
          >
            <option value="" disabled>Bulk: set trainer…</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            onChange={(e) => e.target.value && onBulkStudio(e.target.value)}
            defaultValue=""
            className="bg-white/5 border border-white/[0.03] rounded-md px-2 py-1.5 text-white text-[12px]"
          >
            <option value="" disabled>Bulk: set studio…</option>
            {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3 max-h-32 overflow-y-auto text-[12px] text-red-300 space-y-0.5">
          {issues.slice(0, 8).map((i) => <div key={i.row + i.msg}>• {i.msg}</div>)}
          {issues.length > 8 && <div className="text-red-400/60">…and {issues.length - 8} more</div>}
        </div>
      )}

      <div className="border border-white/[0.04] rounded-md overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-white/[0.02] text-white/40 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2">Practice</th>
              <th className="text-left px-3 py-2">CSV character</th>
              <th className="text-left px-3 py-2">Trainer</th>
              <th className="text-left px-3 py-2">Studio</th>
              <th className="text-center px-3 py-2 w-16">Skip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowIndex} className={`border-t border-white/[0.03] ${r.skipped ? 'opacity-30' : ''}`}>
                <td className="px-3 py-2 text-white/40">{r.rowIndex + 1}</td>
                <td className="px-3 py-2 text-white/90">{r.practiceName}</td>
                <td className="px-3 py-2 text-white/40">{r.characterLabel}</td>
                <td className="px-3 py-2">
                  <select
                    value={r.trainerId || ''}
                    onChange={(e) => onOverride(r.rowIndex, { trainerId: e.target.value || null })}
                    className={`w-full bg-white/5 border rounded px-2 py-1 text-[12px] ${r.trainerId ? 'border-white/[0.04] text-white/90' : 'border-red-500/40 text-red-300'}`}
                  >
                    <option value="">— pick —</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.csvLabel ? ` (${t.csvLabel})` : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={r.studioId || ''}
                    onChange={(e) => onOverride(r.rowIndex, { studioId: e.target.value || null })}
                    className={`w-full bg-white/5 border rounded px-2 py-1 text-[12px] ${r.studioId ? 'border-white/[0.04] text-white/90' : 'border-red-500/40 text-red-300'}`}
                  >
                    <option value="">— pick —</option>
                    {studios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.csvLabel ? ` (${s.csvLabel})` : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.skipped}
                    onChange={(e) => onOverride(r.rowIndex, { skipped: e.target.checked })}
                    className="accent-[#d9ff00]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step3({ createdBatch, activeRows, estimate, estimating, estimateError, createError, creating, settings, onEstimate, onCreate }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Rows to generate" value={activeRows.length} />
        <Stat label="Duration per clip" value={`${settings.duration}s`} />
        <Stat label="Quality" value={settings.quality} />
        <Stat label="Concurrency" value={`${settings.concurrency} parallel`} />
      </div>

      <div className="bg-white/[0.02] border border-white/[0.04] rounded-md p-5">
        <p className="text-white/40 text-[12px] uppercase tracking-wide mb-2">Estimated cost</p>
        {estimate ? (
          <div>
            <div className="text-2xl font-bold text-[#d9ff00]">
              {estimate.currency} {(estimate.total).toFixed(2)}
            </div>
            <p className="text-[12px] text-white/50 mt-1">
              {estimate.currency} {(estimate.perJob).toFixed(4)}/clip × {estimate.rows} rows
            </p>
          </div>
        ) : estimating ? (
          <p className="text-white/40 text-sm">Fetching cost…</p>
        ) : estimateError ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[12px] rounded-md px-3 py-2">{estimateError}</div>
        ) : createdBatch ? (
          <button
            onClick={onEstimate}
            className="bg-white/5 border border-white/[0.04] rounded-md px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10"
          >
            Recalculate
          </button>
        ) : (
          <p className="text-white/30 text-sm">Save the batch first to fetch the live cost.</p>
        )}
      </div>

      {createError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] rounded-md px-3 py-2">{createError}</div>
      )}

      {createdBatch && (
        <div className="bg-[#d9ff00]/5 border border-[#d9ff00]/20 rounded-md p-4 text-[13px] text-white/80">
          Batch saved as draft (id <code className="text-[#d9ff00]">{createdBatch.id}</code>). The worker container will pick up its jobs once <code>feat/batch-worker</code> ships in the next PR.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-md p-4">
      <p className="text-white/40 text-[11px] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-base font-semibold">{value}</p>
    </div>
  );
}
