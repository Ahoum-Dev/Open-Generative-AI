import BatchDetailShell from '@/components/batch/BatchDetailShell';

export const metadata = {
  title: 'Batch detail — Open Generative AI',
};

export default async function BatchDetailPage({ params }) {
  const { id } = await params;
  return <BatchDetailShell batchId={id} />;
}
