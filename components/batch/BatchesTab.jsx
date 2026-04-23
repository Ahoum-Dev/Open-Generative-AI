'use client';

export default function BatchesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Batches</h1>
          <p className="text-white/40 text-[13px] mt-1">
            Upload a CSV, map trainers, run MuAPI video generations end-to-end.
          </p>
        </div>
        <button
          disabled
          className="bg-white/5 text-white/40 font-medium text-sm rounded-md px-4 py-2 border border-white/5 cursor-not-allowed"
        >
          + New batch
        </button>
      </div>

      <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-md px-6 py-12 text-center">
        <p className="text-white/50 text-sm">Batch creation lands in the next slice.</p>
        <p className="text-white/30 text-[12px] mt-2">
          For now, populate the Trainers and Studios libraries so the CSV auto-mapping has something to match against.
        </p>
      </div>
    </div>
  );
}
