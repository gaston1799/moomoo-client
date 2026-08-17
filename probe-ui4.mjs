// probe-ui4.mjs — verify menu widgets
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
  const sel = document.getElementById('mm-server-select');
  const options = sel ? Array.from(sel.options).slice(0, 12).map(o => (o.disabled ? '[H] ' : '') + o.text + ' => ' + o.value) : null;
  const enter = document.getElementById('enterGame');
  return {
    selectExists: !!sel,
    optionCount: sel ? sel.options.length : 0,
    options,
    selected: sel ? sel.value : null,
    enterGameClass: enter ? enter.className : null,
    nameInputValue: (document.getElementById('nameInput') || {}).value,
    skinCount: document.querySelectorAll('#skinColorHolder div').length,
    altServer: (document.getElementById('altServer') || {}).innerHTML?.slice(0, 80),
  };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
