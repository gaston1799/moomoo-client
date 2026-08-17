// moomoo-driver.mjs — launch Chrome PBC-style, BLOCK the game bundle,
// inject our own client, capture console + WebSocket frames.
// Usage: node moomoo-driver.mjs [--port 9251] [--profile dir] [--no-block]
import { spawn } from 'child_process';
import fs from 'fs';
const DLOG = 'D:/moomoo-inspect/driver-debug.log';
const dlog = (...a) => { try { fs.appendFileSync(DLOG, new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch (e) {} };

const PORT = Number(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || 9251);
const USE_MOCK = process.argv.includes('--mock');
const TARGET_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
  || (USE_MOCK ? 'https://localhost:9457/' : 'https://moomoo.io/');
const PROFILE = process.argv.find(a => a.startsWith('--profile='))?.split('=')[1] || `D:\\codex-tools\\pbc\\profiles\\isolated\\moomoo-re-${Date.now()}`;
const NO_BLOCK = process.argv.includes('--no-block');
const NO_AUTO = process.argv.includes('--no-auto');
const USE_CLIENT = process.argv.includes('--client');
const AUTO_PLAY = process.argv.includes('--auto');

// The bundle we are remaking ourselves — block it by default.
const BUNDLE_RE = /\/assets\/index-[0-9a-f]+\.js$/i;

// Injected at document-start: either the quick auto-join (moomoo-auto) or the
// full replacement client (dist/moomoo-client.user.js, header stripped).
let AUTO_JS = NO_AUTO ? '' : fs.readFileSync(new URL('./moomoo-auto.js', import.meta.url), 'utf8');
if (USE_CLIENT) {
  AUTO_JS = fs.readFileSync(new URL('./dist/moomoo-client.user.js', import.meta.url), 'utf8')
    .replace(/\/\/ ==UserScript==[\s\S]*?==\/UserScript==\n\n/, '');
}
if (USE_MOCK) {
  AUTO_JS = 'window.__mmMock = true;\n' + AUTO_JS;
  if (AUTO_PLAY) AUTO_JS = 'window.__mmBootAuto = true;\n' + AUTO_JS;
  console.log('[driver] MOCK mode: local mock server' + (AUTO_PLAY ? ' + auto-play' : ''));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Anti-bot stealth: mask CDP fingerprints so Cloudflare Turnstile can auto-pass
// in the isolated test browser (mirrors a real user's browser).
const STEALTH_JS = `
(() => {
  try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {}
  try { for (const k of Object.keys(window)) { if (k.indexOf('cdc_') === 0) { delete window[k]; } } } catch (e) {}
  try { window.chrome = window.chrome || { runtime: {} }; } catch (e) {}
  try {
    const origQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (origQuery) {
      window.navigator.permissions.query = (p) => p && p.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : origQuery(p);
    }
  } catch (e) {}
})();
`;

// Launch Chrome EXACTLY like PBC (no --enable-automation) so Turnstile passes.
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--user-data-dir=${PROFILE}`,
  '--remote-debugging-port=' + PORT,
  '--no-first-run', '--no-default-browser-check', '--disable-features=Translate,MediaRouter',
  '--disable-blink-features=AutomationControlled',
  '--ignore-certificate-errors',
  '--window-size=1280,800',
  '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--disable-default-apps', '--disable-infobars', '--disable-notifications',
  '--disable-hang-monitor', '--disable-prompt-on-repost', '--disable-client-side-phishing-detection',
  '--metrics-recording-only', '--noerrdialogs', '--mute-audio',
  'about:blank',
], { stdio: 'ignore', detached: false });
chrome.on('exit', (code) => console.log('[driver] chrome exited', code));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('no CDP target');
}

async function main() {
  const target = await getTarget();
  console.log('[driver] page:', target.url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(res => ws.onopen = res);
  const pending = new Map();
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onclose = () => { console.log('[driver] CDP connection closed — exiting'); process.exit(1); };
  ws.onerror = (e) => { console.log('[driver] CDP error', e.message || ''); };
  ws.onmessage = (e) => {    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      dlog('PAUSED', request.url.slice(0, 100));
      if (!NO_BLOCK && BUNDLE_RE.test(request.url)) {
        blocked++;
        console.log(`[driver] BLOCKED bundle: ${request.url}`);
        ws.send(JSON.stringify({ id: ++id, method: 'Fetch.failRequest', params: { requestId, errorReason: 'BlockedByClient' } }));
      } else if (request.url.includes('moomoo.io') || request.url.includes('turnstile')) {
        if (!request.url.includes('doubleclick') && !request.url.includes('googlesyndication') && !request.url.includes('.woff2') && !request.url.includes('.png') && !request.url.includes('.svg') && !request.url.includes('.css')) {
          console.log(`[driver] req: ${request.url}`);
        }
        ws.send(JSON.stringify({ id: ++id, method: 'Fetch.continueRequest', params: { requestId } }));
      } else {
        dlog('CONTINUE', request.url.slice(0, 100));
        ws.send(JSON.stringify({ id: ++id, method: 'Fetch.continueRequest', params: { requestId } }));
      }
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      console.log(`[console] ${args}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[exception]', msg.params.exceptionDetails?.text || '', msg.params.exceptionDetails?.exception?.description || '');
    }
  };
  let blocked = 0;
  await send('Page.enable');
  await send('Runtime.enable');
  // preset OneTrust consent so no cookie dialog appears (dialog reload kills the flow)
  try {
    const host = new URL(TARGET_URL).hostname;
    await send('Network.enable');
    await send('Network.setCookie', {
      name: 'OptanonConsent',
      value: 'isGpcEnabled=0&datestamp=' + new Date().toISOString() + '&version=8.4.0&isIABGlobal=false&hosts=&consentId=mock&interactionCount=1&landingPath=NotLandingPage&groups=C0001:1,C0002:1,C0003:1,C0004:1',
      domain: host, path: '/',
    });
    console.log('[driver] consent cookie preset for', host);
  } catch (e) { console.log('[driver] cookie preset failed', e.message); }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STEALTH_JS });
  console.log('[driver] stealth injected (webdriver/CDP masked)');
  if (AUTO_JS) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: AUTO_JS });
    console.log('[driver] injected moomoo-auto.js (loading-screen automation)');
  }
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  if (NO_BLOCK) {
    // disable the interception entirely so all network flows freely
    await send('Fetch.disable');
    console.log('[driver] Fetch interception DISABLED (--no-block)');
  } else {
    console.log('[driver] Fetch interception active — bundle will be blocked.');
  }

  // go to the game
  await send('Page.navigate', { url: TARGET_URL });
  console.log('[driver] navigating to', TARGET_URL);

  // keep alive
  setInterval(() => {}, 1 << 30);
}
main().catch(e => { console.error('[driver]', e); process.exit(1); });
