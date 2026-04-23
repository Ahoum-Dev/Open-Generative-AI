'use client';

import { useEffect, useState, useCallback } from 'react';
import AddAssetModal from './AddAssetModal';

export default function AssetLibrary({ apiKey, kind, endpoint, emptyHint }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const collectionKey = kind === 'trainer' ? 'trainers' : 'studios';
  const label = kind === 'trainer' ? 'Trainer' : 'Studio';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { headers: { 'x-api-key': apiKey } });
      if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.status}`);
      const data = await res.json();
      setItems(data[collectionKey] || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, apiKey, collectionKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${label.toLowerCase()}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed: ${res.status}`);
      }
      await refresh();
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{label} library</h1>
          <p className="text-white/40 text-[13px] mt-1">
            Upload once, reuse across every batch. CSV auto-mapping looks up by label.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-[#d9ff00] text-black font-medium text-sm rounded-md px-4 py-2 hover:bg-[#e5ff33] transition-all"
        >
          + Add {label.toLowerCase()}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-sm py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-md px-6 py-12 text-center">
          <p className="text-white/50 text-sm">No {label.toLowerCase()}s yet.</p>
          {emptyHint && <p className="text-white/30 text-[12px] mt-2">{emptyHint}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <AssetCard key={item.id} item={item} label={label} onDelete={() => handleDelete(item.id)} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddAssetModal
          apiKey={apiKey}
          endpoint={endpoint}
          label={label}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function AssetCard({ item, label, onDelete }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-md overflow-hidden group">
      <div className="aspect-square bg-black/40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-white truncate">{item.name}</div>
        {item.csvLabel && (
          <div className="mt-1 inline-block bg-white/5 border border-white/5 rounded-full px-2 py-0.5 text-[10px] text-white/60 uppercase tracking-wide">
            {item.csvLabel}
          </div>
        )}
        <button
          onClick={onDelete}
          className="mt-3 w-full text-[11px] text-white/40 hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
