import { useState } from 'react';

const SLIDES = [
  {
    title: 'Hello, Jillian.',
    body: 'This app keeps all your DIY projects in one place — every task, every note, every picture — so none of it has to live in your head.'
  },
  {
    title: 'Your Today screen.',
    body: "Each morning it shows what needs you: anything running late, anything due, anything important. If it says nothing needs you — put the kettle on."
  },
  {
    title: 'Screenshots go straight in.',
    body: 'See something you like while browsing? Screenshot it, tap Share, pick this app, and choose the task it belongs to. That\'s it.'
  }
];

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  return (
    <div className="welcome">
      <img src="./icons/icon-192.png" alt="" className="welcome-icon" />
      <h1>{SLIDES[i].title}</h1>
      <p>{SLIDES[i].body}</p>
      <div className="dots" aria-hidden>
        {SLIDES.map((_, j) => (
          <span key={j} className={j === i ? 'on' : ''} />
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => (last ? onDone() : setI(i + 1))}>
        {last ? "Let's go" : 'Next'}
      </button>
      {!last && (
        <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={onDone}>
          Skip
        </button>
      )}
    </div>
  );
}
