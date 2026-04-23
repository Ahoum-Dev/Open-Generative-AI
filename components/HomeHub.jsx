'use client';

import { useEffect, useState } from 'react';

const CARDS = [
  {
    id: 'batch',
    title: 'Batch',
    tagline: 'CSV in. 255 videos out.',
    description:
      'Upload a CSV, map trainers and studios once, hit Start, and a background worker submits every row to MuAPI seedance-v2.0-i2v with retries, pause/resume, and per-row results.',
    href: '/batch',
    accent: 'bg-[#d9ff00] text-black hover:bg-[#e5ff33]',
    badge: 'CSV-driven automation',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    bullets: ['CSV upload + auto-mapping', 'Live progress + retry', 'Results CSV export'],
  },
  {
    id: 'studio',
    title: 'Studio',
    tagline: 'One generation at a time.',
    description:
      '200+ MuAPI models for ad-hoc image, video, lip-sync, and cinema generations. Use this when you want to experiment with a single prompt rather than run a CSV.',
    href: '/studio',
    accent: 'bg-white/10 text-white hover:bg-white/20 border border-white/20',
    badge: 'For one-offs and exploration',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    bullets: ['Image / Video / Lip Sync / Cinema', 'Bring-your-own MuAPI key', 'Live preview + history'],
  },
];

const LAST_KEY = 'lastSection';

export default function HomeHub() {
  const [lastSection, setLastSection] = useState(null);

  useEffect(() => {
    try {
      setLastSection(localStorage.getItem(LAST_KEY));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col">
      <header className="flex-shrink-0 h-14 border-b border-white/[0.03] flex items-center px-6 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">OpenGenerativeAI</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pick a workspace</h1>
            <p className="text-white/50 text-sm mt-2">
              Use Batch for the CSV pipeline. Use Studio for ad-hoc generations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {CARDS.map((c) => {
              const isLast = lastSection === c.id;
              return (
                <a
                  key={c.id}
                  href={c.href}
                  onClick={() => {
                    try { localStorage.setItem(LAST_KEY, c.id); } catch {}
                  }}
                  className={`group relative bg-[#0a0a0a] border rounded-xl p-7 flex flex-col transition-all hover:translate-y-[-2px] hover:border-white/15 ${
                    isLast ? 'border-[#d9ff00]/40 ring-1 ring-[#d9ff00]/20' : 'border-white/[0.05]'
                  }`}
                >
                  {isLast && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide font-bold text-[#d9ff00]">
                      Last used
                    </span>
                  )}

                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      c.id === 'batch' ? 'bg-[#d9ff00]/10 text-[#d9ff00]' : 'bg-white/5 text-white/80'
                    }`}>
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 font-semibold">{c.badge}</p>
                      <h2 className="text-2xl font-bold mt-0.5">{c.title}</h2>
                      <p className="text-white/60 text-sm">{c.tagline}</p>
                    </div>
                  </div>

                  <p className="text-white/50 text-[13px] leading-relaxed mb-5">{c.description}</p>

                  <ul className="space-y-1.5 mb-6">
                    {c.bullets.map((b) => (
                      <li key={b} className="text-[12px] text-white/60 flex items-start gap-2">
                        <span className="text-[#d9ff00] mt-0.5">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${c.accent}`}>
                      Open {c.title} →
                    </span>
                  </div>
                </a>
              );
            })}
          </div>

          <p className="text-center text-[11px] text-white/30 mt-8">
            <a href="/batch" className="hover:text-white/60">/batch</a>{' '}·{' '}
            <a href="/studio" className="hover:text-white/60">/studio</a>
          </p>
        </div>
      </main>
    </div>
  );
}
