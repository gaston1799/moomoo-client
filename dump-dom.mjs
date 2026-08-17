// dump-dom.mjs — print the original game UI's DOM hierarchy.
// Usage: node dump-dom.mjs [port] [--ids] [--depth N]
//   --ids   also print a flat list of every element id
//   --depth limit recursion (default 12)
const PORT = Number(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || 9251);
const IDS_ONLY = process.argv.includes('--ids');
const DEPTH = Number(process.argv.find(a => a.startsWith('--depth='))?.split('=')[1] || 12);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
if (!page) { console.log('no page target'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.onopen = res);
let id = 0;
const send = (m, p = {}) => new Promise(res => { const i = ++id; const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Runtime.enable');

const js = `(() => {
  const lines = [];
  const ids = [];
  const seen = new Set();
  const label = (el) => {
    let s = el.tagName ? el.tagName.toLowerCase() : el.nodeName;
    if (el.id) { s += '#' + el.id; if (!seen.has(el.id)) { seen.add(el.id); ids.push(el.id); } }
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 4).join('.') : '';
    if (cls) s += '.' + cls;
    const disp = el.style && el.style.display ? ' [display:' + el.style.display + ']' : '';
    return s + disp;
  };
  const walk = (el, depth) => {
    if (depth > ${DEPTH}) return;
    const kids = Array.from(el.children || []);
    if (!kids.length) { lines.push('  '.repeat(depth) + label(el)); return; }
    lines.push('  '.repeat(depth) + label(el) + ' {');
    for (const k of kids) walk(k, depth + 1);
    lines.push('  '.repeat(depth) + '}');
  };
  walk(document.documentElement, 0);
  return { tree: lines.join('\\n'), ids };
})()`;

const res = await send('Runtime.evaluate', { expression: js, returnByValue: true });
const v = res.result?.result?.value;
if (!v) { console.log('eval failed', JSON.stringify(res).slice(0, 200)); process.exit(1); }
console.log(v.tree);
if (IDS_ONLY) {
  console.log('\n==== ALL IDS (' + v.ids.length + ') ====');
  console.log(v.ids.join('\n'));
}
process.exit(0);
