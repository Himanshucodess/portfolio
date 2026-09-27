import { useEffect, useRef, useState } from 'react';
import { CONTACT } from '../data/projects.js';

const MOODS = [
  ['show portrait', 'face'],
  ['show cube', 'cube'],
  ['show database', 'db'],
  ['show terminal', 'terminal'],
  ['show deployment', 'pipeline'],
  ['show cloud', 'cloud'],
  ['say hi', 'hi'],
];

export default function CommandPalette({ onMood }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');

  const OPTIONS = [
    ...MOODS.map(([label, mood]) => ({ label, run: () => onMood(mood) })),
    { label: 'open terminal', run: () => window.dispatchEvent(new Event('open-terminal')) },
    { label: 'copy email', run: () => navigator.clipboard?.writeText(CONTACT.email).catch(() => {}) },
    { label: 'open github', run: () => window.open(CONTACT.github, '_blank', 'noreferrer') },
    { label: 'open linkedin', run: () => window.open(CONTACT.linkedin, '_blank', 'noreferrer') },
  ];

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !open && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open ]);

  if (!open) return null;
  const filtered = OPTIONS.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  const choose = (i) => {
    const opt = filtered[i];
    if (!opt) return;
    setOpen(false);
    opt.run();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/25 p-6 pt-28"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="overlay-cream w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') choose(active);
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          placeholder="type a command… (esc to close)"
          className="mono w-full border-b border-[var(--line-soft)] bg-transparent px-4 py-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--dim-soft)]"
          aria-label="Command search"
        />
        <ul className="max-h-64 overflow-auto py-2">
          {filtered.map((o, i) => (
            <li key={o.label}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`mono block w-full px-4 py-2.5 text-left text-[13px] tracking-[0.04em] ${
                  i === active ? 'bg-[var(--acc-soft)] text-[var(--acc)]' : 'text-[var(--dim)]'
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="mono px-4 py-3 text-[13px] text-[var(--dim)]">no matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
