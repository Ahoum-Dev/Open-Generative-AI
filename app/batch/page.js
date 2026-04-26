import BatchShell from '@/components/batch/BatchShell';
import { getProviderStatus } from '@/lib/serverProviders';

export const metadata = {
  title: 'Batch — Open Generative AI',
};

export const dynamic = 'force-dynamic';

export default async function BatchPage() {
  const providerStatus = await getProviderStatus();
  return <BatchShell providerStatus={providerStatus} />;
}
