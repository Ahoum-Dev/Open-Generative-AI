'use client';

import { useEffect, useState } from 'react';
import ApiKeyModal from '@/components/ApiKeyModal';
import TrainersTab from './TrainersTab';
import StudiosTab from './StudiosTab';
import BatchesTab from './BatchesTab';

const STORAGE_KEY = 'muapi_key';

const TABS = [
  { id: 'batches', label: 'Batches' },
  { id: 'trainers', label: 'Trainers' },
  { id: 'studios', label: 'Studios' },
];

export default function BatchShell() {
  const [apiKey, setApiKey] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('batches');

  useEffect(() => {
    setHasMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      setApiKey(stored);
      document.cookie = `muapi_key=${stored}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const handleKeySave = (key) => {
    localStorage.setItem(STORAGE_KEY, key);
    document.cookie = `muapi_key=${key}; path=/; max-age=31536000; SameSite=Lax`;
    setApiKey(key);
  };

  const handleKeyChange = () => {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = 'muapi_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setApiKey(null);
  };

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin text-[#d9ff00] text-3xl">◌</div>
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyModal onSave={handleKeySave} />;
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col">
      <header className="flex-shrink-0 h-14 border-b border-white/[0.03] flex items-center justify-between px-6 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">Batch</span>
          <span className="text-white/30 text-sm">/ Open Generative AI</span>
        </div>

        <nav className="flex items-center gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative py-4 text-[13px] font-medium transition-all whitespace-nowrap px-1 ${
                activeTab === tab.id ? 'text-[#d9ff00]' : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d9ff00] rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/studio"
            className="text-[12px] text-white/50 hover:text-white/80 transition-colors"
          >
            ← Studio
          </a>
          <button
            onClick={handleKeyChange}
            className="text-[11px] text-white/40 hover:text-red-400 transition-colors"
          >
            Change key
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'batches' && <BatchesTab apiKey={apiKey} />}
          {activeTab === 'trainers' && <TrainersTab apiKey={apiKey} />}
          {activeTab === 'studios' && <StudiosTab apiKey={apiKey} />}
        </div>
      </main>
    </div>
  );
}
