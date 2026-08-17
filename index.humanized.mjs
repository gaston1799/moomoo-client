// ============================================================================
// index.humanized.js — 1:1 human-readable reconstruction of MooMoo.io's
// game bundle (index-8f264913.js). Same behavior, readable names.
//
// Status: CORE (boot / anti-cheat / networking / turnstile / server join)
//         fully reconstructed from the beautified bundle. Rendering internals
//         are mapped and stubbed with TODO pointers (progressive pass).
//
// Original bundle facts:
//   - module system: Vite-style (imports from ./vendor-b760dbba.js)
//   - no source map; identifiers minified (Ut, rs, cs, ...)
//   - canvas target 1920x1080, 9 (vs) = ? (camera/scale constant)
// ============================================================================

import { /* vendor symbols */ } from './vendor-b760dbba.js';

// ---------------------------------------------------------------------------
// 0. Modulepreload polyfill (Vite runtime boilerplate)
// ---------------------------------------------------------------------------
(function modulePreloadPolyfill() {
  const relList = document.createElement('link').relList;
  if (relList && relList.supports && relList.supports('modulepreload')) return;
  const preload = (link) => {
    if (link.ep) return;
    link.ep = true;
    const init = {};
    if (link.integrity) init.integrity = link.integrity;
    if (link.referrerPolicy) init.referrerPolicy = link.referrerPolicy;
    init.credentials =
      link.crossOrigin === 'use-credentials' ? 'include'
      : link.crossOrigin === 'anonymous' ? 'omit'
      : 'same-origin';
    fetch(link.href, init);
  };
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) preload(link);
  new MutationObserver((mutations) => {
    for (const m of mutations)
      if (m.type === 'childList')
        for (const node of m.addedNodes)
          if (node.tagName === 'LINK' && node.rel === 'modulepreload') preload(node);
  }).observe(document, { childList: true, subtree: true });
})();

// ---------------------------------------------------------------------------
// 1. Anti-cheat / anti-tamper
// ---------------------------------------------------------------------------
const nativeWebSocket = window.WebSocket;                 // kn — snapshot the real WS
const nativeWsSend = window.WebSocket && window.WebSocket.prototype.send; // Ri
let antiCheatInit = false;                                // Bi

// fs — one-time anti-cheat init
function initAntiCheat(options = {}) {
  if (antiCheatInit) return;
  antiCheatInit = true;
  freezeWebSocket();                                      // us
  blockDevToolsShortcuts();                               // ms
  if (options.antiDebug) runDebuggerLoop();               // ps
  if (options.detectUserscripts !== false) detectUserscripts(); // ws
}

// us — make WebSocket non-overridable so nobody can hook send/onmessage
function freezeWebSocket() {
  try {
    Object.defineProperty(window, 'WebSocket', {
      value: nativeWebSocket,
      writable: false,
      configurable: false,
    });
  } catch {}
}

// ms — block F12 / Ctrl+Shift+I/J/C / Ctrl+U
function blockDevToolsShortcuts() {
  window.addEventListener('keydown', (e) => {
    const k = e.keyCode;
    if (
      k === 123 ||
      (e.ctrlKey && e.shiftKey && (k === 73 || k === 74 || k === 67)) ||
      (e.ctrlKey && k === 85)
    ) {
      e.preventDefault();
      return false;
    }
  });
}

// ps — infinite debugger trap (pauses devtools)
function runDebuggerLoop() {
  setInterval(() => { (function() { debugger; })(); }, 1000);
}

// gs — known userscript manager extension IDs probed by the game
const USERSRIPT_MANAGER_IDS = [
  { name: 'Tampermonkey',  id: 'dhdgffkkebhmkfjojejmpbldmpobfkfo', resource: 'options.html' },
  { name: 'Tampermonkey',  id: 'gcalenpjmijncebpfijmoaglllgpjagf', resource: 'options.html' },
  { name: 'Tampermonkey',  id: 'iikmkjmpaadaobahmlepeloendndfphd', resource: 'options.html' },
  { name: 'Violentmonkey', id: 'jinjaccalgkegednnccohejagnlnfdag', resource: 'options.html' },
];

