// probe-ui.mjs — map the original game's UI DOM (menu, server select, HUD)
const PORT = process.argv[2] || 9251;
const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
const list = await r.json();
const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
if (!page) { console.log('no page'); process.exit(0); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.onopen = res);
let id = 0;
const send = (m, p = {}) => new Promise(res => { const i = ++id; const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Runtime.enable');
const js = `(() => {
  const ids = ['enterGame','turnstileWidget','wideAdCard','nt','serverList','servers','serverSelect','healthBar','xpBar','resourceDisplay','moo_name','ot-sdk-btn-floating'];
  const found = {};
  for (const i of ids) { const el = document.getElementById(i); found[i] = el ? { tag: el.tagName, cls: (el.className||'').toString().slice(0,50), display: getComputedStyle(el).display, visible: !!(el.offsetWidth||el.offsetHeight) } : null; }
  // all ids (candidates for menu/hud)
  const allIds = Array.from(document.querySelectorAll('[id]')).map(e => e.id).filter(Boolean);
  return { found, allIds, bodyChildren: Array.from(document.body.children).map(c => (c.tagName + (c.id ? '#' + c.id : '') + (c.className ? '.' + c.className.toString().split(' ').slice(0,3).join('.') : '')).slice(0, 80)) };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
