// click-enter2.mjs — reload, capture console, click enter, report
const PORT = process.argv[2] || 9251;
const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
const list = await r.json();
const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.onopen = res);
let id = 0;
const send = (m, p = {}) => new Promise(res => { const i = ++id; const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method: m, params: p })); });

const logs = [];
ws.addEventListener('message', (e) => {
  const d = JSON.parse(e.data);
  if (d.method === 'Runtime.consoleAPICalled') {
    logs.push(d.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  }
  if (d.method === 'Runtime.exceptionThrown') {
    logs.push('EXC: ' + (d.params.exceptionDetails?.exception?.description || '').slice(0, 300));
  }
});
await send('Runtime.enable');
await send('Page.enable');

// reload and wait for boot
await send('Page.reload');
console.log('reloading…');
await new Promise(res => setTimeout(res, 12000));

// consent + enter
const r1 = await send('Runtime.evaluate', { expression: `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /i accept|accept all/i.test(x.innerText||'')); if (b) { b.click(); return 'accepted'; } return 'no consent'; })()`, returnByValue: true });
console.log('consent:', r1.result?.result?.value);
await new Promise(res => setTimeout(res, 3000));

const r2 = await send('Runtime.evaluate', { expression: `(() => {
  const enter = document.getElementById('enterGame');
  if (!enter) return 'no enter';
  if (enter.classList.contains('disabled')) return 'enter disabled';
  const ni = document.getElementById('nameInput'); if (ni) ni.value = 'TestPilot';
  enter.click();
  return 'clicked';
})()`, returnByValue: true });
console.log('enter:', r2.result?.result?.value);

await new Promise(res => setTimeout(res, 15000));

const r3 = await send('Runtime.evaluate', { expression: `(() => ({
  menuDisplay: document.getElementById('mainMenu').style.display,
  gameUIDisplay: document.getElementById('gameUI').style.display,
  client: window.__moomooClient ? { connected: window.__moomooClient.client.connected, server: window.__moomooClient.server && window.__moomooClient.server.key } : null,
  canvas: !!document.getElementById('gameCanvas'),
  errorText: (document.getElementById('errorNotification') || {}).innerText || null
}))()`, returnByValue: true });
console.log('state:', JSON.stringify(r3.result?.result?.value, null, 2));
console.log('\n==== console logs ====');
console.log(logs.slice(-40).join('\n'));
process.exit(0);
