// click-enter.mjs — dismiss consent (if any), set name, click Enter Game, watch state
const PORT = process.argv[2] || 9251;
const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
const list = await r.json();
const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.onopen = res);
let id = 0;
const send = (m, p = {}) => new Promise(res => { const i = ++id; const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Runtime.enable');

// consent dismiss (if present)
let r1 = await send('Runtime.evaluate', { expression: `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /i accept|accept all/i.test(x.innerText||'')); if (b) { b.click(); return 'accepted'; } return 'no consent'; })()`, returnByValue: true });
console.log('consent:', r1.result?.result?.value);
await new Promise(res => setTimeout(res, 1500));

// set name + click enter
const r2 = await send('Runtime.evaluate', { expression: `(() => {
  const ni = document.getElementById('nameInput');
  if (ni) { ni.value = 'TestPilot'; }
  const enter = document.getElementById('enterGame');
  if (!enter) return 'no enter button';
  if (enter.classList.contains('disabled')) return 'enter disabled';
  enter.click();
  return 'clicked enter';
})()`, returnByValue: true });
console.log('enter:', r2.result?.result?.value);

await new Promise(res => setTimeout(res, 12000));

const r3 = await send('Runtime.evaluate', { expression: `(() => ({
  menuDisplay: document.getElementById('mainMenu').style.display,
  gameUIDisplay: document.getElementById('gameUI').style.display,
  loading: document.getElementById('mm-client-loading-text') ? document.getElementById('mm-client-loading-text').textContent : null,
  client: window.__moomooClient ? { connected: window.__moomooClient.client.connected, server: window.__moomooClient.server && window.__moomooClient.server.name } : null
}))()`, returnByValue: true });
console.log('state:', JSON.stringify(r3.result?.result?.value, null, 2));
process.exit(0);
