// probe10.mjs — check live page for altcha vs turnstile
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
  const altcha = document.getElementById('altcha');
  return {
    altchaEl: !!altcha,
    altchaOuter: altcha ? altcha.outerHTML.slice(0, 350) : null,
    altchaState: altcha ? altcha.getAttribute('state') : null,
    turnstileWidget: !!document.getElementById('turnstileWidget'),
    altchaGlobal: typeof window.Altcha,
    htmlHasAltcha: document.documentElement.outerHTML.includes('altcha'),
    turnstileScripts: Array.from(document.querySelectorAll('script')).map(s => s.src).filter(s => /turnstile|challenges|altcha/i.test(s))
  };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
