'use client';

import { useEffect, useState } from 'react';
import ProviderKeysModal from '@/components/ProviderKeysModal';
import SectionSwitcher from '@/components/SectionSwitcher';
import { getAllKeys, hasAnyKey } from '@/lib/keyStore';
import TrainersTab from './TrainersTab';
import StudiosTab from './StudiosTab';
import BatchesTab from './BatchesTab';

const TABS = [
  { id: 'batches', label: 'Batches' },
  { id: 'trainers', label: 'Trainers' },
  { id: 'studios', label: 'Studios' },
];

export default function BatchShell() {
  const [keys, setKeys] = useState({});
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('batches');
  const [editingKeys, setEditingKeys] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    setKeys(getAllKeys());
  }, []);

  const handleKeysDone = () => {
    setKeys(getAllKeys());
    setEditingKeys(false);
  };

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin text-[#d9ff00] text-3xl">◌</div>
      </div>
    );
  }

  const noKeys = !hasAnyKey();
  if (noKeys || editingKeys) {
    return (
      <ProviderKeysModal
        onDone={handleKeysDone}
        onClose={() => setEditingKeys(false)}
        allowClose={!noKeys}
      />
    );
  }

  // Trainer/Studio CRUD currently uploads to MuAPI eagerly when the key is
  // present. Pass the MuAPI key (if any) so existing behavior keeps working;
  // those routes fall back to local-only when no key is given.
  const trainerStudioKey = keys.muapi || '';

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col">
      <header className="flex-shrink-0 h-14 border-b border-white/[0.03] flex items-center justify-between px-6 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" title="Home">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight hidden sm:block">OpenGenerativeAI</span>
          </a>
          <SectionSwitcher active="batch" />
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
          <span className="text-[11px] text-white/40">
            {Object.keys(keys).length} provider{Object.keys(keys).length === 1 ? '' : 's'} configured
          </span>
          <button
            onClick={() => setEditingKeys(true)}
            className="text-[11px] text-white/60 hover:text-[#d9ff00] transition-colors"
          >
            Manage keys
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'batches' && <BatchesTab apiKey={trainerStudioKey} keys={keys} />}
          {activeTab === 'trainers' && <TrainersTab apiKey={trainerStudioKey} />}
          {activeTab === 'studios' && <StudiosTab apiKey={trainerStudioKey} />}
        </div>
      </main>
    </div>
  );
}