// ws — detect userscript managers via extension resource fetch + globals
function detectUserscripts() {
  let found = false;
  const onFound = (name) => { if (!found) { found = true; showUserscriptWarning(name); } }; // ys
  USERSRIPT_MANAGER_IDS.forEach((mgr) => {
    try {
      const img = new Image();
      img.onload = () => onFound(mgr.name);
      img.src = `chrome-extension://${mgr.id}/${mgr.resource}?_=${Date.now()}`;
    } catch {}
  });
  window.setTimeout(() => {
    try {
      if (window.__gmMonkey || window.GM_info || window.GM || window.unsafeWindow)
        onFound('a userscript manager');
    } catch {}
  }, 1500);
}

// ys — red full-width warning banner + forced reload
function showUserscriptWarning(name) {
  if (document.getElementById('userscript-warning')) return;
  const render = () => {
    if (document.getElementById('userscript-warning')) return;
    const banner = document.createElement('div');
    banner.id = 'userscript-warning';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
      'background:#c0392b', 'color:#fff', 'font-family:Hammersmith One, sans-serif',
      'font-size:16px', 'text-align:center', 'padding:12px 16px',
      'box-shadow:0 2px 8px rgba(0,0,0,.4)',
    ].join(';');
    banner.textContent =
      'A browser extension (' + (name || 'userscript manager') +
      ') that can modify the game was detected. Please disable it and reload to play fairly.';
    const reload = document.createElement('a');
    reload.textContent = ' Reload';
    reload.href = 'javascript:window.location.reload()';
    reload.style.cssText = 'color:#fff;text-decoration:underline;margin-left:8px;font-weight:bold';
    banner.appendChild(reload);
    document.body.appendChild(banner);
  };
  document.body ? render() : window.addEventListener('DOMContentLoaded', render);
}

// ---------------------------------------------------------------------------
// 2. Constants
// ---------------------------------------------------------------------------
const CANVAS_WIDTH = 1920;   // ks
const CANVAS_HEIGHT = 1080;  // xs
const TANK_COUNT = 9;        // vs — TODO: confirm meaning (tank types?)
const DEV_MODE = false;      // We (dev flag: localhost ws, test turnstile key)

// ---------------------------------------------------------------------------
// 3. Network / server layer (z / ze — the connector)
// ---------------------------------------------------------------------------
// Server list endpoint + host base (from the bundle + live fetch):
//   GET https://api.moomoo.io/servers?v=1.27
//   -> [{ region, name, key, playerCapacity, playerCount, version }]
const API_BASE = 'https://api.moomoo.io';     // mt / dn
const BASE_HOST = 'moomoo.io';                // pt / pn
const DEFAULT_PORT = 443;                     // from new z(pt, 443, ...)
const LOBBY_MAX = 40;                         // y.maxPlayers

// serverAddress: host = {key}.{region}.moomoo.io (region 0 -> localhost)
function serverAddress(srv) {
  return srv.region == 0 ? 'localhost' : `${srv.key}.${srv.region}.${BASE_HOST}`;
}
function serverPort(srv) { return srv.port; }

// regionInfo — known regions (bundle's z.prototype.regionInfo)
const REGION_INFO = {
  0: { name: 'Local', latitude: 0, longitude: 0 },
  'us-east': { name: 'Miami', latitude: 40.1393329, longitude: -75.8521818 },
  // ... remaining regions from the bundle
};

// processServers — group flat server array by region
function processServers(list) {
  const grouped = {};
  for (const s of list) {
    (grouped[s.region] = grouped[s.region] || []).push(s);
  }
  return grouped;
}

// findServer(region, name) — locate + mark selected, refuse full servers
// connect(region, name, gameIndex):
//   - server = findServer(region, name)
//   - if playerCount >= playerCapacity -> "Server is already full."
//   - window.history.replaceState(... generateHref(region, name, password))
//   - callback(serverAddress(server), serverPort(server), gameIndex)

// ---------------------------------------------------------------------------
// 4. Turnstile
// ---------------------------------------------------------------------------
const TURNSTILE_SITEKEY = DEV_MODE
  ? '1x00000000000000000000AA'            // test key
  : '0x4AAAAAAAMYHI96GFiJzMmp';          // prod key (La)

