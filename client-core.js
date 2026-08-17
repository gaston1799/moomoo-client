// client-core.js — the replacement MooMoo client (runs instead of the bundle).
// Focus: a slick animated loading screen + a restyled main menu driving the
// ORIGINAL game UI (server browser, name, skins, HUD). No custom canvas
// renderer — the game world stays the original's. Handles:
//   splash -> menu -> play -> turnstile (auto-execute) -> connect -> spawn -> HUD
import { MooClient } from './lib/client.js';
import { fetchServers, pickServer } from './lib/servers.js';
import { TURNSTILE_SITEKEY } from './lib/config.js';

const $ = (id) => document.getElementById(id);
const log = (...a) => console.log('[moomoo-client]', ...a);

const state = {
  serverList: [],
  selected: null,        // {region, name}
  skin: 0,
  token: null,
  client: null,
  player: null,          // my entity (stats source)
  stats: {},             // points/food/wood/stone/kills/xp/age...
  splash: null,          // splash element
};

// dev/test hook: point at the local mock server, skip Turnstile
const MOCK = !!(window.__mmMock);

// ---------------------------------------------------------------------------
// animated splash (pure CSS — no canvas, no react needed)
// ---------------------------------------------------------------------------
const SPLASH_CSS = `
#mm-splash{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
  flex-direction:column;background:radial-gradient(1200px 800px at 20% 10%,#1d3320 0%,#0d1410 45%,#060a08 100%);
  font-family:'Hammersmith One','Segoe UI',sans-serif;overflow:hidden;transition:opacity .8s ease,visibility .8s}
#mm-splash.hide{opacity:0;visibility:hidden}
#mm-splash .aurora{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;animation:mmFloat 14s ease-in-out infinite}
#mm-splash .a1{width:520px;height:520px;background:#3f8f3f;top:-140px;left:-120px}
#mm-splash .a2{width:460px;height:460px;background:#2e6b8f;bottom:-120px;right:-100px;animation-delay:-5s}
#mm-splash .a3{width:340px;height:340px;background:#7a4fc0;top:40%;left:62%;animation-delay:-9s}
@keyframes mmFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(50px,-40px) scale(1.15)}66%{transform:translate(-40px,30px) scale(.9)}}
#mm-splash .title{position:relative;font-size:64px;letter-spacing:6px;color:#eaffea;text-shadow:0 0 18px #8ec33f88,0 0 60px #8ec33f33;animation:mmTitle 2.4s ease-in-out infinite}
#mm-splash .title b{color:#8ec33f}
@keyframes mmTitle{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
#mm-splash .moo{position:relative;font-size:52px;animation:mmMoo 1.6s ease-in-out infinite}
@keyframes mmMoo{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(8deg) translateY(-10px)}}
#mm-splash .status{position:relative;margin-top:26px;font-size:15px;color:#9fd69f;font-family:'Courier New',monospace;min-height:20px}
#mm-splash .status::after{content:'▌';animation:mmBlink 1s steps(1) infinite}
@keyframes mmBlink{50%{opacity:0}}
#mm-splash .bar{position:relative;margin-top:18px;width:280px;height:6px;background:#1c2a1c;border-radius:3px;overflow:hidden}
#mm-splash .bar i{position:absolute;inset:0;width:40%;background:linear-gradient(90deg,#8ec33f,#d7ff8f,#8ec33f);background-size:200% 100%;border-radius:3px;animation:mmSlide 1.4s linear infinite}
@keyframes mmSlide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
#mm-splash .rings{position:relative;margin-top:34px;width:64px;height:64px}
#mm-splash .rings span{position:absolute;inset:0;border:2px solid #b8e986;border-radius:50%;animation:mmRing 2s ease-out infinite}
#mm-splash .rings span:nth-child(2){animation-delay:.5s}
#mm-splash .rings span:nth-child(3){animation-delay:1s}
@keyframes mmRing{0%{transform:scale(.2);opacity:1}100%{transform:scale(1.4);opacity:0}}
#mm-splash .tip{position:absolute;bottom:22px;color:#3d5a3d;font-size:12px;letter-spacing:2px}
`;

