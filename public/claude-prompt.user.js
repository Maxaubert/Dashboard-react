// ==UserScript==
// @name         AI prompt launcher — auto-submit ?q=
// @namespace    https://github.com/dashboard-react/prompt-launcher
// @version      1.1.0
// @description  Reads ?q= from the URL on claude.ai or chatgpt.com and auto-submits it as a new prompt.
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const prompt = new URLSearchParams(location.search).get('q');
  if (!prompt) return;

  // Per-host selectors. Both sites use a contenteditable composer + a
  // disabled-until-text Send button.
  const SITES = {
    'claude.ai': {
      editor: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
      send:
        'button[aria-label="Send message"]:not([disabled]),' +
        'button[aria-label="Send Message"]:not([disabled]),' +
        'button[aria-label="Send"]:not([disabled])',
    },
    'chatgpt.com': {
      editor:
        '#prompt-textarea[contenteditable="true"],' +
        'div[contenteditable="true"]#prompt-textarea,' +
        'textarea#prompt-textarea,' +
        'div[contenteditable="true"]',
      send:
        'button[data-testid="send-button"]:not([disabled]),' +
        'button[aria-label="Send prompt"]:not([disabled]),' +
        'button[aria-label="Send message"]:not([disabled])',
    },
    'chat.openai.com': null, // filled in below — same as chatgpt.com
  };
  SITES['chat.openai.com'] = SITES['chatgpt.com'];

  const cfg = SITES[location.hostname];
  if (!cfg) return;

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
      const editor = await waitFor(cfg.editor);
      editor.focus();

      if (editor.tagName === 'TEXTAREA') {
        // Native textarea: set .value and dispatch input so React picks it up.
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        ).set;
        setter.call(editor, prompt);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        // ProseMirror / contenteditable: execCommand dispatches the right events.
        document.execCommand('insertText', false, prompt);
      }

      const sendBtn = await waitFor(cfg.send);
      // Small delay so React's enabled-state has a tick to settle.
      setTimeout(() => sendBtn.click(), 120);
    } catch (e) {
      console.error('[prompt-launcher]', e);
    }
  })();
})();
