'use client';

import AssetLibrary from './AssetLibrary';

export default function StudiosTab({ apiKey }) {
  return (
    <AssetLibrary
      apiKey={apiKey}
      kind="studio"
      endpoint="/api/studios"
      emptyHint='Upload one image per studio and label it "Studio 1", "Studio 4", etc.'
    />
  );
}
