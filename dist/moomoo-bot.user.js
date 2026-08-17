// ==UserScript==
// @name        MooMoo Bot
// @namespace   https://greasyfork.org/users/gaston1799
// @version     0.1.0
// @description MooMoo.io bot - modular, single-file (no @require)
// @match       *://*.moomoo.io/*
// @run-at      document-start
// @grant       none
// ==/UserScript==


(() => {
  // lib/crypto.js
  var K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  function rotr(x, n) {
    return x >>> n | x << 32 - n;
  }
  function sha256(bytes) {
    const l = bytes.length;
    const ml = l * 8;
    const buf = new Uint8Array(l + 9 + 63 >> 6 << 6);
    buf.set(bytes);
    buf[l] = 128;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 4, ml >>> 0, false);
    dv.setUint32(buf.length - 8, Math.floor(ml / 4294967296), false);
    let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762, h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
    const w = new Uint32Array(64);
    for (let off = 0; off < buf.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
        w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = e & f ^ ~e & g;
        const t1 = h + S1 + ch + K[i] + w[i] >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = a & b ^ a & c ^ b & c;
        const t2 = S0 + maj >>> 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      h0 = h0 + a >>> 0;
      h1 = h1 + b >>> 0;
      h2 = h2 + c >>> 0;
      h3 = h3 + d >>> 0;
      h4 = h4 + e >>> 0;
      h5 = h5 + f >>> 0;
      h6 = h6 + g >>> 0;
      h7 = h7 + h >>> 0;
    }
    const out = new Uint8Array(32);
    const od = new DataView(out.buffer);
    od.setUint32(0, h0, false);
    od.setUint32(4, h1, false);
    od.setUint32(8, h2, false);
    od.setUint32(12, h3, false);
    od.setUint32(16, h4, false);
    od.setUint32(20, h5, false);
    od.setUint32(24, h6, false);
    od.setUint32(28, h7, false);
    return out;
  }
  function prng(seed) {
    let s = seed | 0;
    return () => {
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var C2S_SYMBOLS = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
  var S2C_SYMBOLS = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  function buildTables(names, seed) {
    const idx = names.map((_, i) => i);
    const rnd = prng(seed >>> 0);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const enc2 = {}, dec2 = {};
    for (let i = 0; i < names.length; i++) {
      enc2[names[i]] = idx[i];
      dec2[idx[i]] = names[i];
    }
    return { enc: enc2, dec: dec2 };
  }
  function deriveCrypto(seed) {
    const t = Math.imul(seed >>> 0, 2654435761) >>> 0;
    return {
      c2s: buildTables(C2S_SYMBOLS, t),
      s2c: buildTables(S2C_SYMBOLS, (t ^ 2246822507) >>> 0)
    };
  }
  function hexToBytes(hex) {
    const out = new Uint8Array(hex.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  var MAC_SIZE = 6;
  function hmacSha256(key, msg) {
    const BLOCK = 64;
    let k = key;
    if (k.length > BLOCK) k = sha256(k);
    const pad = new Uint8Array(BLOCK);
    pad.set(k);
    const inner = new Uint8Array(BLOCK + msg.length);
    const outer = new Uint8Array(BLOCK + 32);
    for (let i = 0; i < BLOCK; i++) {
      inner[i] = pad[i] ^ 54;
      outer[i] = pad[i] ^ 92;
    }
    inner.set(msg, BLOCK);
    outer.set(sha256(inner), BLOCK);
    return sha256(outer);
  }
  function packetMac(key, msg) {
    return hmacSha256(key, msg).subarray(0, MAC_SIZE);
  }

  // lib/msgpack.js
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  function writeStr(out, s) {
    const b = enc.encode(s);
    const n = b.length;
    if (n < 32) {
      out.push(160 + n);
    } else if (n < 256) {
      out.push(217, n);
    } else if (n < 65536) {
      out.push(218, n >> 8, n & 255);
    } else {
      out.push(219, n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255);
    }
    for (const x of b) out.push(x);
  }
  function encode(value) {
    const out = [];
    const go = (v) => {
      if (v === null || v === void 0) {
        out.push(192);
        return;
      }
      switch (typeof v) {
        case "boolean":
          out.push(v ? 195 : 194);
          return;
        case "number": {
          if (Number.isInteger(v)) {
            if (v >= 0) {
              if (v < 128) out.push(v);
              else if (v < 256) out.push(204, v);
              else if (v < 65536) out.push(205, v >> 8, v & 255);
              else if (v < 4294967296) out.push(206, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
              else {
                out.push(207);
                const hi = Math.floor(v / 4294967296), lo = v >>> 0;
                out.push(
                  hi >>> 24 & 255,
                  hi >>> 16 & 255,
                  hi >>> 8 & 255,
                  hi & 255,
                  lo >>> 24 & 255,
                  lo >>> 16 & 255,
                  lo >>> 8 & 255,
                  lo & 255
                );
              }
            } else {
              if (v >= -32) out.push(224 | v + 32);
              else if (v >= -128) out.push(208, v & 255);
              else if (v >= -32768) out.push(209, v >> 8 & 255, v & 255);
              else if (v >= -2147483648) out.push(210, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
              else {
                out.push(211);
                const hi = Math.floor(v / 4294967296), lo = v >>> 0;
                out.push(
                  hi >>> 24 & 255,
                  hi >>> 16 & 255,
                  hi >>> 8 & 255,
                  hi & 255,
                  lo >>> 24 & 255,
                  lo >>> 16 & 255,
                  lo >>> 8 & 255,
                  lo & 255
                );
              }
            }
          } else {
            const f = new Float64Array([v]);
            const b = new Uint8Array(f.buffer);
            out.push(203);
            for (let i = 7; i >= 0; i--) out.push(b[i]);
          }
          return;
        }
        case "string":
          writeStr(out, v);
          return;
        case "object": {
          if (Array.isArray(v)) {
            const n2 = v.length;
            if (n2 < 16) out.push(144 + n2);
            else if (n2 < 65536) out.push(220, n2 >> 8, n2 & 255);
            else out.push(221, n2 >>> 24 & 255, n2 >>> 16 & 255, n2 >>> 8 & 255, n2 & 255);
            for (const x of v) go(x);
            return;
          }
          if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
            const b = v instanceof Uint8Array ? v : new Uint8Array(v);
            const n2 = b.length;
            if (n2 < 256) out.push(196, n2);
            else if (n2 < 65536) out.push(197, n2 >> 8, n2 & 255);
            else out.push(198, n2 >>> 24 & 255, n2 >>> 16 & 255, n2 >>> 8 & 255, n2 & 255);
            for (const x of b) out.push(x);
            return;
          }
          const keys = Object.keys(v);
          const n = keys.length;
          if (n < 16) out.push(128 + n);
          else if (n < 65536) out.push(222, n >> 8, n & 255);
          else out.push(223, n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255);
          for (const k of keys) {
            go(k);
            go(v[k]);
          }
          return;
        }
        default:
          out.push(192);
      }
    };
    go(value);
    return new Uint8Array(out);
  }
  function decode(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    const read = (n) => {
      const v = dv.getUint8(pos);
      pos += n;
      return v;
    };
    const readU16 = () => {
      const v = dv.getUint16(pos);
      pos += 2;
      return v;
    };
    const readU32 = () => {
      const v = dv.getUint32(pos);
      pos += 4;
      return v;
    };
    const readI32 = () => {
      const v = dv.getInt32(pos);
      pos += 4;
      return v;
    };
    const go = () => {
      const b = read(1);
      if (b <= 127) return b;
      if (b >= 224) return b - 256;
      if (b >= 160 && b <= 191) return dec.decode(bytes.subarray(pos, pos += b - 160));
      if (b >= 144 && b <= 159) {
        const n = b - 144;
        const a = [];
        for (let i = 0; i < n; i++) a.push(go());
        return a;
      }
      if (b >= 128 && b <= 143) {
        const n = b - 128;
        const m = {};
        for (let i = 0; i < n; i++) {
          const k = go();
          m[k] = go();
        }
        return m;
      }
      switch (b) {
        case 192:
          return null;
        case 194:
          return false;
        case 195:
          return true;
        case 196: {
          const n = read(1);
          return bytes.slice(pos, pos += n);
        }
        case 197: {
          const n = readU16();
          return bytes.slice(pos, pos += n);
        }
        case 198: {
          const n = readU32();
          return bytes.slice(pos, pos += n);
        }
        case 202: {
          const v = dv.getFloat32(pos);
          pos += 4;
          return v;
        }
        case 203: {
          const v = dv.getFloat64(pos);
          pos += 8;
          return v;
        }
        case 204:
          return read(1);
        case 205:
          return readU16();
        case 206:
          return readU32();
        case 207: {
          const hi = readU32();
          const lo = readU32();
          return hi * 4294967296 + lo;
        }
        case 208: {
          const v = dv.getInt8(pos);
          pos += 1;
          return v;
        }
        case 209: {
          const v = dv.getInt16(pos);
          pos += 2;
          return v;
        }
        case 210:
          return readI32();
        case 211: {
          const hi = readI32();
          const lo = readU32();
          return hi * 4294967296 + lo;
        }
        case 217: {
          const n = read(1);
          return dec.decode(bytes.subarray(pos, pos += n));
        }
        case 218: {
          const n = readU16();
          return dec.decode(bytes.subarray(pos, pos += n));
        }
        case 219: {
          const n = readU32();
          return dec.decode(bytes.subarray(pos, pos += n));
        }
        case 220: {
          const n = readU16();
          const a = [];
          for (let i = 0; i < n; i++) a.push(go());
          return a;
        }
        case 221: {
          const n = readU32();
          const a = [];
          for (let i = 0; i < n; i++) a.push(go());
          return a;
        }
        case 222: {
          const n = readU16();
          const m = {};
          for (let i = 0; i < n; i++) {
            const k = go();
            m[k] = go();
          }
          return m;
        }
        case 223: {
          const n = readU32();
          const m = {};
          for (let i = 0; i < n; i++) {
            const k = go();
            m[k] = go();
          }
          return m;
        }
        default:
          throw new Error("msgpack: unsupported byte 0x" + b.toString(16));
      }
    };
    return go();
  }

  // lib/client.js
  var MooClient = class {
    constructor() {
      this.ws = null;
      this.connected = false;
      this.socketId = -1;
      this.session = null;
      this.handlers = {};
    }
    on(name, fn) {
      this.handlers[name] = fn;
      return this;
    }
    connect(url) {
      return new Promise((resolve, reject) => {
        if (this.ws) {
          reject(new Error("already connected"));
          return;
        }
        const ws = this.ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        let done = false;
        ws.onopen = () => {
          this.connected = true;
        };
        ws.onmessage = (e) => {
          try {
            this._onMessage(new Uint8Array(e.data));
          } catch (err) {
            console.error("[client] recv error", err);
          }
        };
        ws.onclose = (e) => {
          this.connected = false;
          this.session = null;
          if (!done) {
            done = true;
            reject(new Error(e.code === 4001 ? "Invalid Connection" : `closed ${e.code}`));
          }
          this.handlers["$close"]?.(e.code, e.reason);
        };
        ws.onerror = () => {
          if (!done) {
            done = true;
            reject(new Error("socket error"));
          }
        };
        this._ready = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
      });
    }
    _onMessage(bytes) {
      const [type, payload] = decode(bytes);
      if (type === "io-init") {
        this.socketId = payload[0];
        if (payload[3] === 1) {
          const tables = deriveCrypto(payload[1] >>> 0);
          this.session = {
            key: hexToBytes(payload[2]),
            c2s: tables.c2s,
            s2c: tables.s2c,
            seq: 0
          };
        } else {
          this.session = null;
        }
        this._ready?.();
        return;
      }
      let name = type;
      if (this.session && typeof type === "number") {
        name = this.session.s2c.dec[type];
        if (name === void 0) return;
      }
      this.handlers[name]?.(...payload);
    }
    send(name, ...args) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
      const payload = this.session ? [this.session.c2s.enc[name], args, ++this.session.seq] : [name, args];
      if (this.session && payload[0] === void 0) return false;
      const body = encode(payload);
      if (this.session) {
        const mac = packetMac(this.session.key, body);
        const out = new Uint8Array(mac.length + body.length);
        out.set(mac, 0);
        out.set(body, mac.length);
        this.ws.send(out);
      } else {
        this.ws.send(body);
      }
      return true;
    }
    close() {
      this.session = null;
      if (this.ws) this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  };

  // lib/config.js
  var API_BASE = "https://api.moomoo.io";
  var BASE_HOST = "moomoo.io";
  var DEFAULT_PORT = 443;
  var SERVERS_VERSION = "1.27";
  var TURNSTILE_SITEKEY = "0x4AAAAAAAMYHI96GFiJzMmp";

  // lib/servers.js
  async function fetchServers() {
    const r = await fetch(`${API_BASE}/servers?v=${SERVERS_VERSION}`);
    return r.json();
  }
  function pickServer(list, { region } = {}) {
    let open = list.filter((s) => s.playerCount < s.playerCapacity);
    if (!open.length) open = list;
    if (region) {
      const byRegion = open.filter((s) => s.region === region);
      if (byRegion.length) open = byRegion;
    }
    const minPing = Math.min(...open.map((s) => s.ping ?? Infinity));
    const best = open.filter((s) => s.ping === minPing);
    const pool = best.length ? best : open;
    pool.sort((a, b) => a.playerCount / a.playerCapacity - b.playerCount / b.playerCapacity);
    return pool[0];
  }
  function serverAddress(s) {
    return s.region == 0 ? "localhost" : `${s.key}.${s.region}.${BASE_HOST}`;
  }
  function serverUrl(s, token) {
    const host = serverAddress(s);
    const port = s.port ?? DEFAULT_PORT;
    let url = `wss://${host}:${port}`;
    if (token) url += `?token=${encodeURIComponent(token)}`;
    return url;
  }

  // bot.user.js
  var CFG = {
    region: new URLSearchParams(location.search).get("region") || void 0,
    autoJoin: true
  };
  var log = (...a) => console.log("[moomoo-bot]", ...a);
  var client = new MooClient();
  window.__moomooBot = { client, cfg: CFG };
  function getTurnstileToken() {
    return new Promise((resolve, reject) => {
      if (window.turnstile?.render) return render(resolve, reject);
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => render(resolve, reject);
      s.onerror = () => reject(new Error("turnstile api failed to load"));
      document.head.appendChild(s);
    });
    function render(resolve, reject) {
      const el = document.getElementById("turnstileWidget") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "turnstileWidget" }));
      window.turnstile.render(el, {
        sitekey: TURNSTILE_SITEKEY,
        theme: "light",
        callback: resolve,
        "error-callback": reject,
        "expired-callback": () => reject(new Error("turnstile expired"))
      });
    }
  }
  client.on("$close", (code) => log("closed", code)).on("io-init", () => log("handshake done, session crypto active")).on("D", (u) => {
  });
  var botControls = {
    spawn: (sid = client.socketId) => client.send("P", sid, 1),
    // accept spawn
    aim: (angle) => client.send("9", angle),
    // set aim angle
    shoot: (buildIndex = null) => client.send("F", null, buildIndex ?? 0),
    lockDir: (on) => client.send("K", on ? 1 : 0),
    chat: (text) => client.send("6", String(text).slice(0, 30)),
    reset: () => client.send("e")
  };
  window.__moomooBot = { client, cfg: CFG, controls: botControls };
  async function boot() {
    log("fetching servers\u2026");
    const list = await fetchServers();
    const server = pickServer(list, CFG);
    log("server:", server.region, server.name, `${server.playerCount}/${server.playerCapacity}`);
    log("solving turnstile\u2026");
    const token = await getTurnstileToken();
    log("token ok");
    await client.connect(serverUrl(server, token));
    log("connected \u2014 spawning\u2026");
    if (CFG.autoJoin) botControls.spawn();
  }
  boot().catch((e) => log("boot failed:", e.message));
})();
