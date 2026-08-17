// build.mjs — bundle the modular bot/client into single self-contained userscripts.
// Usage:
//   node build.mjs            -> dist/moomoo-bot.user.js
//   node build.mjs client     -> dist/moomoo-client.user.js
import { build } from 'esbuild';
import fs from 'fs';

async function bundleCore() {
  // client-core bundled WITHOUT the userscript header (it gets embedded as a blob)
  await build({
    entryPoints: ['client-core.js'],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    outfile: '.tmp-client-core.js',
    minify: false,
    legalComments: 'none',
  });
  const src = fs.readFileSync('.tmp-client-core.js', 'utf8');
  fs.unlinkSync('.tmp-client-core.js');
  return src;
}

const BOT_HEADER = `// ==UserScript==
// @name        MooMoo Bot
// @namespace   https://greasyfork.org/users/gaston1799
// @version     0.2.0
// @description MooMoo.io bot - modular, single-file (no @require)
// @match       *://*.moomoo.io/*
// @run-at      document-start
// @grant       none
// ==/UserScript==

`;

const CLIENT_HEADER = `// ==UserScript==
// @name        MooMoo Client
// @namespace   https://greasyfork.org/users/gaston1799
// @version     0.1.0
// @description MooMoo.io replacement client - blocks original bundle, no anti-cheat
// @match       *://*.moomoo.io/*
// @run-at      document-start
// @grant       none
// ==/UserScript==

`;

if (process.argv[2] === 'client') {
  const core = await bundleCore();
  const entry = fs.readFileSync('main-client.user.js', 'utf8')
    .replace(/\/\/ ==UserScript==[\s\S]*?==\/UserScript==\n\n/, '')
    .replaceAll('__MOOMOO_CLIENT_SOURCE__', JSON.stringify(core));
  fs.writeFileSync('dist/moomoo-client.user.js', CLIENT_HEADER + entry);
  const out = fs.statSync('dist/moomoo-client.user.js');
  console.log(`built dist/moomoo-client.user.js (${(out.size / 1024).toFixed(1)} KB)`);
} else {
  await build({
    entryPoints: ['bot.user.js'],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    outfile: 'dist/moomoo-bot.user.js',
    banner: { js: BOT_HEADER },
    minify: false,
    legalComments: 'none',
  });
  const out = fs.statSync('dist/moomoo-bot.user.js');
  console.log(`built dist/moomoo-bot.user.js (${(out.size / 1024).toFixed(1)} KB)`);
}

