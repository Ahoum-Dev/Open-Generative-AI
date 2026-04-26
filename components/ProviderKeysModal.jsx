'use client';

import { useEffect, useState } from 'react';
import { getAllKeys, setKey, clearKey } from '@/lib/keyStore';

const PROVIDER_META = [
  { id: 'muapi', label: 'MuAPI', signupUrl: 'https://muapi.ai/access-keys', placeholder: 'mu_...' },
  { id: 'segmind', label: 'Segmind', signupUrl: 'https://www.segmind.com/console/api-keys', placeholder: 'SG_...' },
  { id: 'byteplus', label: 'BytePlus ModelArk', signupUrl: 'https://console.byteplus.com/ark', placeholder: 'BP_...' },
  { id: 'openrouter', label: 'OpenRouter', signupUrl: 'https://openrouter.ai/keys', placeholder: 'sk-or-...' },
];

export default function ProviderKeysModal({ onDone, onClose, allowClose = false }) {
  const [drafts, setDrafts] = useState({});
  const [saved, setSaved] = useState({});

  useEffect(() => {
    const existing = getAllKeys();
    setSaved(existing);
    setDrafts(existing);
  }, []);

  const handleChange = (id, value) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handleSaveOne = (id) => {
    const v = (drafts[id] || '').trim();
    if (v) setKey(id, v);
    else clearKey(id);
    setSaved((prev) => {
      const next = { ...prev };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });
  };

  const handleContinue = () => {
    // Save all drafts in one go and close.
    PROVIDER_META.forEach((p) => {
      const v = (drafts[p.id] || '').trim();
      if (v) setKey(p.id, v);
      else clearKey(p.id);
    });
    onDone?.();
  };

  const anyKey = Object.values(drafts).some((v) => (v || '').trim());

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 font-inter py-12">
      <div className="w-full max-w-2xl bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/10 rounded-xl p-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto bg-[#d9ff00]/5 rounded-2xl flex items-center justify-center border border-[#d9ff00]/10 mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="1.5">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">Provider API keys</h1>
          <p className="text-white/40 text-[13px] leading-relaxed px-4">
            Add a key for each provider you want to use. Batches dispatch to whichever provider you pick at creation time.
          </p>
        </div>

        <div className="space-y-4">
          {PROVIDER_META.map((p) => {
            const value = drafts[p.id] || '';
            const isSaved = !!saved[p.id];
            return (
              <div key={p.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-[13px] font-semibold">{p.label}</span>
                    {isSaved && (
                      <span className="text-[10px] uppercase tracking-wide text-[#d9ff00]/80 bg-[#d9ff00]/10 px-1.5 py-0.5 rounded">saved</span>
                    )}
                  </div>
                  <a
                    href={p.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-white/40 hover:text-[#d9ff00]"
                  >
                    Get a key →
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={value}
                    onChange={(e) => handleChange(p.id, e.target.value)}
                    placeholder={p.placeholder}
                    className="flex-1 bg-white/5 border border-white/[0.03] rounded-md px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    suppressHydrationWarning
                  />
                  <button
                    onClick={() => handleSaveOne(p.id)}
                    className="bg-white/5 border border-white/[0.04] rounded-md px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          {allowClose ? (
            <button
              onClick={onClose}
              className="text-[12px] text-white/40 hover:text-white/80"
            >
              Cancel
            </button>
          ) : <span />}
          <button
            onClick={handleContinue}
            disabled={!anyKey}
            className="bg-[#d9ff00] text-black font-medium text-[13px] rounded-md px-5 py-2 hover:bg-[#e5ff33] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
