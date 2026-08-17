// probe7b.mjs — new client state
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
const res = await send('Runtime.evaluate', {
  expression: `(() => {
    const c = window.__moomooClient;
    return {
      client: !!c,
      connected: c ? c.client.connected : null,
      server: c && c.server ? c.server.key + '.' + c.server.region : null,
      player: c && c.state && c.state.player ? { id: c.state.player.id, sid: c.state.player.sid, name: c.state.player.name, hp: c.state.player.health + '/' + c.state.player.maxHealth, x: Math.round(c.state.player.x), y: Math.round(c.state.player.y) } : null,
      stats: c ? c.state.stats : null,
      entities: c ? c.state.renderer.state.entities.size : 0,
      menuDisplay: document.getElementById('mainMenu').style.display,
      gameUIDisplay: document.getElementById('gameUI').style.display,
      enterGame: (document.getElementById('enterGame') || {}).className,
      hudFood: (document.getElementById('foodDisplay') || {}).innerText,
      hudAge: (document.getElementById('ageText') || {}).innerHTML,
      lbRows: document.querySelectorAll('#leaderboardData div').length,
      canvasPainted: (() => { const cv = document.getElementById('gameCanvas'); if (!cv) return false; try { return cv.toDataURL().length > 20000; } catch (e) { return 'n/a'; } })()
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value, null, 2));
process.exit(0);
