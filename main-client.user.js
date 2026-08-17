// main-client.user.js — the MooMoo replacement client entry.
// At document-start: (1) MutationObserver catches the parser-added bundle
// script and swaps it for OUR client; (2) src-property setter catches
// dynamically created scripts. Either way the original bundle never executes
// and its anti-cheat never runs.
// ==UserScript==
// @name        MooMoo Client
// @namespace   https://greasyfork.org/users/gaston1799
// @version     0.2.0
// @description MooMoo.io replacement client - blocks original bundle, no anti-cheat
// @match       *://*.moomoo.io/*
// @run-at      document-start
// @grant       none
// ==/UserScript==

(() => {
  const OUR_CLIENT = __MOOMOO_CLIENT_SOURCE__;
  const BUNDLE_RE = /\/assets\/index-[0-9a-f]+\.js/i;
  const BLOCKED = new WeakSet();
  let injected = false;

  const blobSrc = () => URL.createObjectURL(new Blob([OUR_CLIENT], { type: 'text/javascript' }));

  const tryBlock = (scriptEl) => {
    if (BLOCKED.has(scriptEl)) return;
    const src = scriptEl.getAttribute('src') || scriptEl.src || '';
    if (BUNDLE_RE.test(src)) {
      BLOCKED.add(scriptEl);
      console.log('[moomoo-client] blocked original bundle:', src.split('/').pop());
      const ours = document.createElement('script');
      ours.src = blobSrc();
      scriptEl.replaceWith(ours);
    }
  };

  // catches parser-added scripts (the normal game load path)
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.tagName === 'SCRIPT') tryBlock(n);
      }
    }
  }).observe(document, { childList: true, subtree: true });

  // catches dynamically created scripts
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    get() { return srcDesc.get.call(this); },
    set(url) {
      if (typeof url === 'string' && BUNDLE_RE.test(url)) {
        srcDesc.set.call(this, blobSrc());
        return;
      }
      srcDesc.set.call(this, url);
    },
  });

  // if the bundle somehow already started before us, hard-block the globals
  console.log('[moomoo-client] bundle blocker active (observer + src hook)');

  // inject OUR client once the DOM is ready (runs on any origin; the game
  // replaced when/if it appears, so the original code never executes)
  const injectNow = () => {
    if (injected) return;
    injected = true;
    const s = document.createElement('script');
    s.src = blobSrc();
    (document.body || document.documentElement).appendChild(s);
    console.log('[moomoo-client] client injected');
  };
  // wait for DOM instead of document-start: a synchronous blob script at
  // document-start breaks the HTML parser (page renders as an empty shell)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNow, { once: true });
  } else {
    injectNow();
  }
})();
