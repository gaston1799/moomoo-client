// probe-ui3.mjs — display states of menu pieces
const PORT = process.argv[2] || 9251;
const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
const list = await r.json();
const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.onopen = res);
let id = 0;
const send = (m, p = {}) => new Promise(res => { const i = ++id; const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Runtime.enable');
const js = `(() => {
  const ids = ['pre-content-container','mainMenu','menuContainer','gameName','loadingText','menuCardHolder','setupCard','gameUI','gameCanvas','serverBrowser','altServer','skinColorHolder','pingDisplay','diedText'];
  const out = {};
  for (const i of ids) { const el = document.getElementById(i); if (!el) continue; const cs = getComputedStyle(el); out[i] = { d: cs.display, v: cs.visibility, o: cs.opacity, inline: el.style.cssText.slice(0, 60) }; }
  return out;
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