function showSplash(status) {
  if (!state.splash) {
    const st = document.createElement('style');
    st.textContent = SPLASH_CSS;
    document.head.appendChild(st);
    const el = document.createElement('div');
    el.id = 'mm-splash';
    el.innerHTML = `
      <div class="aurora a1"></div><div class="aurora a2"></div><div class="aurora a3"></div>
      <div class="moo">🐮</div>
      <div class="title">M<b>OO</b>M<b>OO</b>.io</div>
      <div class="rings"><span></span><span></span><span></span></div>
      <div class="bar"><i></i></div>
      <div class="status"></div>
      <div class="tip">MOOMOO CLIENT</div>`;
    document.body.appendChild(el);
    state.splash = el;
  }
  state.splash.classList.remove('hide');
  const s = state.splash.querySelector('.status');
  if (s && status) s.textContent = status;
}

function hideSplash() {
  if (state.splash) state.splash.classList.add('hide');
}

// ---------------------------------------------------------------------------
// menu restyle (overlays the ORIGINAL menu)
// ---------------------------------------------------------------------------
const MENU_CSS = `
#mainMenu{background:radial-gradient(1000px 700px at 50% 0%,#1a2b1d 0%,#0d1410 60%,#060a08 100%)}
#menuContainer{animation:mmMenuIn .7s ease}
@keyframes mmMenuIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
#gameName{color:#eaffea;text-shadow:0 0 22px #8ec33f88;letter-spacing:4px}
#setupCard{background:rgba(15,22,16,.85)!important;border:1px solid #2a3d2a!important;border-radius:14px!important;
  box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 0 40px rgba(142,195,63,.05)!important;padding:18px!important}
#menuCardHolder .menuCard{background:rgba(15,22,16,.85)!important;border:1px solid #2a3d2a!important;border-radius:14px!important}
#adCard,#wideAdCard{display:none!important}
#guideCard{color:#cfe6cf!important}
#guideCard .menuHeader{color:#b8e986!important}
#guideCard .menuText{color:#a8c9a8!important}
#menuCardHolder .menuCard{background:rgba(15,22,16,.85)!important;border:1px solid #2a3d2a!important;border-radius:14px!important;box-shadow:none!important}
#serverBrowser select:hover,#serverBrowser select:focus{border-color:#8ec33f!important;outline:none}
#nameInput:hover{border-color:#3d5a3d!important}
#mainMenu ::-webkit-scrollbar{width:8px}
#mainMenu ::-webkit-scrollbar-track{background:#0d1410}
#mainMenu ::-webkit-scrollbar-thumb{background:#2a3d2a;border-radius:4px}
#mainMenu ::-webkit-scrollbar-thumb:hover{background:#3d5a3d}
#linksContainer2,#linksContainer2 a{color:#9fd69f!important}
#linksContainer2 a:hover{color:#d7ff8f!important}
#mainMenu #linksContainer2{background:transparent!important}
#nameInput{background:#0d1410!important;border:1px solid #2a3d2a!important;color:#eaffea!important;border-radius:8px!important;padding:8px 12px!important;width:calc(100% - 28px)!important}
#nameInput:focus{outline:none;border-color:#8ec33f!important;box-shadow:0 0 0 3px #8ec33f33}
#enterGame{background:linear-gradient(180deg,#9ecf57,#6f9f3a)!important;color:#0a1208!important;font-weight:700;
  border-radius:10px!important;box-shadow:0 6px 0 #4a7028,0 12px 24px rgba(0,0,0,.4)!important;transition:transform .1s,box-shadow .1s!important;letter-spacing:1px}
#enterGame:hover{transform:translateY(-2px);box-shadow:0 8px 0 #4a7028,0 16px 30px rgba(0,0,0,.5)!important}
#enterGame:active{transform:translateY(4px);box-shadow:0 2px 0 #4a7028!important}
#serverBrowser select{background:#0d1410!important;color:#d8f5d8!important;border:1px solid #2a3d2a!important;border-radius:8px!important}
#skinColorHolder div{border-radius:50%;transition:transform .15s}
#skinColorHolder div:hover{transform:scale(1.25)}
`;

function applyMenuStyle() {
  const st = document.createElement('style');
  st.textContent = MENU_CSS;
  document.head.appendChild(st);
}

