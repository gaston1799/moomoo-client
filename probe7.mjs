// probe7.mjs — full client state
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
  const c = window.__moomooClient;
  return {
    client: !!c,
    server: c?.server ? { region: c.server.region, name: c.server.name, key: c.server.key?.slice(0, 8) } : null,
    ws: c?.client?.ws ? ['CONNECTING','OPEN','CLOSING','CLOSED'][c.client.ws.readyState] : null,
    socketId: c?.client?.socketId ?? null,
    session: !!c?.client?.session,
    loading: document.getElementById('mm-client-loading-text')?.textContent || null,
    canvas: !!document.getElementById('mm-client-canvas')
  };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
