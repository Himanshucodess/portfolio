import { useEffect, useRef, useState } from 'react';
import { CONTACT, PROJECTS, STACK_NOTES } from '../data/projects.js';
import { projectById } from './Statement.jsx';

// Cursor-following tooltip. Positions itself via ref (no re-renders),
// renders content from the active word. Links stay clickable: the parent
// delays closing, hovering the tooltip holds it open, and the tooltip
// freezes in place while the cursor is over it.
export default function Tooltip({ hot, onHot, onHold }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(0);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
    } catch {
      // clipboard unavailable — address is still visible for manual copy
    }
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!hot) {
      setVisible(false);
      return undefined;
    }
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, [hot ]);

  // last cursor position, tracked cheaply without touching the DOM
  const mouseRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    mouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    const track = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', track, { passive: true });
    return () => window.removeEventListener('mousemove', track);
  }, []);

  // anchor once per active word: a stable card the cursor can travel to.
  // never repositioned while open, so it can't slide out from under the cursor.
  useEffect(() => {
    const el = ref.current;
    if (!el || !hot) return undefined;
    const place = (x, y) => {
      const px = Math.min(x + 20, window.innerWidth - 320);
      const py = Math.min(y + 20, window.innerHeight - 260);
      el.style.transform = `translate(${Math.max(8, px)}px, ${Math.max(8, py)}px)`;
    };
    place(mouseRef.current.x, mouseRef.current.y);
    const touch = (e) => {
      const t = e.touches[0];
      if (t) {
        mouseRef.current = { x: t.clientX, y: t.clientY };
        place(t.clientX, t.clientY);
      }
    };
    window.addEventListener('touchstart', touch, { passive: true });
    return () => window.removeEventListener('touchstart', touch);
  }, [hot]);

  const body = renderBody(hot, onHot, { copied, copyEmail });
  const hasLinks = hot && WORD_HAS_LINKS(hot);

  return (
    <div
      ref={ref}
      role="status"
      aria-hidden={!hot}
      onMouseEnter={onHold}
      onMouseLeave={() => onHot(null)}
      className={`tip${visible && body ? ' on' : ''}${hasLinks ? ' links' : ''}`}
    >
      {body}
    </div>
  );
}

function WORD_HAS_LINKS(hot) {
  if (!hot) return false;
  return true; // every active word shows a tooltip; project/contact ones carry links
}

function renderBody(hot, onHot, mail = {}) {
  if (!hot) return null;

  if (hot === 'build') {
    return (
      <div>
        <p className="tip-kind">SELECTED WORK</p>
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="tip-mini"
            onMouseEnter={() => onHot(p.id === 'circle-store' ? 'circle' : p.id === 'attendance' ? 'attend' : 'go')}
            onFocus={() => onHot(p.id === 'circle-store' ? 'circle' : p.id === 'attendance' ? 'attend' : 'go')}
            onClick={() => window.open(p.github, '_blank', 'noreferrer')}
          >
            <span>{p.title}</span>
            <br />
            {p.description}
          </button>
        ))}
      </div>
    );
  }

  if (hot.startsWith('project:')) {
    const p = projectById(hot.slice(8));
    if (!p) return null;
    return (
      <div>
        <p className="tip-kind">PROJECT</p>
        <p className="tip-title">{p.title}</p>
        <p>{p.description}</p>
        <p className="tip-stack">{p.stack.join(' · ')}</p>
        <div className="tip-links">
          <a href={p.github} target="_blank" rel="noreferrer">
            GitHub →
          </a>
          {p.demo && (
            <a href={p.demo} target="_blank" rel="noreferrer">
              Live Demo →
            </a>
          )}
        </div>
      </div>
    );
  }

  if (hot === 'backend') {
    return (
      <div>
        <p className="tip-kind">UNDERNEATH THE INTERFACE</p>
        <p className="tip-title">backend</p>
        <p>apis, auth, databases and the architecture that holds it together.</p>
        <p className="tip-stack">{STACK_NOTES.backend.join(' · ')}</p>
        <p className="tip-stack">{STACK_NOTES.languages.join(' · ')}</p>
      </div>
    );
  }

  if (hot === 'cloud') {
    return (
      <div>
        <p className="tip-kind">SOMEWHERE ELSE</p>
        <p className="tip-title">cloud / devops</p>
        <p>containers, ci/cd, orchestration and the infrastructure around them.</p>
        <p className="tip-stack">{STACK_NOTES.cloud.join(' · ')}</p>
        <p className="tip-stack">{STACK_NOTES.frontend.join(' · ')}</p>
        <p className="tip-stack">{STACK_NOTES.aiml.join(' · ')}</p>
      </div>
    );
  }

  if (hot === 'contact' || hot === 'sayhi') {
    return (
      <div>
        <p className="tip-kind">SAY HI</p>
        <p className="tip-title">say hi back</p>
        <div className="tip-links" style={{ flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
          <a href={`mailto:${CONTACT.email}`}>Email →</a>
          <p className="tip-mailrow">
            <span className="tip-mail">{CONTACT.email}</span>
            <button type="button" className="tip-copy" onClick={mail.copyEmail}>
              {mail.copied ? '( copied ✓ )' : '( copy )'}
            </button>
          </p>
          <a href={CONTACT.github} target="_blank" rel="noreferrer">GitHub →</a>
          <a href={CONTACT.linkedin} target="_blank" rel="noreferrer">LinkedIn →</a>
          <a href={CONTACT.instagram} target="_blank" rel="noreferrer">Instagram →</a>
        </div>
      </div>
    );
  }

  if (hot === 'fit') {
    return (
      <div>
        <p className="tip-kind">OUTSIDE CODE</p>
        <p className="tip-title">@_fithimanshu</p>
        <p>fitness · content · mind-muscle connection</p>
      </div>
    );
  }

  return null;
}
