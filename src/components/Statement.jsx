import { PROJECTS } from '../data/projects.js';

// Word metadata: canvas mood + status feedback per interactive word.
export const WORDS = {
  build: { mood: 'cube', status: '( assembling )', tip: 'work' },
  circle: { mood: 'db', status: '( building )', tip: 'project:circle-store' },
  attend: { mood: 'terminal', status: '( automating )', tip: 'project:attendance' },
  go: { mood: 'pipeline', status: '( deploying )', tip: 'project:go-webapp' },
  cloud: { mood: 'cloud', status: '( somewhere in the cloud )', tip: 'cloud' },
  backend: { mood: 'mesh', status: '( thinking underneath )', tip: 'backend' },
  something: { mood: 'face', status: '( currently here. )', tip: null },
  sayhi: { mood: 'hi', status: '( say hi back )', tip: 'contact' },
  fit: { mood: 'face', status: '( outside code )', tip: 'fit' },
};

export function Word({ id, onHot, children, className = 'word' }) {
  return (
    <button
      type="button"
      className={className}
      onMouseEnter={() => onHot(id)}
      onMouseLeave={() => onHot(null)}
      onFocus={() => onHot(id)}
      onBlur={() => onHot(null)}
      onClick={() => onHot(id)}
    >
      {children}
    </button>
  );
}

export function projectById(id) {
  return PROJECTS.find((p) => p.id === id);
}

export default function Statement({ onHot }) {
  return (
    <>
      <p className="statement">
        hi, i&apos;m <em>himanshu</em>. i spend a lot of time{' '}
        <Word id="build" onHot={onHot}>turning&nbsp;ideas into&nbsp;software</Word>, and an even more
        questionable amount of time figuring out why they broke. somewhere between frontend,{' '}
        <Word id="backend" onHot={onHot}>backend</Word>, and{' '}
        <Word id="cloud" onHot={onHot}>cloud/devops</Word>, i&apos;m currently going deeper into backend.
        curious about what i do — <Word id="sayhi" onHot={onHot}>say&nbsp;hi</Word>.
      </p>
    </>
  );
}
