import * as THREE from 'https://esm.sh/three@0.184.0';

export const PAL = {};
export function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n, f) => (cs.getPropertyValue(n).trim() || f);
  Object.assign(PAL, {
    bg: g('--color-bg', '#f2f2f3'), text: g('--color-text', '#1d1f20'), accent: g('--color-accent', '#5980a6'),
    a100: g('--color-accent-100', '#eef6ff'), a200: g('--color-accent-200', '#d6ebff'), a300: g('--color-accent-300', '#b5d9fd'),
    a400: g('--color-accent-400', '#94bce3'), a500: g('--color-accent-500', '#749dc4'), a700: g('--color-accent-700', '#416180'), a900: g('--color-accent-900', '#1d2d3d'),
    n100: g('--color-neutral-100', '#f5f5f8'), n200: g('--color-neutral-200', '#e7e7ea'), n300: g('--color-neutral-300', '#d4d4d7'), n400: g('--color-neutral-400', '#b7b7ba'),
    n500: g('--color-neutral-500', '#98989b'), n600: g('--color-neutral-600', '#7a7a7d'), n700: g('--color-neutral-700', '#5d5d60'), n800: g('--color-neutral-800', '#424244'), n900: g('--color-neutral-900', '#2b2b2d'),
  });
  return PAL;
}
const MC = {};
export function M(key, color, rough = 0.6, metal = 0.1, extra = {}) {
  if (!MC[key]) MC[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  return MC[key];
}
export function resetMaterials() { for (const k in MC) delete MC[k]; }
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cylX = (r, len, m, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(-Math.PI / 2); return new THREE.Mesh(g, m); };
const cylY = (r, len, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);

// Umbrella in pole frame: X from bottom end (0) to top (L), Z = "up" at roll 0.
export class Umbrella {
  constructor(u) {
    this.u = u; const L = u.L, R = u.poleD / 2, N = u.ribs;
    this.Rr = u.D / 2 * 1.0; this.crown = L - 0.06; this.Ls = 0.5 * this.Rr;
    const g = this.group = new THREE.Group(); g.name = 'Suncobran';
    const steel = M('pole', PAL.n300, 0.35, 0.6), dark = M('dark', PAL.n800, 0.5, 0.3), rib = M('rib', PAL.n600, 0.4, 0.5);
    const pole = cylX(R, L, steel); pole.position.x = L / 2; g.add(pole);
    const cap = cylX(R * 1.25, 0.08, dark); cap.position.x = L - 0.02; g.add(cap);
    this.runner = cylX(R * 1.45, 0.12, dark); g.add(this.runner);
    this.ribs = []; this.str = [];
    for (let k = 0; k < N; k++) {
      const phi = k * 2 * Math.PI / N;
      const pv = new THREE.Group(); pv.position.x = this.crown; pv.rotation.x = phi; const arm = new THREE.Group(); pv.add(arm);
      const m = box(this.Rr, 0.014, 0.009, rib); m.position.x = this.Rr / 2; arm.add(m); g.add(pv); this.ribs.push(arm);
      const sv = new THREE.Group(); sv.rotation.x = phi; const sa = new THREE.Group(); sv.add(sa);
      const sm = box(this.Ls, 0.01, 0.007, rib); sm.position.x = this.Ls / 2; sa.add(sm); g.add(sv); this.str.push({ sv, sa });
    }
    const cg = new THREE.BufferGeometry(); this.cpos = new Float32Array(N * 2 * 9);
    cg.setAttribute('position', new THREE.BufferAttribute(this.cpos, 3));
    this.canvas = new THREE.Mesh(cg, M('canvas', PAL.accent, 0.85, 0, { side: THREE.DoubleSide }));
    this.canvas.frustumCulled = false; g.add(this.canvas);
    this.set(0, false);
  }
  set(o, canvasOn = this.canvasOn, sag = 0.12) {
    this.o = o; this.canvasOn = canvasOn;
    const th = (177 - 79 * o) * Math.PI / 180, Rr = this.Rr, cr = this.crown, N = this.u.ribs;
    const Qx = cr + 0.45 * Rr * Math.cos(th), Qr = 0.45 * Rr * Math.sin(th);
    const xr = Qx - Math.sqrt(Math.max(0, this.Ls * this.Ls - Qr * Qr));
    this.runner.position.x = xr; this.runnerX = xr;
    const ps = Math.atan2(Qr, Qx - xr);
    for (let k = 0; k < N; k++) { this.ribs[k].rotation.z = th; this.str[k].sv.position.x = xr; this.str[k].sa.rotation.z = ps; }
    this.canvas.visible = canvasOn;
    if (!canvasOn) return;
    const tip = [], C = [cr + 0.07, 0, 0];
    for (let k = 0; k < N; k++) { const f = k * 2 * Math.PI / N; tip.push([cr + Rr * Math.cos(th), Rr * Math.sin(th) * Math.cos(f), Rr * Math.sin(th) * Math.sin(f)]); }
    let i = 0; const P = this.cpos, put = v => { P[i++] = v[0]; P[i++] = v[1]; P[i++] = v[2]; };
    for (let k = 0; k < N; k++) {
      const a = tip[k], b = tip[(k + 1) % N], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const m2 = [mid[0] + (C[0] - mid[0]) * sag * 0.6, mid[1] + (C[1] - mid[1]) * sag, mid[2] + (C[2] - mid[2]) * sag];
      put(C); put(a); put(m2); put(C); put(m2); put(b);
    }
    this.canvas.geometry.attributes.position.needsUpdate = true; this.canvas.geometry.computeVertexNormals();
  }
}

// Basket local frame: +X toward the near face (pole bottom ends), Z across width, Y up.
export class Basket {
  constructor(b) {
    this.b = b; const { len: Lb, width: W, height: H, rows: R, cols: C } = b;
    this.floorY = 0.12; this.pitch = H / R;
    const g = this.group = new THREE.Group(); g.name = 'Korpa';
    const fr = M('frame', PAL.n700, 0.6, 0.4), panel = M('bpanel', PAL.n400, 0.8, 0.1, { transparent: true, opacity: 0.18 });
    const fl = box(Lb, 0.04, W, M('bfloor', PAL.n500, 0.8, 0.2)); fl.position.y = this.floorY - 0.02; g.add(fl);
    for (const x of [-Lb / 2, 0, Lb / 2]) for (const z of [-W / 2, W / 2]) { const p = box(0.05, H + 0.15, 0.05, fr); p.position.set(x, (H + 0.15) / 2, z); g.add(p); }
    for (const z of [-W / 2, W / 2]) { const r = box(Lb, 0.04, 0.04, fr); r.position.set(0, H + 0.13, z); g.add(r); const s = box(Lb, H, 0.005, panel); s.position.set(0, this.floorY + H / 2, z); g.add(s); }
    const fingerM = M('finger', PAL.a700, 0.5, 0.3);
    this.flaps = [];
    for (let r = 1; r < R; r++) {
      const pair = [];
      for (const x of [-Lb / 2 - 0.03, Lb / 2 + 0.03]) {
        const pv = new THREE.Group(); pv.position.set(x, this.floorY + r * this.pitch, -W / 2);
        const bar = box(0.03, 0.03, W, fingerM); bar.position.z = W / 2; pv.add(bar);
        for (let c = 0; c <= C; c++) { const f = box(0.02, this.pitch * 0.45, 0.02, fingerM); f.position.set(0, this.pitch * 0.225, c * W / C); pv.add(f); }
        const hinge = cylY(0.025, 0.08, M('hinge', PAL.n900)); pv.add(hinge);
        g.add(pv); pair.push(pv);
      }
      this.flaps[r] = { pair, a: 0 };
    }
    this.wall = new THREE.Group(); this.wall.position.set(-Lb / 2 - b.wallDist, 0, 0);
    const wp = box(0.04, H + 0.2, W + 0.1, M('wall', PAL.a500, 0.6, 0.2)); wp.position.y = (H + 0.2) / 2; this.wall.add(wp);
    this.wall.visible = b.wall; g.add(this.wall); this.setWall(1);
  }
  setFlap(r, a) { const f = this.flaps[r]; if (!f) return; f.a = a; for (const pv of f.pair) pv.rotation.x = -a * Math.PI / 2; }
  setWall(v) { this.wallV = v; this.wall.rotation.z = (1 - v) * Math.PI / 2; }
  rowY(r) { return this.floorY + (r + 0.5) * this.pitch; }
  colZ(c) { const W = this.b.width, C = this.b.cols; return -W / 2 + (c + 0.5) * W / C; }
}

// Gripper in flange frame (x out of flange). Returns mount info for pole-frame conversion.
export function buildGripper(gp, u) {
  const g = new THREE.Group(); g.name = 'Gripper ' + gp.type;
  const alu = M('alu', PAL.n300, 0.4, 0.6), dk = M('gdark', PAL.n800, 0.5, 0.3), ac = M('gacc', PAL.accent, 0.5, 0.3), jawM = M('jaw', PAL.n600, 0.5, 0.3);
  const R = u.poleD / 2, jaws = [];
  let x0 = 0;
  if (gp.ft && (gp.type === '2a' || gp.type === '1c')) { const ft = cylX(0.085, 0.06, ac, 28); ft.position.x = 0.03; g.add(ft); x0 = 0.06; }
  if (gp.type === '2a' || gp.type === '1b') {
    const T = gp.type === '2a' ? gp.toolLen : 0.10;
    if (gp.type === '2a') {
      const body = box(T - x0 - 0.04, 0.16, 0.16, alu); body.position.x = x0 + (T - x0 - 0.04) / 2; g.add(body);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.85, 0.08, 20), dk); cone.rotation.z = -Math.PI / 2; cone.position.x = T - 0.02; g.add(cone);
      const span = gp.clampSpacing, c1 = T + 0.08, c2 = c1 + span;
      const beam = box(c2 - x0 + 0.05, 0.05, 0.06, alu); beam.position.set(x0 + (c2 - x0 + 0.05) / 2, 0, 0.13); g.add(beam);
      for (const cx of [c1, c2]) {
        const plate = box(0.05, 0.02, 0.26, alu); plate.position.set(cx, 0.07, 0.02); g.add(plate);
        const cyl = box(0.06, 0.07, 0.06, dk); cyl.position.set(cx, 0, 0.13); g.add(cyl);
        const up = box(0.05, 0.07, 0.035, jawM), lo = box(0.05, 0.07, 0.035, jawM); up.position.x = lo.position.x = cx; g.add(up); g.add(lo);
        jaws.push({ m: up, axis: 'z', s: 1 }, { m: lo, axis: 'z', s: -1 });
      }
      g.userData = { mount: 'axial', tcp: T, jawOpen: R + 0.05, jawClosed: R + 0.0175 };
    } else {
      const chuck = cylX(0.095, 0.22, alu, 28); chuck.position.x = 0.11; g.add(chuck);
      for (let k = 0; k < 3; k++) { const pv = new THREE.Group(); pv.position.x = 0.2; pv.rotation.x = k * 2 * Math.PI / 3; const j = box(0.12, 0.02, 0.025, jawM); j.position.x = 0.0; pv.add(j); g.add(pv); jaws.push({ m: j, axis: 'y', s: 1 }); }
      const fin = box(0.3, 0.02, 0.02, dk); fin.position.set(0.25, 0, 0.12); g.add(fin);
      g.userData = { mount: 'axial', tcp: T, jawOpen: R + 0.03, jawClosed: R + 0.01 };
    }
  } else {
    const side = 0.27, span = gp.clampSpacing;
    const plate = box(0.04, 0.12, span + 0.2, alu); plate.position.x = x0 + 0.02; g.add(plate);
    for (const zc of [-span / 2, span / 2]) {
      const body = box(0.12, 0.14, 0.08, dk); body.position.set(x0 + 0.1, 0, zc); g.add(body);
      const a = box(0.09, 0.03, 0.06, jawM), b2 = box(0.09, 0.03, 0.06, jawM); a.position.set(side, 0, zc); b2.position.set(side, 0, zc); g.add(a); g.add(b2);
      jaws.push({ m: a, axis: 'y', s: 1 }, { m: b2, axis: 'y', s: -1 });
    }
    const fin = box(0.04, 0.03, 0.03, dk); fin.position.set(0.35, 0, span / 2 + 0.16); g.add(fin);
    if (gp.type === '1c') { const rd = box(0.05, 0.05, 0.05, ac); rd.position.set(0.12, 0.08, -span / 2 - 0.1); g.add(rd); }
    g.userData = { mount: 'side', side, jawOpen: R + 0.05, jawClosed: R + 0.016 };
  }
  g.userData.setClamp = v => {
    const ud = g.userData, d = ud.jawOpen + (ud.jawClosed - ud.jawOpen) * v;
    for (const j of jaws) { if (j.axis === 'z') j.m.position.z = j.s * d; else if (gp.type === '1b') j.m.position.y = d + 0.01; else j.m.position.y = j.s * d; }
  };
  g.userData.setClamp(0);
  return g;
}

