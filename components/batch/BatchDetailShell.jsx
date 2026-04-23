'use client';

import { useEffect, useState } from 'react';
import ApiKeyModal from '@/components/ApiKeyModal';
import BatchDetail from './BatchDetail';

const STORAGE_KEY = 'muapi_key';

export default function BatchDetailShell({ batchId }) {
  const [apiKey, setApiKey] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);

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

  return <BatchDetail batchId={batchId} apiKey={apiKey} />;
}