// ---------------------------------------------------------------------------
// original-UI drive
// ---------------------------------------------------------------------------
function revealMenu() {
  if ($('loadingText')) $('loadingText').style.display = 'none';
  if ($('menuCardHolder')) $('menuCardHolder').style.display = 'block';
  const mc = $('menuContainer');
  if (mc) mc.style.animation = 'mmMenuIn .7s ease';
}

const SKINS = ['#8ec33f', '#f0544f', '#4a90d9', '#f2c94c', '#f7a8c4', '#9b59b6', '#f2994a', '#2dd4bf', '#a3e635', '#8d6e63', '#f5f5f5', '#2d2d2d'];

function buildSkins() {
  const holder = $('skinColorHolder');
  if (!holder) return;
  holder.innerHTML = '';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:6px';
  SKINS.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.title = 'skin ' + i;
    dot.style.cssText = `width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${i === state.skin ? '#fff' : 'transparent'};display:inline-block;transition:transform .15s`;
    dot.onmouseenter = () => { dot.style.transform = 'scale(1.25)'; };
    dot.onmouseleave = () => { dot.style.transform = 'none'; };
    dot.onclick = () => {
      state.skin = i;
      row.querySelectorAll('div').forEach((d, j) => d.style.borderColor = j === i ? '#fff' : 'transparent');
    };
    row.appendChild(dot);
  });
  holder.appendChild(row);
}

function buildServerSelect(list) {
  const sb = $('serverBrowser');
  if (!sb) return;
  sb.innerHTML = '';
  const sel = document.createElement('select');
  sel.id = 'mm-server-select';
  sel.style.cssText = 'width:100%;font-size:13px;padding:3px;margin-top:8px;background:#0d1410;color:#d8f5d8;border:1px solid #2a3d2a;border-radius:8px';
  const total = list.reduce((a, s) => a + Math.min(s.playerCount, s.playerCapacity), 0);
  const opt = (text, value, disabled) => {
    const o = document.createElement('option');
    o.textContent = text;
    if (value !== undefined) o.value = value;
    if (disabled) o.disabled = true;
    return o;
  };
  sel.appendChild(opt(`All Servers - ${total} players`, undefined, true));
  const groups = new Map();
  for (const s of list) {
    if (!groups.has(s.region)) groups.set(s.region, []);
    groups.get(s.region).push(s);
  }
  const regionNames = { 0: 'US East', 1: 'US West', 2: 'Europe', 3: 'Asia', 4: 'Brazil', 5: 'Sydney', 6: 'Africa', 7: 'India' };
  for (const [region, servers] of groups) {
    const rp = servers.reduce((a, s) => a + Math.min(s.playerCount, s.playerCapacity), 0);
    sel.appendChild(opt(`${regionNames[region] || region} - ${rp} players`, undefined, true));
    for (const s of servers) {
      const ping = s.ping != null ? ` [${Math.floor(s.ping)}ms]` : ' [?]';
      sel.appendChild(opt(`${s.name} [${Math.min(s.playerCount, s.playerCapacity)}/${s.playerCapacity}]${ping}`, `${s.region}:${s.name}`));
    }
  }
  sel.onchange = () => {
    const [t, i] = sel.value.split(':');
    state.selected = { region: Number(t), name: i };
  };
  const first = sel.querySelector('option:not([disabled])');
  if (first) { sel.value = first.value; state.selected = { region: Number(first.value.split(':')[0]), name: first.value.split(':')[1] }; }
  sb.appendChild(sel);
}

function setupName() {
  const ni = $('nameInput');
  if (!ni) return;
  let n = '';
  try { n = localStorage.getItem('moo_name') || ''; } catch (e) { /* ignore */ }
  if (!n && window.FRVR && FRVR.profile) {
    n = FRVR.profile.name() || '';
    if (n) n += Math.floor(Math.random() * 90) + 9;
  }
  ni.value = n || '';
  ni.addEventListener('change', () => { try { localStorage.setItem('moo_name', ni.value); } catch (e) { /* ignore */ } });
}

function setupAltServer() {
  const el = $('altServer');
  if (!el) return;
  el.innerHTML = "<a href='//sandbox.moomoo.io/'>Try the sandbox<i class='material-icons' style='font-size:10px;vertical-align:middle'>arrow_forward_ios</i></a>";
}

