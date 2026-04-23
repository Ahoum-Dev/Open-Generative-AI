'use client';

import { useEffect, useState, useCallback } from 'react';
import NewBatchWizard from './NewBatchWizard';

export default function BatchesTab({ apiKey }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/batches', { headers: { 'x-api-key': apiKey } });
      if (!res.ok) throw new Error(`GET /api/batches failed: ${res.status}`);
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Batches</h1>
          <p className="text-white/40 text-[13px] mt-1">
            Upload a CSV, map trainers, run MuAPI video generations end-to-end.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="bg-[#d9ff00] text-black font-medium text-sm rounded-md px-4 py-2 hover:bg-[#e5ff33] transition-all"
        >
          + New batch
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] rounded-md px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="text-white/40 text-sm py-12 text-center">Loading…</div>
      ) : batches.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-md px-6 py-12 text-center">
          <p className="text-white/50 text-sm">No batches yet.</p>
          <p className="text-white/30 text-[12px] mt-2">Click <span className="text-[#d9ff00]">+ New batch</span> to upload your CSV.</p>
        </div>
      ) : (
        <div className="border border-white/[0.04] rounded-md overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.02] text-white/40 text-[11px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3 w-32">Status</th>
                <th className="text-left px-4 py-3 w-36">Progress</th>
                <th className="text-left px-4 py-3 w-32">Model</th>
                <th className="text-left px-4 py-3 w-28">Created</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/90 font-medium">{b.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-white/60 text-[12px]">
                    {b.done}/{b.total} done · {b.failed} failed
                  </td>
                  <td className="px-4 py-3 text-white/50 text-[12px]">{b.model}</td>
                  <td className="px-4 py-3 text-white/40 text-[12px]">
                    {new Date(b.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {wizardOpen && (
        <NewBatchWizard
          apiKey={apiKey}
          onClose={() => setWizardOpen(false)}
          onCreated={async () => {
            setWizardOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-white/5 text-white/60 border-white/10',
    running: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    paused: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    completed: 'bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/30',
    cancelled: 'bg-white/5 text-white/40 border-white/10',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide font-semibold ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}