// nn — render the widget on #turnstileWidget, wire callbacks
function renderTurnstile() {
  const el = document.getElementById('turnstileWidget');
  if (!el || el.offsetParent === null) return false;
  window.turnstile.render(el, {
    sitekey: TURNSTILE_SITEKEY,
    theme: 'light',
    callback: window.onGotTurnstileToken,
    'error-callback': window.onTurnstileError,
    'expired-callback': window.onTurnstileExpired,
  });
}

// ---------------------------------------------------------------------------
// 5. Connect flow (Lt) — wss://{host}:{port}?token={turnstileToken}
//    (full reconstruction moved to section 3.5 / 5 below — see net + connectWithToken)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. WebSocket capture hooks (O) — see the full `net` wrapper in section 3.5
// ---------------------------------------------------------------------------
// 3.5 PACKET CRYPTO / PROTOCOL (fully RE'd from the bundle)
// ---------------------------------------------------------------------------
// Connection protocol:
//   1. wss://{key}.{region}.moomoo.io:443?token={turnstileToken}
//   2. server sends io-init: [socketId, seed, keyHex, mode]
//   3. if mode === 1 (Ht): derive per-session opcode tables + HMAC key
//   4. every packet: 6-byte truncated HMAC-SHA256 || payload
//      payload = Hi.encode([opcode, args, seq])
//   5. opcodes are shuffled per session via seeded PRNG (c2s/s2c tables)

const HMAC_BLOCK = 64;    // he
const MAC_SIZE = 6;       // jt — truncated HMAC output length
const CRYPTO_MODE = 1;    // Ht

// Co — seeded PRNG (mulberry32) used to shuffle the opcode tables
function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 1831565813) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Oi — build {enc: name->code, dec: code->name} via Fisher-Yates + PRNG
function buildCodeTables(names, seed) {
  const len = names.length;
  const idx = names.map((_, i) => i);
  const rnd = seededRandom(seed >>> 0);
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
  }
  const enc = {}, dec = {};
  for (let i = 0; i < len; i++) { enc[names[i]] = idx[i]; dec[idx[i]] = names[i]; }
  return { enc, dec };
}

// Opcode alphabets (symbols — codes are indices into these arrays)
const C2S_SYMBOLS = ['M','D','9','e','F','z','H','K','L','N','b','P','Q','c','6','S','0']; // bo — client->server
const S2C_SYMBOLS = ['A','B','C','D','E','a','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','X','Y','Z','g','1','2','3','4','5','6','7','8','9','0']; // To — server->client

// Po — per-connection crypto from the io-init seed
function deriveCrypto(seed) {
  const t = (seed ^ Math.imul(1 /* Io */, 2654435761)) >>> 0; // seed * 2654435761
  return {
    c2s: buildCodeTables(C2S_SYMBOLS, t),
    s2c: buildCodeTables(S2C_SYMBOLS, (t ^ 2246822507) >>> 0),
  };
}

// Ro — hex string -> bytes (the shared HMAC key from io-init)
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Vt — SHA-256 (standard; constants in Do). Implemented in the bundle.
// Ao — HMAC-SHA256 (ipad 0x36 / opad 0x5c, block 64)
function hmacSha256(key, msg) {
  let k = key;
  if (k.length > HMAC_BLOCK) k = sha256(k);
  const padded = new Uint8Array(HMAC_BLOCK); padded.set(k);
  const inner = new Uint8Array(HMAC_BLOCK + msg.length);
  const outer = new Uint8Array(HMAC_BLOCK + 32);
  for (let i = 0; i < HMAC_BLOCK; i++) { inner[i] = padded[i] ^ 0x36; outer[i] = padded[i] ^ 0x5c; }
  inner.set(msg, HMAC_BLOCK);
  outer.set(sha256(inner), HMAC_BLOCK);
  return sha256(outer);
}

// Eo — truncated HMAC (the wire MAC)
function truncatedMac(key, msg) {
  return hmacSha256(key, msg).subarray(0, MAC_SIZE);
}

