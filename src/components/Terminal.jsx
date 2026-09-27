import { useEffect } from 'react';
import { CONTACT, STACK_NOTES } from '../data/projects.js';

const LINES = [
  ['$ whoami', 'himanshu'],
  ['$ education', '7th semester ise @ nmit'],
  ['$ stack', [...STACK_NOTES.frontend.slice(0, 2), 'node', 'postgresql', 'docker', 'kubernetes', 'aws'].join(' · ')],
  ['$ currently', 'learning backend engineering'],
  ['$ contact', CONTACT.email],
  ['$ location', 'bengaluru, india'],
];

export default function Terminal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/25 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Terminal overlay"
    >
      <div
        className="overlay-cream w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="mono text-[11px] tracking-[0.24em] text-[var(--dim)]">
            himanshu@portfolio:~
          </span>
          <button onClick={onClose} aria-label="Close terminal" className="meta-link text-sm">
            ×
          </button>
        </div>
        <div className="mono space-y-4 text-[13px] leading-relaxed">
          {LINES.map(([cmd, out]) => (
            <div key={cmd}>
              <p className="text-[var(--ink)]">{cmd}</p>
              <p className="text-[var(--acc)]">{out}</p>
            </div>
          ))}
          <p className="text-[var(--dim)]">
            $ <span className="animate-pulse">▊</span>
          </p>
        </div>
      </div>
    </div>
  );
}
