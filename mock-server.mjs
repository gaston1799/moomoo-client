// mock-server.mjs — local protocol mock of the MooMoo game server.
// Implements the real wire protocol: io-init (seed -> shuffled opcode tables),
// HMAC-SHA256-truncated-6 packet MACs, msgpack codec, and the message set the
// client understands (D/a/E/N/O/T/G/Z). Lets the client spawn + render
// entities without needing a Turnstile token or the real game servers.
// Run: node mock-server.mjs [port]
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { WebSocketServer } from 'ws';
import { deriveCrypto, hexToBytes, packetMac, sha256 } from './lib/crypto.js';
import { encode as msgpackEncode, decode as msgpackDecode } from './lib/msgpack.js';
import { randomBytes } from 'crypto';
import fs from 'fs';
const MLOG = 'D:/moomoo-inspect/mock-debug.log';
const mlog = (...a) => { try { fs.appendFileSync(MLOG, new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch (e) {} };

const PORT = Number(process.argv[2] || 9457);
const DELAY = Number(process.argv[3] || 2500); // ms before io-init — lets the splash show
const SEED = 987654321;
const KEY_HEX = randomBytes(32).toString('hex');
const KEY = hexToBytes(KEY_HEX);

const srv = createServer({
  key: readFileSync(new URL('./mock-key.pem', import.meta.url)),
  cert: readFileSync(new URL('./mock-cert.pem', import.meta.url)),
}, async (req, res) => {
  mlog('HTTP', req.method, req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.url.startsWith('/servers')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([{ region: 0, name: 'MOCK', key: 'localhost', playerCapacity: 40, playerCount: 1, port: PORT, version: '1.27', ping: 0 }]));
    return;
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html');
    res.end(HTML);
    return;
  }
  // proxy static assets from the real game (css/img/libs/fonts/…)
  if (req.url.startsWith('/css/') || req.url.startsWith('/img/') || req.url.startsWith('/libs/')
    || req.url.startsWith('/assets/') || req.url.startsWith('/fonts/') || req.url === '/service-worker.js'
    || req.url === '/manifest.json' || req.url === '/favicon.ico' || req.url.startsWith('/cdn-cgi/')) {
    try {
      const pr = await fetch('https://moomoo.io' + req.url, {
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'accept': 'text/css,*/*;q=0.1',
          'accept-language': 'en-US,en;q=0.9',
          'referer': 'https://moomoo.io/',
        },
      });
      if (!pr.ok) { res.statusCode = pr.status; res.end('proxy ' + pr.status); return; }
      const buf = Buffer.from(await pr.arrayBuffer());
      res.setHeader('Content-Type', pr.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(buf);
    } catch (e) { res.statusCode = 502; res.end('proxy error'); }
    return;
  }
  res.statusCode = 404;
  res.end('mock-server');
});

// Serve the real moomoo.io page (assets pointed at the real CDN) so the client
// runs same-origin with the mock API/WS — no mixed-content headaches.
let HTML = '<html><body>mock</body></html>';
try {
  const html = await fetch('https://moomoo.io/', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none',
      'upgrade-insecure-requests': '1',
    },
  }).then(r => r.text());
  HTML = html
    .replace(/(src|href)="\.\//g, '$1="https://moomoo.io/')
    .replace(/(src|href)='\.\//g, "$1='https://moomoo.io/")
    .replace(/<script[^>]*src="https:\/\/moomoo\.io\/assets\/index-[0-9a-f]+\.js"[^>]*><\/script>/g, '')
    // strip ALL scripts — the SDKs (FRVR, cookiepro, ads) wipe the page on the
    // mock origin with late document.write()/reloads. The menu is pure HTML/CSS;
    // our injected client provides all behavior.
    .replace(/<script[\s\S]*?<\/script>/g, '')
  mlog('HTML captured', html.length, 'bytes');
} catch (e) { mlog('HTML capture FAILED', e.message); }

const wss = new WebSocketServer({ server: srv });
wss.on('connection', (ws) => {
  mlog('WS connection');
  console.log('[mock] ws connected');
  const tables = deriveCrypto(SEED);
  const sid = 1;

  const send = (name, args) => {
    const body = msgpackEncode([tables.s2c.enc[name], args]);
    const mac = packetMac(KEY, body);
    const out = new Uint8Array(mac.length + body.length);
    out.set(mac, 0);
    out.set(body, mac.length);
    ws.send(Buffer.from(out));
    console.log('[mock] ->', name, JSON.stringify(args).slice(0, 140));
  };

  // io-init: [socketId, seed, keyHex, mode=1] (delayed so the loading UI shows)
  const initBody = msgpackEncode(['io-init', [sid, SEED, KEY_HEX, 1]]);
  const initMac = packetMac(KEY, initBody);
  const initOut = new Uint8Array(initMac.length + initBody.length);
  initOut.set(initMac, 0);
  initOut.set(initBody, initMac.length);
  setTimeout(() => {
    ws.send(Buffer.from(initOut));
    console.log('[mock] -> io-init (seed', SEED, ')');
    mlog('io-init sent');
  }, DELAY);

  ws.on('message', (data) => {
    mlog('WS msg', data.length, 'bytes');    const buf = Buffer.from(data);
    const mac = buf.subarray(0, 6);
    const body = buf.subarray(6);
    const expect = packetMac(KEY, body);
    const macOk = Buffer.from(mac).equals(Buffer.from(expect));
    let decoded;
    try { decoded = msgpackDecode(body); } catch (e) { console.log('[mock] decode error', e.message); return; }
    const [num, args, seq] = decoded;
    const name = tables.c2s.dec[num];
    console.log('[mock] <-', name, JSON.stringify(args).slice(0, 160), 'mac', macOk ? 'OK' : 'BAD', 'seq', seq);

    if (name === 'M') {
      const playerName = (args && args.name) || 'Player';
      // spawn: player + 2 cows
      setTimeout(() => {
        send('D', [[1, 7, playerName, 500, 500, 0, 100, 100, 10, 1], true]);
        send('D', [[2, 5, 'Cow1', 620, 540, 1, 50, 50, 12, 0], false]);
        send('D', [[3, 4, 'Cow2', 380, 460, 2, 50, 50, 12, 0], false]);
        send('T', [0, 100, 1]);       // xp, maxXp, age
        send('N', ['points', 0]);
        send('N', ['food', 100]);
        send('N', ['wood', 0]);
        send('N', ['stone', 0]);
        send('N', ['kills', 0]);
        send('O', [7, 100]);          // health by sid
        send('G', [[1, playerName, 0], [2, 'Cow1', 0]]);
      }, 300);
      // periodic position updates (13 fields per entity)
      let t = 0;
      const anim = setInterval(() => {
        t += 0.1;
        const flat = [
          7, 500 + 60 * Math.cos(t), 500 + 60 * Math.sin(t), t, 0, 0, 0, 0, 0, 1, 0, 0, 0,
          5, 620 + 40 * Math.cos(t * 0.7), 540 + 40 * Math.sin(t * 0.7), t * 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          4, 380 + 50 * Math.cos(t * 1.3 + 2), 460 + 50 * Math.sin(t * 1.3 + 2), t * 1.3 + 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        send('a', [flat]);
      }, 300);
      ws._anim = anim;
    } else if (name === '0') {
      // ping
    }
  });

  ws.on('close', () => { if (ws._anim) clearInterval(ws._anim); console.log('[mock] ws closed'); });
});

srv.listen(PORT, () => { mlog('LISTEN', PORT); console.log(`[mock] MooMoo mock server on wss://localhost:${PORT} (api: /servers)`); });