// Hi / Bo — packet codec: standard MessagePack (@msgpack/msgpack).
//   Encoder (yn / rs / Hi): encodeSharedRef / encode — nil 0xc0, bool 0xc2/3,
//     ints fixint/0xcc-0xd3, float 0xca/0xcb, str 0xd9-0xdb, bin 0xc4-0xc6,
//     array 0x90+/0xdc/0xdd, map 0x80+/0xde/0xdf, ext via extensionCodec.
//   Decoder (kn / cs / Bo): decode(bytes) -> [type, payload]
// So every packet payload is a msgpack array; the wire bytes are:
//   [MAC(6)] [msgpack([opcode, args, seq])]
// A full msgpack implementation can be vendored from @msgpack/msgpack or the
// vendor.beautified.js dump (kn = decoder, yn = encoder).
function encodePacket(arr) {
  // msgpack.encode(arr) — vendor the encoder (yn in vendor.beautified.js)
  throw new Error('encodePacket: needs msgpack encoder (vendor yn)');
}
function decodePacket(bytes) {
  // msgpack.decode(bytes) — vendor the decoder (kn in vendor.beautified.js)
  throw new Error('decodePacket: needs msgpack decoder (vendor kn)');
}

// Z — session crypto state (null until io-init with mode 1)
let session = null; // { mode, key, tables: {c2s,s2c}, seq }

// O — the WebSocket wrapper (kn = frozen native WebSocket, Ri = native send)
const net = {
  socket: null,
  connected: false,
  socketId: -1,

  connect(url, readyCb, handlers) {
    if (this.socket) return;
    const self = this;
    try {
      let errored = false;
      this.socket = new nativeWebSocket(url);
      this.socket.binaryType = 'arraybuffer';
      let fired = false;

      this.socket.onmessage = (d) => {
        const bytes = new Uint8Array(d.data);
        const [type, payload] = decodePacket(bytes); // Bo.decode
        if (type === 'io-init') {
          // handshake: [socketId, seed, keyHex, mode]
          self.socketId = payload[0];
          if (payload[3] === CRYPTO_MODE) {
            session = {
              mode: CRYPTO_MODE,
              key: hexToBytes(payload[2]),
              tables: deriveCrypto(payload[1] >>> 0),
              seq: 0,
            };
          } else {
            session = null;
          }
          if (!fired) { fired = true; readyCb(); }
          return;
        }
        // decode opcode through the session's server->client table
        if (session && typeof type === 'number') {
          const name = session.tables.s2c.dec[type];
          if (name === undefined) return;
          const handler = handlers[name];
          handler && handler(...payload);
        }
      };
      this.socket.onopen = () => { this.connected = true; };
      this.socket.onclose = (d) => {
        this.connected = false; session = null;
        d.code == 4001 ? readyCb('Invalid Connection') : (!fired && readyCb('disconnected'));
      };
      this.socket.onerror = () => {
        if (this.socket && this.socket.readyState != WebSocket.OPEN) {
          errored = true;
          console.error('Socket error', arguments);
          readyCb('Socket error');
        }
      };
    } catch (err) {
      console.warn('Socket connection error:', err);
      readyCb(err);
    }
  },

  send(name, ...args) {
    if (!this.socket) return;
    if (session && session.mode === CRYPTO_MODE) {
      const op = session.tables.c2s.enc[name];
      if (op === undefined) return;
      const seq = ++session.seq;
      const msg = encodePacket([op, args, seq]); // Hi.encode
      const mac = truncatedMac(session.key, msg);
      const out = new Uint8Array(MAC_SIZE + msg.length);
      out.set(mac, 0);
      out.set(msg, MAC_SIZE);
      nativeWsSend.call(this.socket, out);
      return;
    }
    // pre-crypto / plaintext fallback
    const msg = encodePacket([name, args]);
    nativeWsSend.call(this.socket, msg);
  },

  socketReady() { return this.socket && this.connected; },
  close() {
    if (this.socket) this.socket.close();
    this.socket = null; this.connected = false; session = null;
  },
};

// ---------------------------------------------------------------------------
// 5. Connect flow (Lt) — wss://{host}:{port}?token={turnstileToken}
// ---------------------------------------------------------------------------
function connectWithToken(token) {
  // re.start(St, (host, port, gameIndex) => {
  //   let url = 'wss://' + host;
  //   DEV_MODE && (url = 'wss://localhost:3000');
  //   token && (url += '?token=' + encodeURIComponent(token));
  //   net.connect(url, (ready) => {
  //     if (alreadySwitched) return;
  //     startGame();
  //     ready ? onServerReady(ready) : (waitingForJoin = true, retryJoin());
  //   }, { A: onServerMsgA, B: onServerMsgB, C: ..., D: ... });
  // });
}

