// lib/render.js — canvas renderer for the replacement client.
// Draws entities decoded from the 'a'/'D' protocol onto the ORIGINAL
// #gameCanvas, camera-following the player, plus the minimap (#mapDisplay).
export function makeRenderer(canvas, mapCanvas) {
  const ctx = canvas.getContext('2d');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;
  const state = {
    player: null,      // my entity
    entities: new Map(), // id -> entity
    bySid: new Map(),    // sid -> entity (for updates)
    zoom: 1.6,
    mapW: 4000, mapH: 4000,
  };

  function resize() {
    canvas.width = window.innerWidth || 1920;
    canvas.height = window.innerHeight || 1080;
  }
  window.addEventListener('resize', resize);
  resize();

  function addEntity(e, isPlayer) {
    state.entities.set(e.id, e);
    state.bySid.set(e.sid, e);
    if (isPlayer) state.player = e;
  }
  function removeEntity(id) {
    const e = state.entities.get(id);
    if (e) { state.bySid.delete(e.sid); state.entities.delete(id); }
    if (state.player && state.player.id === id) state.player = null;
  }
  function updateFromFlat(flat, t) {
    // [sid, x, y, dir, buildIndex, weaponIndex, weaponVariant, team, isLeader, skinIndex, tailIndex, iconIndex, zIndex]
    const e = state.bySid.get(flat[0]);
    if (!e) return;
    e.x2 = flat[1]; e.y2 = flat[2]; e.d2 = flat[3];
    if (e.t2 === undefined) { e.t1 = t; }
    e.t2 = t;
    e.buildIndex = flat[4]; e.weaponIndex = flat[5]; e.weaponVariant = flat[6];
    e.team = flat[7]; e.isLeader = flat[8]; e.skinIndex = flat[9];
    e.tailIndex = flat[10]; e.iconIndex = flat[11]; e.zIndex = flat[12];
    e.visible = true;
    // interpolate old pos -> new pos
    e.px = e.x; e.py = e.y;
    e.x = flat[1]; e.y = flat[2]; e.dir = flat[3];
  }

  function draw() {
    ctx.fillStyle = '#22301f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const p = state.player;
    const zoom = state.zoom;
    let camX = p ? p.x : state.mapW / 2;
    let camY = p ? p.y : state.mapH / 2;
    const cx = canvas.width / 2 - camX * zoom;
    const cy = canvas.height / 2 - camY * zoom;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const step = 200;
    for (let gx = 0; gx <= state.mapW; gx += step) {
      const sx = gx * zoom + cx;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
    }
    for (let gy = 0; gy <= state.mapH; gy += step) {
      const sy = gy * zoom + cy;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke();
    }
    // map border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(camX * zoom + cx, camY * zoom + cy, state.mapW * zoom, state.mapH * zoom);

    // entities
    for (const e of state.entities.values()) {
      if (!e.visible && e !== p) continue;
      const x = e.x * zoom + cx;
      const y = e.y * zoom + cy;
      if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) continue;
      const r = Math.max(3, (e.scale || 10) * zoom);
      const isMe = e === p;
      ctx.fillStyle = isMe ? '#4ade80' : (e.skinColor ? '#e2e8f0' : '#8b5a2b');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isMe ? '#22d3ee' : 'rgba(0,0,0,0.4)';
      ctx.lineWidth = isMe ? 2 : 1;
      ctx.stroke();
      // health bar
      if (e.maxHealth && e.health < e.maxHealth) {
        const bw = r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - bw / 2, y - r - 8, bw, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - bw / 2, y - r - 8, bw * Math.max(0, e.health / e.maxHealth), 4);
      }
      // name
      if (e.name && e.name.length > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(e.name, x, y - r - 12);
      }
    }
    // minimap
    if (mapCtx) drawMap(mapCtx, p);
  }

  function drawMap(mc, p) {
    const mw = mc.canvas.width, mh = mc.canvas.height;
    mc.fillStyle = '#111';
    mc.fillRect(0, 0, mw, mh);
    const kx = mw / state.mapW, ky = mh / state.mapH;
    for (const e of state.entities.values()) {
      if (!e.visible) continue;
      mc.fillStyle = e === p ? '#fff' : '#4ade80';
      mc.fillRect(e.x * kx - 1, e.y * ky - 1, 2, 2);
    }
    if (p) {
      mc.fillStyle = '#fff';
      mc.fillRect(p.x * kx - 2, p.y * ky - 2, 4, 4);
    }
    mc.strokeStyle = 'rgba(255,255,255,0.3)';
    mc.strokeRect(0, 0, mw, mh);
  }

  return {
    state,
    addEntity, removeEntity, updateFromFlat,
    setPlayer(p) { state.player = p; },
    loop() { draw(); requestAnimationFrame(() => this.loop()); },
    draw,
  };
}
