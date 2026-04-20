// ==UserScript==
// @name         Claude.ai — auto-submit ?q= prompt
// @namespace    https://github.com/dashboard-react/prompt-launcher
// @version      1.0.0
// @description  Reads ?q= from the URL on claude.ai and auto-submits it as a new prompt.
// @match        https://claude.ai/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const prompt = new URLSearchParams(location.search).get('q');
  if (!prompt) return;

  // Strip ?q= so a refresh doesn't re-submit.
  const url = new URL(location.href);
  url.searchParams.delete('q');
  history.replaceState(null, '', url.pathname + url.search + url.hash);

  const waitFor = (selector, timeoutMs = 20000) =>
    new Promise((resolve, reject) => {
      const start = Date.now();
      (function tick() {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout: ' + selector));
        requestAnimationFrame(tick);
      })();
    });

  (async () => {
    try {
      const editor = await waitFor(
        'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]'
      );
      editor.focus();
      // ProseMirror listens for the synthetic input events that execCommand dispatches.
      document.execCommand('insertText', false, prompt);

      const sendBtn = await waitFor(
        'button[aria-label="Send message"]:not([disabled]),' +
        'button[aria-label="Send Message"]:not([disabled]),' +
        'button[aria-label="Send"]:not([disabled])'
      );
      // Small delay so React's enabled-state has a tick to settle.
      setTimeout(() => sendBtn.click(), 80);
    } catch (e) {
      console.error('[claude-prompt-from-url]', e);
    }
  })();
})();
