// probe-ui2.mjs — menu structure detail
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
  const q = (sel) => { const e = document.querySelector(sel); return e ? { id: e.id || null, cls: (e.className||'').toString().slice(0,60), html: e.outerHTML.slice(0, 700) } : null; };
  return {
    mainMenu: q('#mainMenu'),
    serverBrowser: q('#serverBrowser'),
    enterGame: q('#enterGame'),
    nameInput: q('#nameInput'),
    altServer: q('#altServer'),
    skinHolder: q('#skinColorHolder'),
    menuDisplay: getComputedStyle(document.getElementById('mainMenu')).display,
    gameUIDisplay: getComputedStyle(document.getElementById('gameUI')).display,
    canvasId: document.getElementById('gameCanvas') ? 'present' : 'missing',
    canvasDisplay: getComputedStyle(document.getElementById('gameCanvas')).display,
    canvasStyle: (document.getElementById('gameCanvas')||{style:{}}).style.cssText,
    nameInputType: (document.getElementById('nameInput')||{}).tagName,
  };
})()`;
const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
