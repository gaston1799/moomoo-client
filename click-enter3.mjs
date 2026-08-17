// click-enter3.mjs — click enter, screenshot at intervals via a helper
const PORT = process.argv[2] || 9251;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.onopen = res);
let id = 0;
const send = (m, p = {}) => new Promise(res => { const i = ++id; const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Runtime.enable');
const r = await send('Runtime.evaluate', {
  expression: `(() => {
    const ni = document.getElementById('nameInput');
    if (ni) ni.value = 'TestPilot';
    const enter = document.getElementById('enterGame');
    if (!enter) return 'no enter';
    if (enter.classList.contains('disabled')) return 'enter disabled';
    enter.click();
    return 'clicked';
  })()`,
  returnByValue: true,
});
console.log('enter:', r.result?.result?.value);
// poll splash visibility quickly
for (let i = 0; i < 12; i++) {
  await new Promise(res => setTimeout(res, 500));
  const r2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const s = document.getElementById('mm-splash');
      const st = s ? s.querySelector('.status').textContent : null;
      return { splash: !!s && !s.classList.contains('hide'), status: st, inGame: document.getElementById('gameUI').style.display === 'block' };
    })()`,
    returnByValue: true,
  });
  console.log('t+' + (i * 0.5) + 's', JSON.stringify(r2.result?.result?.value));
}
process.exit(0);
