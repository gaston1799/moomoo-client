// probe9.mjs — mm-turnstile element details
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
  const el = document.getElementById('mm-turnstile');
  if (!el) return { el: false };
  return {
    el: true,
    rect: el.getBoundingClientRect().toJSON(),
    html: el.innerHTML.slice(0, 400),
    iframes: el.querySelectorAll('iframe').length,
    allIframes: Array.from(document.querySelectorAll('iframe')).map(f => (f.src || f.id || '').slice(0, 60)),
    display: getComputedStyle(el).display,
    visibility: getComputedStyle(el).visibility
  };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
