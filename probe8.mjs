// probe8.mjs — turnstile internals
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
  const el = document.getElementById('turnstileWidget');
  return {
    turnstileApi: typeof window.turnstile,
    renderFn: typeof window.turnstile?.render,
    widgetEl: !!el,
    widgetRect: el ? el.getBoundingClientRect().toJSON() : null,
    widgetHTML: el ? el.innerHTML.slice(0, 200) : null,
    widgetChildCount: el ? el.children.length : -1,
    scripts: Array.from(document.querySelectorAll('script[src*="turnstile"]')).map(s => s.src.split('?')[0].split('/').pop()),
    tsReady: typeof window.turnstile?.ready,
    tsCallbacks: typeof window.onGotTurnstileToken
  };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