// ---------------------------------------------------------------------------
// token (auto-execute; tokenless fallback like the game)
// ---------------------------------------------------------------------------
function getToken(timeoutMs = 7000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (t) => { if (!settled) { settled = true; resolve(t); } };
    const tryRender = () => {
      if (!(window.turnstile && typeof window.turnstile.render === 'function')) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = tryRender;
        s.onerror = () => done(null);
        document.head.appendChild(s);
        return;
      }
      let el = $('mm-turnstile');
      if (!el) {
        el = document.createElement('div');
        el.id = 'mm-turnstile';
        el.style.cssText = 'position:fixed;top:-100px;left:-100px;width:300px;height:65px;z-index:10000';
        document.body.appendChild(el);
      }
      try {
        window.turnstile.render(el, {
          sitekey: TURNSTILE_SITEKEY, theme: 'dark',
          execution: 'execute', appearance: 'interaction-only',
          callback: (t) => done(t),
          'error-callback': () => done(null),
          'expired-callback': () => done(null),
        });
        const tryExecute = () => {
          if (window.turnstile && typeof window.turnstile.execute === 'function') {
            try { window.turnstile.execute(el); } catch (e) { setTimeout(tryExecute, 500); }
          } else setTimeout(tryExecute, 250);
        };
        setTimeout(tryExecute, 400);
      } catch (e) {
        done(null);
      }
    };
    tryRender();
    setTimeout(() => done(null), timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// HUD (original elements, no custom rendering)
// ---------------------------------------------------------------------------
function refreshHUD() {
  if ($('scoreDisplay')) $('scoreDisplay').innerText = state.stats.points ?? 0;
  if ($('foodDisplay')) $('foodDisplay').innerText = state.stats.food ?? 0;
  if ($('woodDisplay')) $('woodDisplay').innerText = state.stats.wood ?? 0;
  if ($('stoneDisplay')) $('stoneDisplay').innerText = state.stats.stone ?? 0;
  if ($('killCounter')) $('killCounter').innerText = state.stats.kills ?? 0;
}

function setAge(xp, maxXp, age) {
  if (xp != null) state.stats.xp = xp;
  if (maxXp != null) state.stats.maxXp = maxXp;
  if (age != null) state.stats.age = age;
  const { xp: X = 0, maxXp: MX = 1, age: A = 0 } = state.stats;
  if ($('ageText')) $('ageText').innerHTML = A >= 10 ? 'MAX AGE' : 'AGE ' + A;
  if ($('ageBarBody')) $('ageBarBody').style.width = (A >= 10 ? 100 : (X / MX) * 100) + '%';
}

// ---------------------------------------------------------------------------
// game flow
// ---------------------------------------------------------------------------
async function play() {
  try {
    await playInner();
  } catch (err) {
    log('play error:', err && err.message ? err.message : err);
    showSplash('error: ' + (err && err.message ? err.message : err));
  }
}

async function playInner() {
  const name = ($('nameInput') && $('nameInput').value.trim()) || 'Player';
  try { localStorage.setItem('moo_name', name); } catch (e) { /* ignore */ }

  showSplash(`welcome, ${name}…`);

  let token = null;
  if (!MOCK) {
    showSplash('solving turnstile…');
    token = await getToken();
    state.token = token;
    log('token:', token ? 'OK (auto-execute)' : 'none (tokenless fallback)');
  }

  let list = state.serverList;
  if (!list.length) { try { list = await fetchServers(); } catch (e) { /* ignore */ } }
  let server = state.selected && list.find(s => s.region === state.selected.region && s.name === state.selected.name);
  if (!server) server = pickServer(list, {});
  if (!server) { log('no server available'); return; }
  log('connecting to', server.key + '.' + server.region, token ? '(token)' : '(tokenless)');
  showSplash(`connecting to ${server.name} [${server.region}]…`);

  const client = new MooClient();
  state.client = client;
  wireProtocol(client);

  try {
    await client.connect(serverUrl(server, token ? 'cf:' + token : null));
  } catch (err) {
    log('connect failed:', err.message);
    showSplash('connect failed: ' + err.message);
    return;
  }
  log('connected, sending spawn (M)');
  client.send('M', { name, moofoll: 0, skin: state.skin });
  client._pingTimer = setInterval(() => client.send('0'), 2500);

  // switch to the original game UI
  if ($('mainMenu')) $('mainMenu').style.display = 'none';
  if ($('gameUI')) $('gameUI').style.display = 'block';
  hideSplash();
  log('in game');

  window.__moomooClient = { client, server, state };
}

function serverUrl(server, token) {
  const host = server.region == 0 ? 'localhost' : `${server.key}.${server.region}.moomoo.io`;
  const port = server.port ?? 443;
  let url = `wss://${host}:${port}`;
  if (token) url += `?token=${encodeURIComponent(token)}`;
  return url;
}

// ---------------------------------------------------------------------------
// protocol handlers
// ---------------------------------------------------------------------------
function wireProtocol(client) {
  client.on('$any', (name, payload) => {
    if (name !== 'a' && name !== '0') log('recv', JSON.stringify(name), JSON.stringify(payload).slice(0, 160));
  });

  // D: entity add — track the player for stats; no rendering
  client.on('D', (entity, isPlayer) => {
    if (!Array.isArray(entity) || !isPlayer) return;
    state.player = {
      id: entity[0], sid: entity[1], name: entity[2], x: entity[3], y: entity[4],
      health: entity[6], maxHealth: entity[7], scale: entity[8], skinColor: entity[9],
    };
    log('player entity: id', state.player.id, 'sid', state.player.sid, 'hp', state.player.health + '/' + state.player.maxHealth);
  });

  // N: stat set — v[key] = value
  client.on('N', (key, value) => {
    if (typeof key !== 'string') return;
    state.stats[key] = value;
    refreshHUD();
    log('stat', key, '=', value);
  });

  // O: health by sid
  client.on('O', (sid, health) => {
    if (state.player && state.player.sid === sid) { state.player.health = health; log('hp', health); }
  });

  // T: XP/maxXP/age
  client.on('T', (xp, maxXp, age) => { setAge(xp, maxXp, age); });

  // G: leaderboard
  client.on('G', (data) => {
    try {
      const lb = $('leaderboardData');
      if (lb && Array.isArray(data)) {
        lb.innerHTML = data.map((row, i) => {
          const name = Array.isArray(row) ? (row[1] ?? row[0]) : row;
          return `<div style="display:flex;justify-content:space-between;padding:1px 6px"><span>${i + 1}. ${name}</span></div>`;
        }).join('');
      }
    } catch (e) { /* ignore */ }
  });

  // Z: server restart countdown
  client.on('Z', (secs) => {
    const sd = $('shutdownDisplay');
    if (sd && typeof secs === 'number' && secs >= 0) {
      const t = Math.floor(secs / 60), s = secs % 60;
      sd.innerText = `Server restarting in ${t}:${String(s).padStart(2, '0')}`;
      sd.hidden = false;
    }
  });

  // close → back to menu
  client.on('$close', (code, reason) => {
    log('connection closed', code, reason);
    clearInterval(client._pingTimer);
    if ($('mainMenu')) $('mainMenu').style.display = 'block';
    if ($('gameUI')) $('gameUI').style.display = 'none';
  });
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  applyMenuStyle();
  setupName();
  setupAltServer();
  buildSkins();
  showSplash('fetching servers…');

  try {
    if (MOCK) {
      const r = await fetch(`https://localhost:${window.__mmMockPort || 9457}/servers`);
      state.serverList = await r.json();
    } else {
      const host = location.hostname;
      const apiBase = host.startsWith('dev') ? 'https://api-dev.moomoo.io' : host.startsWith('sandbox') ? 'https://api-sandbox.moomoo.io' : 'https://api.moomoo.io';
      const r = await fetch(apiBase + '/servers?v=1.27');
      state.serverList = await r.json();
    }
  } catch (e) {
    log('server fetch failed:', e.message);
  }

  buildServerSelect(state.serverList);
  log('menu ready,', state.serverList.length, 'servers');

  const enter = $('enterGame');
  if (enter) {
    enter.classList.remove('disabled');
    enter.addEventListener('click', play);
  }

  // brief pause so the splash reads nicely, then fade into the menu
  setTimeout(() => {
    revealMenu();
    hideSplash();
  }, 900);

  if (window.__mmBootAuto) play();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
