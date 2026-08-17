// lib/servers.js — server list fetch + auto-pick
import { API_BASE, BASE_HOST, DEFAULT_PORT, SERVERS_VERSION } from './config.js';

export async function fetchServers() {
  const r = await fetch(`${API_BASE}/servers?v=${SERVERS_VERSION}`);
  return r.json(); // [{ region, name, key, playerCapacity, playerCount, version }]
}

// wa — pick lowest ping (or fewest players); skips full servers
export function pickServer(list, { region } = {}) {
  let open = list.filter(s => s.playerCount < s.playerCapacity);
  if (!open.length) open = list;
  if (region) {
    const byRegion = open.filter(s => s.region === region);
    if (byRegion.length) open = byRegion;
  }
  const minPing = Math.min(...open.map(s => s.ping ?? Infinity));
  const best = open.filter(s => s.ping === minPing);
  const pool = best.length ? best : open;
  pool.sort((a, b) => (a.playerCount / a.playerCapacity) - (b.playerCount / b.playerCapacity));
  return pool[0];
}

export function serverAddress(s) {
  return s.region == 0 ? 'localhost' : `${s.key}.${s.region}.${BASE_HOST}`;
}

export function serverUrl(s, token) {
  const host = serverAddress(s);
  const port = s.port ?? DEFAULT_PORT;
  let url = `wss://${host}:${port}`;
  if (token) url += `?token=${encodeURIComponent(token)}`;
  return url;
}
