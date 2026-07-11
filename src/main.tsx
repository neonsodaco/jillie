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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
