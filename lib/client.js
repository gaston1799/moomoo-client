// lib/client.js — the MooMoo.io WebSocket client (clean, optimized).
// Handles io-init handshake, session crypto, msgpack encode/decode,
// MAC-prefixed packets, and a handler table keyed by decoded message name.
import { deriveCrypto, hexToBytes, packetMac } from './crypto.js';
import { encode as msgpackEncode, decode as msgpackDecode } from './msgpack.js';

export class MooClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.socketId = -1;
    this.session = null; // { key, c2s, s2c, seq }
    this.handlers = {};  // name -> (...args) => {}
  }

  on(name, fn) { this.handlers[name] = fn; return this; }

  connect(url) {
    return new Promise((resolve, reject) => {
      if (this.ws) { reject(new Error('already connected')); return; }
      const ws = this.ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      let done = false;

      ws.onopen = () => { this.connected = true; };
      ws.onmessage = (e) => {
        try { this._onMessage(new Uint8Array(e.data)); }
        catch (err) { console.error('[client] recv error', err); }
      };
      ws.onclose = (e) => {
        this.connected = false; this.session = null;
        if (!done) { done = true; reject(new Error(e.code === 4001 ? 'Invalid Connection' : `closed ${e.code}`)); }
        this.handlers['$close']?.(e.code, e.reason);
      };
      ws.onerror = () => {
        if (!done) { done = true; reject(new Error('socket error')); }
      };
      this._ready = () => { if (!done) { done = true; resolve(); } };
    });
  }

  _onMessage(bytes) {
    // every s2c message is prefixed with the 6-byte packet MAC
    const body = bytes.length > 6 ? bytes.subarray(6) : bytes;
    const [type, payload] = msgpackDecode(body);
    if (type === 'io-init') {
      // [socketId, seed, keyHex, mode]
      this.socketId = payload[0];
      if (payload[3] === 1) {
        const tables = deriveCrypto(payload[1] >>> 0);
        this.session = {
          key: hexToBytes(payload[2]),
          c2s: tables.c2s,
          s2c: tables.s2c,
          seq: 0,
        };
      } else {
        this.session = null;
      }
      this._ready?.();
      return;
    }
    let name = type;
    if (this.session && typeof type === 'number') {
      name = this.session.s2c.dec[type];
      if (name === undefined) return;
    }
    this.handlers[name]?.(...payload);
    this.handlers['$any']?.(name, payload);
  }

  send(name, ...args) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const payload = this.session
      ? [this.session.c2s.enc[name], args, ++this.session.seq]
      : [name, args];
    if (this.session && payload[0] === undefined) return false;
    const body = msgpackEncode(payload);
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
}
