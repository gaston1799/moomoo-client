// lib/msgpack.js — minimal MessagePack encoder/decoder (self-contained, no deps).
// Supports the subset the game uses: nil, bool, ints, floats, str, bin, array, map.
// Verified against the bundle's Hi/Bo behavior.

const enc = new TextEncoder();
const dec = new TextDecoder();

function writeStr(out, s) {
  const b = enc.encode(s);
  const n = b.length;
  if (n < 32) { out.push(0xa0 + n); }
  else if (n < 256) { out.push(0xd9, n); }
  else if (n < 65536) { out.push(0xda, n >> 8, n & 0xff); }
  else { out.push(0xdb, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff); }
  for (const x of b) out.push(x);
}

export function encode(value) {
  const out = [];
  const go = (v) => {
    if (v === null || v === undefined) { out.push(0xc0); return; }
    switch (typeof v) {
      case 'boolean': out.push(v ? 0xc3 : 0xc2); return;
      case 'number': {
        if (Number.isInteger(v)) {
          if (v >= 0) {
            if (v < 128) out.push(v);
            else if (v < 256) out.push(0xcc, v);
            else if (v < 65536) out.push(0xcd, v >> 8, v & 0xff);
            else if (v < 4294967296) out.push(0xce, (v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
            else {
              out.push(0xcf);
              const hi = Math.floor(v / 4294967296), lo = v >>> 0;
              out.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
                       (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
            }
          } else {
            if (v >= -32) out.push(0xe0 | (v + 32));
            else if (v >= -128) out.push(0xd0, v & 0xff);
            else if (v >= -32768) out.push(0xd1, (v >> 8) & 0xff, v & 0xff);
            else if (v >= -2147483648) out.push(0xd2, (v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
            else {
              out.push(0xd3);
              const hi = Math.floor(v / 4294967296), lo = v >>> 0;
              out.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
                       (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
            }
          }
        } else {
          const f = new Float64Array([v]);
          const b = new Uint8Array(f.buffer);
          out.push(0xcb);
          for (let i = 7; i >= 0; i--) out.push(b[i]); // big-endian
        }
        return;
      }
      case 'string': writeStr(out, v); return;
      case 'object': {
        if (Array.isArray(v)) {
          const n = v.length;
          if (n < 16) out.push(0x90 + n);
          else if (n < 65536) out.push(0xdc, n >> 8, n & 0xff);
          else out.push(0xdd, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
          for (const x of v) go(x);
          return;
        }
        if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
          const b = v instanceof Uint8Array ? v : new Uint8Array(v);
          const n = b.length;
          if (n < 256) out.push(0xc4, n);
          else if (n < 65536) out.push(0xc5, n >> 8, n & 0xff);
          else out.push(0xc6, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
          for (const x of b) out.push(x);
          return;
        }
        const keys = Object.keys(v);
        const n = keys.length;
        if (n < 16) out.push(0x80 + n);
        else if (n < 65536) out.push(0xde, n >> 8, n & 0xff);
        else out.push(0xdf, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
        for (const k of keys) { go(k); go(v[k]); }
        return;
      }
      default: out.push(0xc0);
    }
  };
  go(value);
  return new Uint8Array(out);
}

export function decode(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const read = (n) => { const v = dv.getUint8(pos); pos += n; return v; };
  const readU16 = () => { const v = dv.getUint16(pos); pos += 2; return v; };
  const readU32 = () => { const v = dv.getUint32(pos); pos += 4; return v; };
  const readI32 = () => { const v = dv.getInt32(pos); pos += 4; return v; };
  const go = () => {
    const b = read(1);
    if (b <= 0x7f) return b;                       // positive fixint
    if (b >= 0xe0) return b - 256;                 // negative fixint
    if (b >= 0xa0 && b <= 0xbf) return dec.decode(bytes.subarray(pos, pos += b - 0xa0)); // fixstr
    if (b >= 0x90 && b <= 0x9f) { const n = b - 0x90; const a = []; for (let i = 0; i < n; i++) a.push(go()); return a; }
    if (b >= 0x80 && b <= 0x8f) { const n = b - 0x80; const m = {}; for (let i = 0; i < n; i++) { const k = go(); m[k] = go(); } return m; }
    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: { const n = read(1); return bytes.slice(pos, pos += n); }
      case 0xc5: { const n = readU16(); return bytes.slice(pos, pos += n); }
      case 0xc6: { const n = readU32(); return bytes.slice(pos, pos += n); }
      case 0xca: { const v = dv.getFloat32(pos); pos += 4; return v; }
      case 0xcb: { const v = dv.getFloat64(pos); pos += 8; return v; }
      case 0xcc: return read(1);
      case 0xcd: return readU16();
      case 0xce: return readU32();
      case 0xcf: { const hi = readU32(); const lo = readU32(); return hi * 4294967296 + lo; }
      case 0xd0: { const v = dv.getInt8(pos); pos += 1; return v; }
      case 0xd1: { const v = dv.getInt16(pos); pos += 2; return v; }
      case 0xd2: return readI32();
      case 0xd3: { const hi = readI32(); const lo = readU32(); return hi * 4294967296 + lo; }
      case 0xd9: { const n = read(1); return dec.decode(bytes.subarray(pos, pos += n)); }
      case 0xda: { const n = readU16(); return dec.decode(bytes.subarray(pos, pos += n)); }
      case 0xdb: { const n = readU32(); return dec.decode(bytes.subarray(pos, pos += n)); }
      case 0xdc: { const n = readU16(); const a = []; for (let i = 0; i < n; i++) a.push(go()); return a; }
      case 0xdd: { const n = readU32(); const a = []; for (let i = 0; i < n; i++) a.push(go()); return a; }
      case 0xde: { const n = readU16(); const m = {}; for (let i = 0; i < n; i++) { const k = go(); m[k] = go(); } return m; }
      case 0xdf: { const n = readU32(); const m = {}; for (let i = 0; i < n; i++) { const k = go(); m[k] = go(); } return m; }
      default: throw new Error('msgpack: unsupported byte 0x' + b.toString(16));
    }
  };
  return go();
}