export function buildHuman(color, label) {
  const g = new THREE.Group(); g.name = label;
  const m = M('hum' + color, color, 0.8, 0), skin = M('skin', PAL.n300, 0.8, 0);
  const legs = box(0.3, 0.85, 0.2, m); legs.position.y = 0.425; g.add(legs);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 12), m); body.position.y = 1.2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin); head.position.y = 1.68; g.add(head);
  return g;
}
export function buildTable(len, w, h, name) {
  const g = new THREE.Group(); g.name = name; const top = box(len, 0.04, w, M('tabletop', PAL.n200, 0.7, 0.1)); top.position.y = h; g.add(top);
  const leg = M('tleg', PAL.n700, 0.6, 0.4);
  for (const x of [-len / 2 + 0.05, len / 2 - 0.05]) for (const z of [-w / 2 + 0.05, w / 2 - 0.05]) { const l = box(0.05, h, 0.05, leg); l.position.set(x, h / 2, z); g.add(l); }
  return g;
}
export function buildFence(segs) {
  const g = new THREE.Group(); g.name = 'Ograda';
  const post = M('post', PAL.n800, 0.6, 0.4), mesh = M('fmesh', PAL.n700, 0.9, 0.1, { transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const gate = M('gate', PAL.n500, 0.9, 0.1, { transparent: true, opacity: 0.28, side: THREE.DoubleSide }), beam = M('beam', PAL.a500, 0.4, 0, { transparent: true, opacity: 0.35 });
  for (const s of segs) {
    const [x1, z1] = s.a, [x2, z2] = s.b, L = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
    const sg = new THREE.Group(); sg.position.set(x1, 0, z1); sg.rotation.y = -ang; g.add(sg);
    const H = s.t === 'curtain' ? 1.9 : 2.2;
    for (const t of [0, L]) { const p = box(0.06, H, 0.06, s.t === 'curtain' ? M('cpost', PAL.a700, 0.5, 0.3) : post); p.position.set(t, H / 2, 0); sg.add(p); }
    if (s.t === 'curtain') { for (let y = 0.3; y < 1.85; y += 0.3) { const b = box(L, 0.008, 0.008, beam); b.position.set(L / 2, y, 0); sg.add(b); } }
    else { const pn = new THREE.Mesh(new THREE.PlaneGeometry(L, H - 0.15), s.t === 'gate' ? gate : mesh); pn.position.set(L / 2, H / 2 + 0.05, 0); sg.add(pn); }
  }
  return g;
}
export function floorRect(x0, z0, x1, z1, mat, y = 0.004) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); return m;
}
export { THREE };
