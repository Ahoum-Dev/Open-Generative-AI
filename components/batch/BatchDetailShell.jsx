'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProviderKeysModal from '@/components/ProviderKeysModal';
import { getKey } from '@/lib/keyStore';
import BatchDetail from './BatchDetail';

export default function BatchDetailShell({ batchId, providerStatus = [] }) {
  const router = useRouter();
  const [editingKeys, setEditingKeys] = useState(false);

  const noKeys = !providerStatus.some((p) => p.hasKey);

  const handleKeysDone = () => {
    setEditingKeys(false);
    router.refresh();
  };

  if (noKeys || editingKeys) {
    return (
      <ProviderKeysModal
        providerStatus={providerStatus}
        onDone={handleKeysDone}
        onClose={() => setEditingKeys(false)}
        allowClose={!noKeys}
      />
    );
  }

  // BatchDetail uses the apiKey only for trainer/studio fetches and the
  // simulate/start/pause control routes — none of which are provider-specific.
  // Pass the MuAPI key for backwards compatibility; server falls back to env
  // when the header is empty.
  const apiKey = (typeof window !== 'undefined' && getKey('muapi')) || '';
  return <BatchDetail batchId={batchId} apiKey={apiKey} providerStatus={providerStatus} />;
}