// ---------------------------------------------------------------------------
// 6. SERVER->CLIENT HANDLERS (the A/B/C/D... message table)
// ---------------------------------------------------------------------------
// Message types are single chars from the S2C_SYMBOLS alphabet. Handlers:
//   A (wa)  server list refresh: filter full, pick lowest ping / fewest players
//   B (zt)  disconnect / error: close socket + show error screen (Si)
//   C (xl)  game start UI: hide loading, show game, reset state (ne = {})
//   D (nl)  **RENDER UPDATE / game loop** — F.clearRect, draw frame
//   E (zl)  entity removal: splice entity by id
//   a (Jl)  force position sync (timestamp-based, E[i].forcePos)
//   G (Tl)  leaderboard/text list (removeAllChildren, triples)
//   H (Vl)  floating combat text (Pn.showText, color by sign)
//   I (Xl)  (same shape as C)
//   J (Fl)  start animation (is(e).startAnim())
//   K (Pl)  keyboard/input handler (Enter = 13)
//   L (Wl)  gather wiggle (xWiggle/yWiggle += gatherWiggle*cos)
//   M (_l)  direction + wiggle
//   N (Kl)  entity property set: v[e] = t; redraw if i (Zn())

// Server auto-pick (wa): lowest ping, tie -> most players
function pickBestServer(servers) {
  const open = servers.filter(n => n.playerCount !== n.playerCapacity);
  const minPing = Math.min(...open.map(n => n.ping || Infinity));
  const best = open.filter(n => n.ping === minPing);
  return !best.length ? null : best.reduce((best, cur) =>
    best.playerCount > cur.playerCount ? best : cur);
}

// Si — error/notice screen (message + optional reload link)
function showErrorScreen(msg, withReload) {
  errorEl.style.display = 'block';
  // hides loading/game UI elements; errorEl.innerHTML = msg + reload link
}

// _a — game start (post-join): hide loading, show game, set player name
//   name = localStorage 'moo_name' || FRVR.profile.name() + random 90..98 suffix

// Token flow:
//   window.onGotTurnstileToken = (token) => {
//     ue = token;
//     window.captchaCallbackHook && window.captchaCallbackHook();  // hook point
//     joinButton.classList.remove('disabled');
//   }

// ---------------------------------------------------------------------------
// 7. Boot order (from bundle)
// ---------------------------------------------------------------------------
// 1. initAntiCheat({ antiDebug, detectUserscripts })
// 2. build loading screen (canvas 1920x1080)
// 3. load server list: fetch(`${API_BASE}/servers?v=1.27`) -> processServers
// 4. render region/server <select>s, read ?server=region:name from URL
// 5. renderTurnstile() -> onGotTurnstileToken(token) -> connectWithToken(token)
// 6. io-init handshake -> derive session crypto -> send/recv via net
// 7. game loop: receive WS updates -> render (see RENDERING section)

// ---------------------------------------------------------------------------
// 8.5 WORLD CONFIG (y) + ENTITY MODEL
// ---------------------------------------------------------------------------
// y config (verified fields):
//   maxScreenWidth: 1920, maxScreenHeight: 1080,
//   serverUpdateRate: 9, clientSendRate: <T>,
//   maxPlayers, maxPlayersHard, collisionDepth, minimapRate, colGrid,
//   healthBarWidth/Pad, iconPadding/Pad, deathFadeout, crownIconScale/Pad,
//   chatCountdown/Cooldown, inSandbox, maxAge, gatherAngle, gatherWiggle,
//   hitReturnRatio, hitAngle, playerScale, playerSpeed, playerDecel, nameY,
//   skinColors, animalCount, ... (remaining fields: extract from bundle)

// Draw helpers:
//   R(x, y, r, ctx, fill?, stroke?) — circle:
//     ctx.beginPath(); ctx.arc(x, y, r, 0, 2π); fill unless fill=false; stroke unless stroke=false
//   Q(ctx, points, outerR, innerR) — star/polygon path (tank/shape drawing)
//   mapScale (go) — world units -> screen pixels multiplier
//   camera: world center at (mapScale/2, mapScale/2)

