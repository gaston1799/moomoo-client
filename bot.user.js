// bot.user.js — MooMoo.io bot (single-file, Tampermonkey-ready after bundling).
// Flow: turnstile token (page widget or injected) -> servers -> connect -> send.
// Message names: use decoded names from the s2c table (A..N per bundle RE) —
// the client's handler table receives the decoded name directly.
import { MooClient } from './lib/client.js';
import { fetchServers, pickServer, serverUrl } from './lib/servers.js';
import { TURNSTILE_SITEKEY } from './lib/config.js';

const CFG = {
  region: new URLSearchParams(location.search).get('region') || undefined,
  autoJoin: true,
};

const log = (...a) => console.log('[moomoo-bot]', ...a);
const client = new MooClient();
window.__moomooBot = { client, cfg: CFG };

// --- Turnstile token (uses the page's widget; self-loads API if missing) ---
function getTurnstileToken() {
  return new Promise((resolve, reject) => {
    if (window.turnstile?.render) return render(resolve, reject);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => render(resolve, reject);
    s.onerror = () => reject(new Error('turnstile api failed to load'));
    document.head.appendChild(s);
  });
  function render(resolve, reject) {
    const el = document.getElementById('turnstileWidget') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'turnstileWidget' }));
    window.turnstile.render(el, {
      sitekey: TURNSTILE_SITEKEY,
      theme: 'light',
      callback: resolve,
      'error-callback': reject,
      'expired-callback': () => reject(new Error('turnstile expired')),
    });
  }
}

// --- message handlers (decoded names; extend per protocol RE) ---
client
  .on('$close', (code) => log('closed', code))
  .on('io-init', () => log('handshake done, session crypto active'))
  .on('D', (u) => { /* render update — game loop (see humanized RE) */ });

// --- bot controls (c2s message names from the bundle RE) ---
export const botControls = {
  spawn: (sid = client.socketId) => client.send('P', sid, 1),   // accept spawn
  aim:   (angle) => client.send('9', angle),                     // set aim angle
  shoot: (buildIndex = null) => client.send('F', null, buildIndex ?? 0),
  lockDir: (on) => client.send('K', on ? 1 : 0),
  chat:  (text) => client.send('6', String(text).slice(0, 30)),
  reset: () => client.send('e'),
};
window.__moomooBot = { client, cfg: CFG, controls: botControls };

// --- boot ---
async function boot() {
  log('fetching servers…');
  const list = await fetchServers();
  const server = pickServer(list, CFG);
  log('server:', server.region, server.name, `${server.playerCount}/${server.playerCapacity}`);
  log('solving turnstile…');
  const token = await getTurnstileToken();
  log('token ok');
  await client.connect(serverUrl(server, token));
  log('connected — spawning…');
  if (CFG.autoJoin) botControls.spawn();
}

boot().catch((e) => log('boot failed:', e.message));
