// lib/crypto.js — MooMoo.io session crypto (clean-room, optimized).
// From the bundle RE: mulberry32 PRNG shuffles opcode tables per connection;
// every packet is HMAC-SHA256-truncated-to-6 bytes.

// --- SHA-256 (standard, compact) ---
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

export function sha256(bytes) {
  const l = bytes.length;
  const ml = l * 8;
  const buf = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  buf.set(bytes);
  buf[l] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 4, ml >>> 0, false);
  dv.setUint32(buf.length - 8, Math.floor(ml / 4294967296), false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let off = 0; off < buf.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const od = new DataView(out.buffer);
  od.setUint32(0, h0, false); od.setUint32(4, h1, false); od.setUint32(8, h2, false);
  od.setUint32(12, h3, false); od.setUint32(16, h4, false); od.setUint32(20, h5, false);
  od.setUint32(24, h6, false); od.setUint32(28, h7, false);
  return out;
}

// --- mulberry32 PRNG (Co) ---
export function prng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- opcode tables (Oi) ---
export const C2S_SYMBOLS = ['M','D','9','e','F','z','H','K','L','N','b','P','Q','c','6','S','0'];
export const S2C_SYMBOLS = ['A','B','C','D','E','a','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','X','Y','Z','g','1','2','3','4','5','6','7','8','9','0'];

export function buildTables(names, seed) {
  const idx = names.map((_, i) => i);
  const rnd = prng(seed >>> 0);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const enc = {}, dec = {};
  for (let i = 0; i < names.length; i++) { enc[names[i]] = idx[i]; dec[idx[i]] = names[i]; }
  return { enc, dec };
}

// --- per-connection crypto (Po) ---
export function deriveCrypto(seed) {
  const t = Math.imul(seed >>> 0, 2654435761) >>> 0;
  return {
    c2s: buildTables(C2S_SYMBOLS, t),
    s2c: buildTables(S2C_SYMBOLS, (t ^ 2246822507) >>> 0),
  };
}

// --- hex -> bytes (Ro) ---
export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// --- HMAC-SHA256 truncated to MAC_SIZE (Ao/Eo) ---
export const MAC_SIZE = 6;

export function hmacSha256(key, msg) {
  const BLOCK = 64;
  let k = key;
  if (k.length > BLOCK) k = sha256(k);
  const pad = new Uint8Array(BLOCK); pad.set(k);
  const inner = new Uint8Array(BLOCK + msg.length);
  const outer = new Uint8Array(BLOCK + 32);
  for (let i = 0; i < BLOCK; i++) { inner[i] = pad[i] ^ 0x36; outer[i] = pad[i] ^ 0x5c; }
  inner.set(msg, BLOCK);
  outer.set(sha256(inner), BLOCK);
  return sha256(outer);
}

export function packetMac(key, msg) {
  return hmacSha256(key, msg).subarray(0, MAC_SIZE);
}