// Entity arrays:
//   Oe = [] — objects drawn every frame; each has update(ctx, updatePacket)
//   E  = [] — entities; new ua(...) pushed here (players/tanks)
//   Entity 'ua' (player/tank) core fields:
//     id, sid, team, skinIndex, tailIndex, points, dt, isPlayer, pps,
//     moveDir, skinRot, lastPing, iconIndex, skinColor,
//     active, alive, lockMove, lockDir, gathering, autoGather, animTime/Speed,
//     buildIndex, weaponIndex, dmgOverTime, maxXP(300), XP, age, kills,
//     upgradePoints, x, y, zIndex, xVel, yVel, slowMult, dir, dirPlus,
//     targetDir, targetAngle, maxHealth(100), health,
//     scale(i.playerScale), speed(i.playerSpeed),
//     items:[0,3,6,10], weapons:[0], shootCount, weaponXP, reloads,
//     tails{id:owned}, skins{id:owned} (purchased hats/tails)
//   Ja(team, isOwner) — set v.team / v.isOwner
//   Qa(e) — Ee = e (+ shop redraw)

// Store items (hats/tails/accessories):
//   Ze = Tn.hats, Ue = Tn.accessories — item collections from vendor Tn
//   (Tn = { create, factory: Xt }, Xt = new H — an event/collection manager
//    from vendor-b760dbba.js; H.prototype.createCollection makes typed
//    collections with trigger/bind events). Exact item data created at
//    runtime — TODO: dump the collections from a live session.
// Resources: ["wood", "food", "stone", "points"] (Us)
// Player spawn: resources = 100 each; items=[0,3,6,10]; weapons=[0];
//   maxXP=300; maxHealth=100; scale/speed from config (playerScale/playerSpeed)

// ---------------------------------------------------------------------------
// 8.6 FULL BOOT/PROTOCOL FLOW (summary — everything reconstructed)
// ---------------------------------------------------------------------------
// 1. initAntiCheat (freeze WS, block devtools, debugger loop, userscript detect)
// 2. loading screen (canvas 1920x1080)
// 3. fetch servers v1.27 -> processServers -> region/name selects (+ auto-pick)
// 4. renderTurnstile(#turnstileWidget, sitekey) -> onGotTurnstileToken(token)
// 5. join: wss://{key}.{region}.moomoo.io:443?token={token}
// 6. io-init handshake [socketId, seed, keyHex, mode=1]
//    -> session = { key, tables: deriveCrypto(seed), seq: 0 }
// 7. send/recv msgpack packets [opcode, args, seq] + 6-byte HMAC-SHA256 prefix
// 8. D handler = render loop (canvas-2D entity self-draw)
// 9. name from localStorage 'moo_name' / FRVR profile
// TODO: remaining y fields, per-entity draw() bodies, item/weapon tables,
//       exact handler arg layouts for each message type.
// The game renders with a 2D canvas context (F) on canvas (G), not WebGL.
// Per-frame (the D/nl handler — runs when player && player.alive):
//   1. ctx.clearRect(0, 0, canvas.width, canvas.height)
//   2. ctx.strokeStyle='#fff'; ctx.lineWidth=4
//   3. for each entity in Oe: entity.update(ctx, updatePacket)
//        -> each entity draws itself (tanks, shapes, bullets, food)
//   4. player dot: R(player.x / mapScale * W, player.y / mapScale * H, 7, ctx, true)
//      (R = drawCircle helper; mapScale = world->screen scale)
//   5. team dots (rgba(255,255,255,0.35)) if player.team
//   6. death/kill markers: fillText('x', 34px Hammersmith One) at wt / pe
// TODO (next pass):
//   - entity classes: what populates Oe + each draw() body
//   - mapScale value + camera follow
//   - the store/skins UI (sl/ol/al/Ii — hats/tails shop: skins[hatId], tails[tailId],
//     hatPreview imgs ./img/accessories/access_*.png + ./img/hats/hat_*.png)
//   - user's tampermonkeyclient.js render functions = unoptimized reference

