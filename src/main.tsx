import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// When a newer version of the app takes control, reload once so the page
// always runs code that matches the current data schema. (Skipped on the
// very first visit, when no previous version was in control.)
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    window.location.reload();
  });
}

// Jillie must never run inside another site's page — that's the setup for
// click-hijacking. GitHub Pages can't send frame-blocking headers, so the
// app enforces it itself: break out of the frame, or refuse to render.
const framed = window.top !== window.self;
if (framed) {
  try {
    window.top!.location.replace(window.location.href);
  } catch {
    /* sandboxed frame: stay blank */
  }
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
