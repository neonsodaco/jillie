import { Fragment } from 'react';

const URL_SPLIT = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;
const IS_URL = /^(https?:\/\/|www\.)/;

/**
 * Renders note text with any web links tappable — they open in the
 * phone's browser (a new tab outside the installed app).
 */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (!IS_URL.test(part)) return <Fragment key={i}>{part}</Fragment>;
        // links often get pasted with a trailing full stop or bracket
        const trimmed = part.replace(/[.,;:)\]]+$/, '');
        const tail = part.slice(trimmed.length);
        const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        return (
          <Fragment key={i}>
            <a className="note-link" href={href} target="_blank" rel="noopener noreferrer">
              {trimmed}
            </a>
            {tail}
          </Fragment>
        );
      })}
    </>
  );
}
