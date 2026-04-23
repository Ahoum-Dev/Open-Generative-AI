'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

const STATUS_STYLES = {
  draft: 'bg-white/5 text-white/60 border-white/10',
  queued: 'bg-white/5 text-white/40 border-white/10',
  submitting: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  polling: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  done: 'bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/30',
  failed: 'bg-red-500/10 text-red-300 border-red-500/30',
  cancelled: 'bg-white/5 text-white/30 border-white/10',
  paused: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  running: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  completed: 'bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/30',
};

export default function BatchDetail({ batchId, apiKey }) {
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [filter, setFilter] = useState('all'); // all|done|failed|pending
  const [previewUrl, setPreviewUrl] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/batches/${batchId}`, { headers: { 'x-api-key': apiKey } });
      if (!res.ok) throw new Error(`GET batch failed: ${res.status}`);
      const data = await res.json();
      setBatch(data.batch);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [batchId, apiKey]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll while a batch is actively progressing.
  useEffect(() => {
    if (!batch) return undefined;
    if (!['running', 'paused'].includes(batch.status)) return undefined;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [batch, refresh]);

  const action = async (path, label) => {
    setBusyAction(label);
    try {
      const res = await fetch(`/api/batches/${batchId}${path}`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${label} failed: ${res.status}`);
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const retryJob = async (jobId) => {
    setBusyAction(`retry-${jobId}`);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Retry failed: ${res.status}`);
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const filteredJobs = useMemo(() => {
    if (!batch?.jobs) return [];
    if (filter === 'done') return batch.jobs.filter((j) => j.status === 'done');
    if (filter === 'failed') return batch.jobs.filter((j) => j.status === 'failed');
    if (filter === 'pending') return batch.jobs.filter((j) => !['done', 'failed', 'cancelled'].includes(j.status));
    return batch.jobs;
  }, [batch, filter]);

  if (loading && !batch) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center">
        <div className="animate-spin text-[#d9ff00] text-3xl">◌</div>
      </div>
    );
  }
  if (error && !batch) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-6 py-4 rounded-md max-w-md">{error}</div>
      </div>
    );
  }
  if (!batch) return null;

  const pct = batch.total > 0 ? Math.min(100, Math.round((batch.done / batch.total) * 100)) : 0;
  const failedCount = batch.failed;
  const inflightCount = batch.jobs.filter((j) => ['submitting', 'polling'].includes(j.status)).length;
  const queuedCount = batch.jobs.filter((j) => j.status === 'queued').length;

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col">
      {/* Top header */}
      <header className="flex-shrink-0 h-14 border-b border-white/[0.03] flex items-center justify-between px-6 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a href="/batch" className="text-white/40 hover:text-white text-[12px]">← Back to batches</a>
          <span className="text-white/20">/</span>
          <span className="text-sm font-bold tracking-tight">{batch.name}</span>
          <StatusPill status={batch.status} />
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/batches/${batchId}/export`}
            className="text-[12px] text-white/60 hover:text-white px-3 py-1.5 rounded-md border border-white/[0.04] bg-white/[0.02] hover:bg-white/5 transition-all"
          >
            ↓ Download CSV
          </a>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Progress card */}
          <section className="bg-[#0a0a0a] border border-white/[0.04] rounded-md p-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wide">Progress</p>
                <p className="text-3xl font-bold mt-1">
                  {batch.done}<span className="text-white/30 text-base"> / {batch.total}</span>
                </p>
                <p className="text-[12px] text-white/50 mt-1">
                  {failedCount > 0 && <span className="text-red-300">{failedCount} failed · </span>}
                  {inflightCount > 0 && <span className="text-blue-300">{inflightCount} running · </span>}
                  {queuedCount} queued
                </p>
              </div>
              <ControlButtons batch={batch} busyAction={busyAction} action={action} />
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d9ff00] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-white/40">{pct}% complete</p>
              {['running', 'paused'].includes(batch.status) && (
                <p className="text-[10px] text-white/30 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#d9ff00] animate-pulse" /> auto-refresh every 3s
                </p>
              )}
            </div>
          </section>

          {/* Settings summary */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Mini label="Model" value={batch.model} />
            <Mini label="Duration" value={`${batch.duration}s`} />
            <Mini label="Quality" value={batch.quality} />
            <Mini label="Aspect" value={batch.aspectRatio} />
            <Mini label="Concurrency" value={`${batch.concurrency}×`} />
          </section>

          {/* Filters */}
          <section className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.04] rounded-md p-0.5">
              {[
                { id: 'all', label: `All (${batch.jobs.length})` },
                { id: 'pending', label: `Pending (${queuedCount + inflightCount})` },
                { id: 'done', label: `Done (${batch.done})` },
                { id: 'failed', label: `Failed (${failedCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    filter === f.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => action('/simulate', 'simulate')}
                disabled={busyAction === 'simulate' || !['running', 'paused', 'draft'].includes(batch.status)}
                className="bg-white/5 border border-white/[0.04] text-white/70 hover:bg-white/10 text-[11px] px-3 py-1.5 rounded-md transition-all disabled:opacity-30"
                title="Demo helper — marks ~10% of queued jobs as done with a placeholder video URL"
              >
                {busyAction === 'simulate' ? 'Simulating…' : '⚡ Simulate progress (demo)'}
              </button>
            </div>
          </section>

          {/* Jobs table */}
          <section className="border border-white/[0.04] rounded-md overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.02] text-white/40 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 w-10">#</th>
                  <th className="text-left px-3 py-2">Practice</th>
                  <th className="text-left px-3 py-2 w-32">Trainer</th>
                  <th className="text-left px-3 py-2 w-28">Studio</th>
                  <th className="text-left px-3 py-2 w-28">Status</th>
                  <th className="text-left px-3 py-2 w-32">Result</th>
                  <th className="text-right px-3 py-2 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-white/40">{job.rowIndex + 1}</td>
                    <td className="px-3 py-2 text-white/90">
                      <div className="font-medium">{job.practiceName}</div>
                      {job.error && <div className="text-red-400/80 text-[11px] mt-0.5 line-clamp-1">{job.error}</div>}
                    </td>
                    <td className="px-3 py-2 text-white/60 text-[11px]">{job.trainer?.name || '—'}</td>
                    <td className="px-3 py-2 text-white/60 text-[11px]">{job.studio?.name || '—'}</td>
                    <td className="px-3 py-2"><StatusPill status={job.status} /></td>
                    <td className="px-3 py-2">
                      {job.videoUrl ? (
                        <button
                          onClick={() => setPreviewUrl(job.videoUrl)}
                          className="text-[#d9ff00] hover:underline text-[11px]"
                        >
                          ▶ Play
                        </button>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => retryJob(job.id)}
                          disabled={busyAction === `retry-${job.id}`}
                          className="bg-white/5 border border-white/[0.04] text-white/70 hover:bg-white/10 text-[10px] px-2 py-1 rounded transition-all"
                        >
                          {busyAction === `retry-${job.id}` ? '…' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-white/30 text-[12px]">No jobs in this filter.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>

      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="bg-black border border-white/10 rounded-md overflow-hidden max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <video src={previewUrl} controls autoPlay className="w-full" />
            <div className="px-3 py-2 flex items-center justify-between text-[11px] text-white/40">
              <a href={previewUrl} target="_blank" rel="noreferrer" className="hover:text-white truncate">{previewUrl}</a>
              <button onClick={() => setPreviewUrl(null)} className="text-white/60 hover:text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.queued}`}>
      {status}
    </span>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-md p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-white truncate">{value}</p>
    </div>
  );
}

