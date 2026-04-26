'use client';

import { useEffect, useState } from 'react';
import ProviderKeysModal from '@/components/ProviderKeysModal';
import { getAllKeys, hasAnyKey } from '@/lib/keyStore';
import BatchDetail from './BatchDetail';

export default function BatchDetailShell({ batchId }) {
  const [keys, setKeys] = useState({});
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    setKeys(getAllKeys());
  }, []);

  const handleKeysDone = () => {
    setKeys(getAllKeys());
  };

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin text-[#d9ff00] text-3xl">◌</div>
      </div>
    );
  }

  if (!hasAnyKey()) {
    return <ProviderKeysModal onDone={handleKeysDone} />;
  }

  // BatchDetail uses the apiKey only for trainer/studio fetches and the
  // simulate/start/pause control routes — none of which are provider-specific.
  // Pass the MuAPI key for backwards compatibility.
  const apiKey = keys.muapi || Object.values(keys)[0] || '';
  return <BatchDetail batchId={batchId} apiKey={apiKey} keys={keys} />;
}
