// test-libs.mjs — verify msgpack round-trip + crypto determinism
import { encode, decode } from './lib/msgpack.js';
import { sha256, deriveCrypto, packetMac, hexToBytes, prng } from './lib/crypto.js';

let pass = 0, fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : `\n  got: ${JSON.stringify(a)}\n  want: ${JSON.stringify(b)}`));
};

// msgpack round-trips
const samples = [
  ['io-init-like', ['io-init', [12345, 999, 'a1b2c3', 1]]],
  ['ints', [0, 1, 127, 128, 255, 256, 65535, 65536, 4294967295, -1, -32, -33, -128, -32768, 100000000000]],
  ['str', ['hello', 'A'.repeat(40), 'x'.repeat(300)]],
  ['float', [1.5, -2.25, 0.1]],
  ['null/bool', [null, true, false]],
  ['bin', [new Uint8Array([1, 2, 3])]],
  ['nested', [[1, 'a', [2, 3], { k: 'v', n: 5 }], { arr: [1, 2], s: 'z' }]],
];
for (const [name, vals] of samples) {
  for (const v of vals) {
    const back = decode(encode(v));
    const want = v instanceof Uint8Array ? Array.from(v) : v;
    const got = back instanceof Uint8Array ? Array.from(back) : back;
    eq(`msgpack ${name}: ${JSON.stringify(want).slice(0, 40)}`, got, want);
  }
}

// sha256 known vector (empty string)
const emptyHash = Array.from(sha256(new Uint8Array(0))).map(x => x.toString(16).padStart(2, '0')).join('');
eq('sha256("")', emptyHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

// prng determinism
const r1 = prng(42); const r2 = prng(42);
eq('prng deterministic', [r1(), r1(), r1()], [r2(), r2(), r2()]);

// deriveCrypto deterministic + table shape
const t1 = deriveCrypto(777); const t2 = deriveCrypto(777);
eq('crypto deterministic', t1, t2);
eq('crypto has 17 c2s entries', Object.keys(t1.c2s.enc).length, 17);
eq('crypto has 36 s2c entries', Object.keys(t1.s2c.enc).length, 36);

// packetMac deterministic + length
const key = hexToBytes('aabbccddeeff00112233445566778899');
const m1 = packetMac(key, new Uint8Array([1, 2, 3]));
const m2 = packetMac(key, new Uint8Array([1, 2, 3]));
eq('packetMac deterministic', Array.from(m1), Array.from(m2));
eq('packetMac length', m1.length, 6);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
