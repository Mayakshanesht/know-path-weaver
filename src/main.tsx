import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Recover from a stale tab after a deploy.
 *
 * Chunk filenames are content-hashed, so every deploy renames them. A tab that was
 * loaded before the deploy still holds the OLD index.html, and the moment it lazy-loads
 * a route (Edit Content, say) it asks for a chunk that no longer exists — and the user
 * gets a dead button and a console full of MIME-type errors.
 *
 * Vite fires `vite:preloadError` for exactly this. Reload once to pick up the new
 * index.html, guarding with sessionStorage so a genuinely broken chunk cannot put the
 * page into a reload loop.
 */
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_GUARD = 'knowgraph:reloaded-for-stale-chunk';

  if (sessionStorage.getItem(RELOAD_GUARD)) {
    // Already tried. The chunk is genuinely missing, so let the error surface rather
    // than reloading forever.
    return;
  }

  event.preventDefault();
  sessionStorage.setItem(RELOAD_GUARD, '1');
  window.location.reload();
});

// A clean load means whatever was stale is now fresh.
window.addEventListener('load', () => {
  sessionStorage.removeItem('knowgraph:reloaded-for-stale-chunk');
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
