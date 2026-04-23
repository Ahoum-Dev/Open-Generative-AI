'use client';

import AssetLibrary from './AssetLibrary';

export default function TrainersTab({ apiKey }) {
  return (
    <AssetLibrary
      apiKey={apiKey}
      kind="trainer"
      endpoint="/api/trainers"
      emptyHint='Upload one image per trainer and label it "Trainer 1"…"Trainer 6" so CSVs auto-map.'
    />
  );
}
