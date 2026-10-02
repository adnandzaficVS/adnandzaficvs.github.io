import { THREE, readPalette, resetMaterials, PAL, buildHuman, floorRect, M as M2 } from './models.js?v=murfpcdx';
import { OrbitControls } from 'https://esm.sh/three@0.184.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://esm.sh/three@0.184.0/examples/jsm/loaders/GLTFLoader.js';
import { Cell } from './cell.js?v=murfpcdx';
import { clusterLayout } from './layout.js?v=murfpcdx';
import { initProgram, stepCell, cellStatus, pedal } from './program.js?v=murfpcdx';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Sim {
  constructor(el3d, cv2d, onStatus) {
    this.el = el3d; this.cv = cv2d; this.onStatus = onStatus; this.playing = true; this.speed = 1; this.sel = 0; this.intr = []; this.cells = []; this.stepMode = false;
    readPalette();
    const r = this.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    el3d.appendChild(r.domElement); r.domElement.style.cssText = 'display:block;width:100%;height:100%';
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0xd9dcdf); s.fog = new THREE.Fog(0xd9dcdf, 45, 140); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    s.add(new THREE.HemisphereLight(0xf4f6ff, 0x6d6a66, 1.25));
    const d = this.sun = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(8, 14, 10); d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
    Object.assign(d.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 60 }); s.add(d, d.target);
    this.cam = new THREE.PerspectiveCamera(42, 1, 0.1, 400); this.ctl = new OrbitControls(this.cam, r.domElement); this.ctl.enableDamping = true;
    this.world = new THREE.Group(); s.add(this.world);
    new ResizeObserver(() => this.resize()).observe(el3d); new ResizeObserver(() => this.resize()).observe(cv2d.parentElement);
    cv2d.addEventListener('click', e => this.click2D(e));
    this.last = performance.now(); this.lastStat = 0; this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  async load(url) {
    const g = await new GLTFLoader().loadAsync(url); this.tpl = g.scene;
    const orange = new THREE.MeshStandardMaterial({ color: 0xe8661a, roughness: 0.42, metalness: 0.15, name: 'Orange' });
    this.tpl.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const n = (o.material && o.material.name) || ''; if (/white/i.test(n)) o.material = orange; } });
  }
  build(P) {
    this.P = P; resetMaterials(); readPalette();
    for (const c of this.cells) this.world.remove(c.g); this.world.clear(); this.cells = []; this.intr = [];
    const probe = new Cell(this.tpl, P, 0); const bb = probe.L.bbox;
    const cl = this.cl = clusterLayout(P.cell.cluster, bb, probe.L.back);
    cl.cells.forEach((t, i) => {
      const c = i === 0 ? probe : new Cell(this.tpl, P, i); c.g.position.set(t.tx, 0, t.tz); c.g.scale.set(t.sx, 1, t.sz);
      c.g.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow || false; o.receiveShadow = true; } });
      this.world.add(c.g); c.g.updateMatrixWorld(true); initProgram(c, i * P.cell.phase); c.stepMode = this.stepMode; this.cells.push(c);
    });
    // floor + aisles
    const box = new THREE.Box3(); for (const c of this.cells) { const [x0, z0, x1, z1] = c.L.bbox; for (const p of [[x0, z0], [x1, z1], [x0, z1], [x1, z0]]) box.expandByPoint(c.W(p[0], p[1])); }
    for (const a of cl.aisles) { box.expandByPoint(V(a.r[0], 0, a.r[1])); box.expandByPoint(V(a.r[2], 0, a.r[3])); this.world.add(floorRect(a.r[0], a.r[1], a.r[2], a.r[3], new THREE.MeshStandardMaterial({ color: 0xa7abae, roughness: 0.5 }), 0.002)); }
    this.box = box; const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const fsz = span + 40, ft = this.tex('floor').clone(); ft.needsUpdate = true; ft.repeat.set(fsz / 6, fsz / 6); const fl = new THREE.Mesh(new THREE.PlaneGeometry(fsz, fsz), new THREE.MeshStandardMaterial({ map: ft, color: 0xc4c7ca, roughness: 0.42, metalness: 0.05 })); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, -0.001, cz); fl.receiveShadow = true; this.world.add(fl);
    const grid = new THREE.GridHelper(Math.ceil(span + 30), Math.ceil(span + 30), PAL.n400, PAL.n300); grid.position.set(Math.round(cx), 0.001, Math.round(cz)); grid.visible = false; this.hall(P, span);
    this.sun.position.set(cx + 8, 16, cz + 10); this.sun.target.position.set(cx, 0, cz);
    if (this.sel >= this.cells.length) this.sel = 0;
    this.view(this.viewMode || 'persp');
  }
  hall(P, span) {
    const b = this.box, y = 0.004, W0 = b.min.x - 6, W1 = b.max.x + 6, Z0 = b.min.z - 6, Z1 = b.max.z + 8;
    const yel = new THREE.MeshStandardMaterial({ color: 0xe0b012, roughness: 0.55 }), wht = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.55 }), grn = new THREE.MeshStandardMaterial({ color: 0x3f8f5a, roughness: 0.6 });
    const strip = (a, c2, w, mat, dash = 0) => { const d = c2.clone().sub(a), L = d.length(); if (L < 0.01) return; const n = dash ? Math.floor(L / dash / 2) : 1;
      for (let i = 0; i < n; i++) { const l = dash || L, m = new THREE.Mesh(new THREE.PlaneGeometry(l, w), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(d.z, d.x);
        const t = dash ? (i * 2 + 0.5) * dash / L : 0.5; m.position.set(a.x + d.x * t, y, a.z + d.z * t); m.receiveShadow = true; this.world.add(m); } };
    for (const c of this.cells) { const [x0, z0, x1, z1] = c.L.bbox, p = [c.W(x0 - 0.3, z0 - 0.3), c.W(x1 + 0.3, z0 - 0.3), c.W(x1 + 0.3, z1 + 0.3), c.W(x0 - 0.3, z1 + 0.3)]; for (let i = 0; i < 4; i++) strip(p[i], p[(i + 1) % 4], 0.1, yel);
      const a = c.L.access; if (a) { const q = [c.W(a[0], a[1]), c.W(a[2], a[1]), c.W(a[2], a[3]), c.W(a[0], a[3])]; for (let i = 0; i < 4; i++) strip(q[i], q[(i + 1) % 4], 0.06, wht, 0.3); } }
    for (const a of this.cl.aisles) { const [x0, z0, x1, z1] = a.r; strip(V(x0, 0, z0 + 0.12), V(x1, 0, z0 + 0.12), 0.1, yel); strip(V(x0, 0, z1 - 0.12), V(x1, 0, z1 - 0.12), 0.1, yel); }
    // main hall aisle with walkway
    strip(V(W0 + 1, 0, Z1 - 1.2), V(W1 - 1, 0, Z1 - 1.2), 0.12, yel); strip(V(W0 + 1, 0, Z1 - 4.2), V(W1 - 1, 0, Z1 - 4.2), 0.12, yel);
    strip(V(W0 + 1, 0, Z1 - 5.0), V(W1 - 1, 0, Z1 - 5.0), 0.1, grn); strip(V(W0 + 1, 0, Z1 - 6.2), V(W1 - 1, 0, Z1 - 6.2), 0.1, grn);
    for (let x = W0 + 2; x < W1 - 2; x += 1.2) strip(V(x, 0, Z1 - 5.0), V(x, 0, Z1 - 6.2), 0.25, wht);
    // walls, columns, roof
    const H = Math.max(7, (P.cell.hall || 4.5) + 2.5);
    const wallT = this.tex('panel'), wallM = new THREE.MeshStandardMaterial({ map: wallT, color: 0xdfe2e5, roughness: 0.7, metalness: 0.15 });
    const plinthM = new THREE.MeshStandardMaterial({ map: this.tex('concrete'), color: 0xb8b8b4, roughness: 0.95 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.5, metalness: 0.5 }), winM = new THREE.MeshStandardMaterial({ color: 0xcfe0ee, emissive: 0x9fb7cc, emissiveIntensity: 0.35, roughness: 0.2 });
    const wall = (x, z, w, d, rx) => { wallT.repeat.set(Math.max(w, d) / 1.0, 1); const m = new THREE.Mesh(new THREE.BoxGeometry(w, H - 1.2, d), wallM); m.position.set(x, 1.2 + (H - 1.2) / 2, z); m.receiveShadow = true; this.world.add(m);
      const p = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 1.2, d + 0.02), plinthM); p.position.set(x, 0.6, z); this.world.add(p);
      const wn = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w - 2 : w + 0.03, 0.9, w > d ? d + 0.03 : d - 2), winM); wn.position.set(x, H - 1.4, z); this.world.add(wn); };
    wall((W0 + W1) / 2, Z0 - 0.15, W1 - W0, 0.25); wall(W0 - 0.15, (Z0 + Z1) / 2, 0.25, Z1 - Z0);
    const hb = new THREE.Shape(); hb.moveTo(-0.15, -0.2); hb.lineTo(0.15, -0.2); hb.lineTo(0.15, -0.17); hb.lineTo(0.02, -0.17); hb.lineTo(0.02, 0.17); hb.lineTo(0.15, 0.17); hb.lineTo(0.15, 0.2); hb.lineTo(-0.15, 0.2); hb.lineTo(-0.15, 0.17); hb.lineTo(-0.02, 0.17); hb.lineTo(-0.02, -0.17); hb.lineTo(-0.15, -0.17); hb.closePath();
    const colG = new THREE.ExtrudeGeometry(hb, { depth: H, bevelEnabled: false }); colG.rotateX(-Math.PI / 2);
    const cols = []; for (let x = W0 + 0.3; x <= W1 + 0.1; x += 12) cols.push([x, Z0 + 0.3]); for (let z = Z0 + 12; z < Z1; z += 12) cols.push([W0 + 0.3, z]);
    for (const [x, z] of cols) { const m = new THREE.Mesh(colG, steel); m.position.set(x, 0, z); m.castShadow = true; this.world.add(m); const ft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), plinthM); ft.position.set(x, 0.06, z); this.world.add(ft); }
    const roof = this.roof = new THREE.Group(); this.roofH = H; this.world.add(roof);
    for (let x = W0 + 0.3; x <= W1 + 0.1; x += 12) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, Z1 - Z0), steel); t.position.set(x, H - 0.3, (Z0 + Z1) / 2); roof.add(t);
      for (let z = Z0 + 3; z < Z1; z += 6) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 0.9 })); l.position.set(x + 6, H - 1.1, z); roof.add(l); } }
    for (let z = Z0 + 6; z < Z1; z += 6) { const p = new THREE.Mesh(new THREE.BoxGeometry(W1 - W0, 0.18, 0.12), steel); p.position.set((W0 + W1) / 2, H - 0.1, z); roof.add(p); }
  }
  tex(kind) {
    this._tx = this._tx || {}; if (this._tx[kind]) return this._tx[kind];
    const n = 512, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
    if (kind === 'floor') {
      g.fillStyle = '#8f9396'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 9000; i++) { const v = 120 + Math.random() * 40 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 3) + ',' + (0.08 + Math.random() * 0.12) + ')'; const r = Math.random() * 2.2; g.fillRect(Math.random() * n, Math.random() * n, r, r); }
      for (let i = 0; i < 40; i++) { const gr = g.createRadialGradient(Math.random() * n, Math.random() * n, 0, Math.random() * n, Math.random() * n, 60 + Math.random() * 120); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }
      g.strokeStyle = 'rgba(40,42,44,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, n - 2, n - 2);
    } else if (kind === 'panel') {
      g.fillStyle = '#e4e6e8'; g.fillRect(0, 0, n, n);
      for (let x = 0; x < n; x += 64) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, 0, 6, n); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 6, 0, 3, n); }
    } else {
      g.fillStyle = '#b5b5b1'; g.fillRect(0, 0, n, n); for (let i = 0; i < 6000; i++) { const v = 140 + Math.random() * 60 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.25)'; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; this._tx[kind] = t; return t;
  }
  view(m) {
    this.viewMode = m; const c = this.cells[this.sel]; if (!c) return; const L = c.L;
    const ctr = c.W(L.robot[0], L.robot[1] + 1.0, 0.8);
    if (m === 'top') { const b = this.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z); this.cam.position.set(cx, s * 1.25, cz + 0.01); this.ctl.target.set(cx, 0, cz); }
    else if (m === 'op') { const e = c.W(L.o1.out[0] + 1.9, L.o1.out[1] + 1.9, 1.75); this.cam.position.copy(e); this.ctl.target.copy(c.W(L.pres.p[0], L.pres.p[1], 1.4)); }
    else if (m === 'all') { const b = this.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z); this.cam.position.set(cx + s * 0.45, s * 0.6, cz + s * 0.85); this.ctl.target.set(cx, 0.8, cz); }
    else { this.cam.position.copy(c.W(L.robot[0] + 6.5, L.robot[1] + 9.5, 6.5)); this.ctl.target.copy(ctr); }
    this.ctl.update();
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (w && h) { this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    const p = this.cv.parentElement, dpr = Math.min(2, devicePixelRatio); this.cv.width = Math.max(1, p.clientWidth * dpr); this.cv.height = Math.max(1, p.clientHeight * dpr);
  }
  loop(now) {
    requestAnimationFrame(this.loop);
    let dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.playing && this.cells.length) {
      let sim = dt * this.speed; const h = 0.04;
      while (sim > 1e-6) { const s = Math.min(h, sim); sim -= s; this.stepIntr(s); const iw = this.intr.map(i => i.p); for (const c of this.cells) if (!c.pausedByStep) stepCell(c, s, iw); }
    }
    this.ctl.update(); if (this.roof) this.roof.visible = this.cam.position.y < this.roofH - 0.4; this.r.render(this.scene, this.cam); this.draw2D();
    if (now - this.lastStat > 150) { this.lastStat = now; this.emit(); }
  }
  emit() { if (!this.onStatus || !this.cells.length) return; this.onStatus({ playing: this.playing, speed: this.speed, sel: this.sel, n: this.cells.length, cells: this.cells.map(c => Object.assign(cellStatus(c), { staticWarn: c.staticWarn, prot: c.prot, need: c.need, crownTop: c.crownTop, paused: !!c.pausedByStep })), clusterWarn: this.cl ? this.cl.warn : [], intruders: this.intr.length }); }
  stepIntr(dt) {
    for (const i of this.intr) { if (!i.tgt) continue; const d = i.tgt.clone().sub(i.p), L = d.length(); if (L < 0.03) { i.p.copy(i.tgt); i.tgt = null; if (i.leaving) i.dead = true; } else i.p.add(d.multiplyScalar(Math.min(L, 1.4 * dt) / L)); i.m.position.copy(i.p); }
    for (const i of this.intr.filter(i => i.dead)) this.world.remove(i.m); this.intr = this.intr.filter(i => !i.dead);
  }
  addIntruder(x, z) {
    const c = this.nearestCell(x, z), out = c.W(c.L.o1.out[0] + 1.6, c.L.o1.out[1] + 2.5);
    const m = buildHuman(PAL.a900, 'Osoba'); this.world.add(m); const i = { p: out.clone(), tgt: V(x, 0, z), m, home: out.clone() }; m.position.copy(i.p); this.intr.push(i);
  }
  clearIntruders() { for (const i of this.intr) { i.tgt = i.home.clone(); i.leaving = true; } }
  nearestCell(x, z) { let b = this.cells[0], bd = 1e9; for (const c of this.cells) { const r = c.W(c.L.robot[0], c.L.robot[1]), d = Math.hypot(r.x - x, r.z - z); if (d < bd) { bd = d; b = c; } } return b; }
  map2D() {
    const b = this.box, cw = this.cv.width, ch = this.cv.height, pad = 24 * Math.min(2, devicePixelRatio);
    const k = Math.min((cw - 2 * pad) / (b.max.x - b.min.x), (ch - 2 * pad) / (b.max.z - b.min.z));
    const ox = (cw - (b.max.x - b.min.x) * k) / 2, oz = (ch - (b.max.z - b.min.z) * k) / 2;
    return { k, map: v => [ox + (v.x - b.min.x) * k, oz + (v.z - b.min.z) * k], inv: (sx, sy) => [(sx - ox) / k + b.min.x, (sy - oz) / k + b.min.z] };
  }
  draw2D() {
    const ctx = this.cv.getContext('2d'); if (!this.box) return; const { k, map } = this.map2D(), dpr = Math.min(2, devicePixelRatio);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.save(); ctx.scale(1, 1);
    const b = this.box; ctx.strokeStyle = PAL.n300; ctx.lineWidth = 0.5;
    for (let x = Math.floor(b.min.x); x <= b.max.x; x++) { const a = map(V(x, 0, b.min.z)), c = map(V(x, 0, b.max.z)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
    for (let z = Math.floor(b.min.z); z <= b.max.z; z++) { const a = map(V(b.min.x, 0, z)), c = map(V(b.max.x, 0, z)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
    ctx.font = `${11 * dpr}px Barlow, sans-serif`;
    for (const a of this.cl.aisles) { const p0 = map(V(a.r[0], 0, a.r[1])), p1 = map(V(a.r[2], 0, a.r[3])); ctx.fillStyle = PAL.n200; ctx.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]); ctx.fillStyle = PAL.n700; ctx.textAlign = 'center'; ctx.fillText(a.label, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 4); }
    ctx.scale(1, 1);
    for (const c of this.cells) { ctx.save(); c.draw2D(ctx, map, k, { safety: c.safety, windowActive: c.windowActive, coll: c.collNow }); ctx.restore(); }
    for (const i of this.intr) { const s = map(i.p); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(6, 0.3 * k), 0, 7); ctx.fillStyle = PAL.a900; ctx.fill(); ctx.fillStyle = PAL.bg; ctx.textAlign = 'center'; ctx.font = `600 ${9 * dpr}px Barlow, sans-serif`; ctx.fillText('!', s[0], s[1] + 3 * dpr); }
    const sb = map(V(b.min.x, 0, b.max.z)); ctx.fillStyle = PAL.n900; ctx.fillRect(sb[0], sb[1] + 8 * dpr, k, 3 * dpr); ctx.font = `${10 * dpr}px Barlow, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('1 m', sb[0] + k + 6, sb[1] + 12 * dpr);
    ctx.restore();
  }
  click2D(e) {
    if (!this.box) return; const r = this.cv.getBoundingClientRect(), dpr = this.cv.width / r.width; const { inv } = this.map2D();
    const [x, z] = inv((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr); this.addIntruder(x, z);
  }
  ff(sec) { const h = 0.05; for (let t = 0; t < sec; t += h) { this.stepIntr(h); for (const c of this.cells) stepCell(c, h, []); } }
  pedal(ok) { const c = this.cells[this.sel]; if (c) pedal(c, ok); }
  setStepMode(v) { this.stepMode = v; for (const c of this.cells) { c.stepMode = v; if (!v) c.pausedByStep = false; } }
  stepNext() { for (const c of this.cells) c.pausedByStep = false; this.playing = true; }
  select(i) { this.sel = i; this.view(this.viewMode); }
}
