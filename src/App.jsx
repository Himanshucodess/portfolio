import { useCallback, useEffect, useRef, useState } from 'react';
import FaceCanvas from './components/FaceCanvas.jsx';
import Statement, { WORDS, Word } from './components/Statement.jsx';
import Tooltip from './components/Tooltip.jsx';
import StatusLine from './components/StatusLine.jsx';
import Terminal from './components/Terminal.jsx';
import CommandPalette from './components/CommandPalette.jsx';

function initialTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem('hs-theme') || 'light';
}

// Playful daily counter — deterministic per calendar day, so it reads stable
// today and rolls to a new number tomorrow. Not real analytics.
function todaysVisitors() {
  const d = new Date();
  let h = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 1 | h);
  h ^= h + Math.imul(h ^ (h >>> 7), 61 | h);
  h ^= h >>> 14;
  const r = (h >>> 0) / 4294967296;
  return 28 + Math.floor(r * 45); // 28–72
}

// One viewport composition: left text ↔ right canvas.
export default function App() {
  const [hot, setHot] = useState(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const closeTimer = useRef(0);

  // Delayed close: leaving a word starts a short timer instead of hiding
  // instantly, so the cursor can travel onto the tooltip and its links.
  const onHot = useCallback((id) => {
    window.clearTimeout(closeTimer.current);
    if (id) {
      setHot(id);
    } else {
      closeTimer.current = window.setTimeout(() => setHot(null), 320);
    }
  }, []);

  // Hovering the tooltip itself holds it open.
  const onHold = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    window.localStorage.setItem('hs-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#0F0E0C' : '#FAF9F6',
    );
  }, [theme]);

  const mood = hot && WORDS[hot] ? WORDS[hot].mood : 'dense';
  const status = hot && WORDS[hot] ? WORDS[hot].status : '( hi. )';
  const visitors = todaysVisitors();

  useEffect(() => {
    const open = () => setTerminalOpen(true);
    window.addEventListener('open-terminal', open);
    return () => window.removeEventListener('open-terminal', open);
  }, []);

  useEffect(() => {
    const esc = (e) => {
      if (e.key === 'Escape') setHot(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  return (
    <div id="top">
      <a
        href="#statement"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[130] focus:bg-[var(--acc)] focus:p-3 focus:text-[var(--bg)]"
      >
        Skip to introduction
      </a>

      <p className="meta meta-bl">( {visitors} of you today, hi. )</p>
      <div className="meta meta-br">
        <Word id="fit" onHot={onHot} className="meta-link">
          @_fithimanshu
        </Word>
        <button
          type="button"
          className="meta-link"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          ( {theme === 'dark' ? 'light' : 'dark'} )
        </button>
        <button
          type="button"
          className="meta-link"
          onClick={() => setTerminalOpen(true)}
          aria-label="Open terminal overlay"
        >
          &gt;_
        </button>
      </div>

      <main className="stage">
        <section className="stage-left" id="statement" aria-label="Introduction">
          <Statement onHot={onHot} />
        </section>
        <section className="stage-right" aria-label="Interactive ascii canvas">
          <FaceCanvas mood={mood} />
          <StatusLine status={status} />
        </section>
      </main>

      <Tooltip hot={hot} onHot={onHot} onHold={onHold} />
      <Terminal open={terminalOpen} onClose={() => setTerminalOpen(false)} />
      <CommandPalette onMood={(m) => setHot(moodToWord(m))} />
    </div>
  );
}

// palette speaks moods; translate back to the word that owns each mood
function moodToWord(m) {
  const entry = Object.entries(WORDS).find(([, w]) => w.mood === m);
  return entry ? entry[0] : null;
}
