'use client';

// Two-pill switcher between the Studio (image/video/etc) and the Batch
// (CSV-driven automation) sections. Rendered in the header of every
// shell so wherever you are, you can jump to the other side.

const SECTIONS = [
  { id: 'studio', label: 'Studio', href: '/studio' },
  { id: 'batch', label: 'Batch', href: '/batch' },
];

export default function SectionSwitcher({ active }) {
  return (
    <nav
      role="tablist"
      aria-label="Section"
      className="flex items-center gap-0.5 bg-white/5 border border-white/[0.04] rounded-md p-0.5"
    >
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={s.href}
            aria-selected={isActive}
            role="tab"
            className={`px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              isActive
                ? 'bg-[#d9ff00] text-black'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
            onClick={(e) => {
              try {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lastSection', s.id);
                }
              } catch {}
            }}
          >
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
