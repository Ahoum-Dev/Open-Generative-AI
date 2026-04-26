import BatchDetailShell from '@/components/batch/BatchDetailShell';
import { getProviderStatus } from '@/lib/serverProviders';

export const metadata = {
  title: 'Batch detail — Open Generative AI',
};

export const dynamic = 'force-dynamic';

export default async function BatchDetailPage({ params }) {
  const { id } = await params;
  const providerStatus = await getProviderStatus();
  return <BatchDetailShell batchId={id} providerStatus={providerStatus} />;
}