function ControlButtons({ batch, busyAction, action }) {
  const btn = 'h-9 px-3 rounded-md text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-2">
      {batch.status === 'draft' && (
        <button
          onClick={() => action('/start', 'start')}
          disabled={busyAction === 'start'}
          className={`${btn} bg-[#d9ff00] text-black hover:bg-[#e5ff33]`}
        >
          {busyAction === 'start' ? 'Starting…' : '▶ Start batch'}
        </button>
      )}
      {batch.status === 'running' && (
        <>
          <button
            onClick={() => action('/pause', 'pause')}
            disabled={busyAction === 'pause'}
            className={`${btn} bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/20`}
          >
            {busyAction === 'pause' ? '…' : '⏸ Pause'}
          </button>
          <button
            onClick={() => { if (confirm('Cancel this batch? Queued jobs will stop.')) action('/cancel', 'cancel'); }}
            disabled={busyAction === 'cancel'}
            className={`${btn} bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20`}
          >
            {busyAction === 'cancel' ? '…' : '✕ Cancel'}
          </button>
        </>
      )}
      {batch.status === 'paused' && (
        <>
          <button
            onClick={() => action('/resume', 'resume')}
            disabled={busyAction === 'resume'}
            className={`${btn} bg-[#d9ff00] text-black hover:bg-[#e5ff33]`}
          >
            {busyAction === 'resume' ? '…' : '▶ Resume'}
          </button>
          <button
            onClick={() => { if (confirm('Cancel this batch? Queued jobs will stop.')) action('/cancel', 'cancel'); }}
            disabled={busyAction === 'cancel'}
            className={`${btn} bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20`}
          >
            ✕ Cancel
          </button>
        </>
      )}
    </div>
  );
}
