# MooMoo Client 🐮

A replacement client for [moomoo.io](https://moomoo.io/) — a single-file userscript
that blocks the original game bundle and drives the **original game UI** with a
custom animated loading screen and a restyled dark main menu.

## What it does

- **Blocks the original bundle** at document-start (MutationObserver + `src`-setter
  hook) so the game's anti-cheat/userscript detection never runs.
- **Animated loading splash** — pure-CSS aurora background, floating cow, pulsing
  rings, shimmering progress bar, live status line (`fetching servers…`,
  `solving turnstile…`, `connecting to <server>…`).
- **Restyled main menu** — dark glass cards, glowing title, themed scrollbar,
  server `<select>` (region groups + player counts), player name, 12 skin
  swatches, sandbox link.
- **Full protocol client** — real io-init crypto (mulberry32 → Fisher-Yates
  opcode tables), HMAC-SHA256-truncated-6 packet MACs, msgpack codec, spawn
  (`M`), stats (`N`), age/XP (`T`), health (`O`), leaderboard (`G`),
  restart countdown (`Z`), ping loop.
- **Turnstile automation** — renders with `execution:'execute'` +
  `appearance:'interaction-only'` and runs `turnstile.execute()` automatically
  (no click needed in a normal browser), with the game-faithful tokenless
  fallback.
- **In-game HUD** — the original HUD (resources, age bar, leaderboard, kills)
  is fed from real protocol messages.

## Files

| file | purpose |
|---|---|
| `dist/moomoo-client.user.js` | the userscript (install in Tampermonkey) |
| `main-client.user.js` | bundle-blocker shell (injects the client) |
| `client-core.js` | client logic: splash, menu, protocol, HUD |
| `lib/*.js` | crypto, msgpack, config, servers, MooClient |
| `build.mjs` | `node build.mjs client` → dist |
| `mock-server.mjs` | local wss mock server (self-signed cert) for e2e testing |
| `moomoo-driver.mjs` | CDP Chrome driver (stealth, bundle blocking, mock mode) |
| `dump-dom.mjs` | prints the original UI's DOM hierarchy by id |
| `index.humanized.mjs` | full protocol reverse-engineering notes |

## Usage

```
node build.mjs client            # build the userscript
node mock-server.mjs 9457 2500   # local mock (optional, for testing)
node moomoo-driver.mjs --client --mock --auto   # live e2e test in CDP Chrome
node dump-dom.mjs 9251 --ids     # print the original UI DOM hierarchy
```

Install `dist/moomoo-client.user.js` in Tampermonkey, open moomoo.io — you'll get
the animated splash, the dark menu, and a working spawn flow (Turnstile
auto-passes in a real browser).

## Notes

- The original HTML/CSS/HUD is kept — only the JS bundle is replaced.
- Turnstile auto-execute needs a real browser profile; fresh headless/CDP
  profiles get Cloudflare-flagged into interactive mode (by design).
- Dev-only artifacts (self-signed certs, downloaded bundles, RE dumps) are
  gitignored.
