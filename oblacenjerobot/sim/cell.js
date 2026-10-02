import { THREE, Umbrella, Basket, buildGripper, buildHuman, buildTable, buildFence, floorRect, M, PAL } from './models.js?v=murfpcdx';
import { cellLayout } from './layout.js?v=murfpcdx';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Cell {
  constructor(tpl, P, idx) {
    this.P = P; this.idx = idx; const L = this.L = cellLayout(P.cell.variant, P);
    const g = this.g = new THREE.Group(); g.name = 'Ćelija ' + (idx + 1);
    this.zm = {
      stop: new THREE.MeshBasicMaterial({ color: PAL.a300, transparent: true, opacity: 0.45, depthWrite: false }),
      slow: new THREE.MeshBasicMaterial({ color: PAL.a200, transparent: true, opacity: 0.4, depthWrite: false }),
      win: new THREE.MeshBasicMaterial({ color: PAL.a700, transparent: true, opacity: 0.0, depthWrite: false }),
    };
    g.add(floorRect(...L.stop, this.zm.stop), floorRect(...L.slow, this.zm.slow), floorRect(...L.win, this.zm.win, 0.006));
    g.add(buildFence(L.fences));
    for (const s of L.scanners) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 16), M('scan', PAL.a900, 0.4, 0.3)); sc.position.set(s[0], 0.1, s[1]); g.add(sc); }
    // table
    const T = L.table, tc = [T.near[0] + T.t[0] * T.len / 2, T.near[1] + T.t[1] * T.len / 2];
    const tb = buildTable(T.len, T.w, T.h, 'Izlazni sto'); tb.position.set(tc[0], 0, tc[1]); tb.rotation.y = Math.atan2(-T.t[1], T.t[0]); g.add(tb);
    const pl = L.o2.pallet; this.pal = new THREE.Group(); this.pal.position.set(pl[0], 0, pl[1]); g.add(this.pal);
    const wood = M('wood', PAL.n500, 0.9, 0); const pw = pl[2] - pl[0], pd = pl[3] - pl[1];
    const base = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.14, pd), wood); base.position.set(pw / 2, 0.07, pd / 2); this.pal.add(base);
    for (const [x, z] of [[0, 0], [pw, 0], [0, pd], [pw, pd], [0, pd / 2], [pw, pd / 2]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), wood); p.position.set(x, 0.62, z); this.pal.add(p); }
    this.boxes = new THREE.Group(); this.pal.add(this.boxes);
    // robot
    this.robot = tpl.clone(true); this.robot.position.set(L.robot[0], 0, L.robot[1]); this.yaw = Math.atan2(-L.yawDir[1], L.yawDir[0]); this.robot.rotation.y = this.yaw; g.add(this.robot);
    const n = k => this.robot.getObjectByName(k);
    this.J = ['Axis1', 'Axis2', 'Axis3', 'Axis4', 'Axis5', 'Axis6'].map(n); this.cyl = n('BalanceCylinder'); this.pis = n('BalancePiston');
    this.flange = new THREE.Group(); this.flange.position.x = 0.2; this.J[5].add(this.flange);
    this.grip = buildGripper(P.grip, P.umb); this.flange.add(this.grip); this.mount = this.grip.userData;
    // basket
    const B = L.basket, b = this.basket = new Basket(P.basket);
    b.group.position.set(B.near[0] - B.u[0] * P.basket.len / 2, 0, B.near[1] - B.u[1] * P.basket.len / 2);
    b.group.rotation.y = Math.atan2(-B.u[1], B.u[0]); g.add(b.group); b.group.updateMatrix();
    this.fillBasket();
    // operators
    this.o1 = { m: buildHuman(PAL.n700, 'O1'), p: V(L.o1.out[0], 0, L.o1.out[1]), tgt: null, task: null, lane: 'Čeka' };
    this.o2 = { m: buildHuman(PAL.n600, 'O2'), p: V(L.o2.work[0], 0, L.o2.work[1]), tgt: null, st: 'idle', t: 0, lane: 'Čeka' };
    g.add(this.o1.m, this.o2.m);
    this.q = [0, 0, 0, 0, 0.6, 0]; this.setJ(this.q);
  }
  fillBasket() {
    const { rows: R, cols: C } = this.P.basket;
    if (this.umb) for (const row of this.umb) for (const u of row) if (u) u.group.parent?.remove(u.group);
    this.umb = [];
    for (let r = 0; r < R; r++) { this.umb[r] = []; for (let c = 0; c < C; c++) { const u = new Umbrella(this.P.umb); this.place(u, this.localBasket(r, c, false)); this.basket.group.add(u.group); this.umb[r][c] = u; } }
    for (let r = 1; r < R; r++) this.basket.setFlap(r, 0);
  }
  place(u, m) { m.decompose(u.group.position, u.group.quaternion, u.group.scale); }
  frame(p, X, Zr, roll = 0) {
    X = X.clone().normalize(); let Z = Zr.clone().sub(X.clone().multiplyScalar(Zr.dot(X))).normalize();
    let Y = Z.clone().cross(X); if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const Y2 = Y.clone().multiplyScalar(c).add(Z.clone().multiplyScalar(s)); Z = Z.clone().multiplyScalar(c).sub(Y.clone().multiplyScalar(s)); Y = Y2; }
    return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
  }
  localBasket(r, c, pushed) {
    const P = this.P, Lb = P.basket.len, wd = P.basket.wall ? P.basket.wallDist : 0;
    const bx = pushed && P.basket.wall ? -(Lb / 2 + wd) + P.umb.L : P.umb.L / 2;
    return this.frame(V(bx, this.basket.rowY(r), this.basket.colZ(c)), V(-1, 0, 0), V(0, 1, 0));
  }
  basketPose(r, c, pushed) { return this.basket.group.matrix.clone().multiply(this.localBasket(r, c, pushed)); }
  flangeOf(m) {
    const e = m.elements, X = V(e[0], e[1], e[2]), Y = V(e[4], e[5], e[6]), Z = V(e[8], e[9], e[10]), p = V(e[12], e[13], e[14]);
    let fp, c0, c1, c2; const mt = this.mount;
    if (mt.mount === 'axial') { fp = p.clone().sub(X.clone().multiplyScalar(mt.tcp)); c0 = X; c1 = Y; c2 = Z; }
    else { fp = p.clone().add(X.clone().multiplyScalar(this.P.grip.gripOffset)).add(Z.clone().multiplyScalar(mt.side)); c0 = Z.clone().negate(); c1 = Y; c2 = X; }
    const cy = Math.cos(-this.yaw), sy = Math.sin(-this.yaw), rot = v => [v.x * cy + v.z * sy, v.y, -v.x * sy + v.z * cy];
    const d = fp.clone().sub(V(this.L.robot[0], 0, this.L.robot[1])), pr = rot(d), a = rot(c0), b = rot(c1), cc = rot(c2);
    return { p: pr, R: [a[0], b[0], cc[0], a[1], b[1], cc[1], a[2], b[2], cc[2]] };
  }
  setJ(q) {
    this.q = q; const J = this.J; J[0].rotation.y = q[0]; J[1].rotation.z = q[1]; J[2].rotation.z = q[2]; J[3].rotation.x = q[3]; J[4].rotation.z = q[4]; J[5].rotation.x = q[5];
    if (this.cyl && this.pis) {
      const c = Math.cos(q[1]), s = Math.sin(q[1]), px = 0.32 + c * -0.2172 - s * -0.0682, py = 0.78 + s * -0.2172 + c * -0.0682;
      this.cyl.rotation.z = Math.atan2(py - 0.6307, px + 0.372) - Math.atan2(0.0811, 0.4748);
      const dx = -0.692, dy = -0.1493, cx = c * dx + s * dy, cy = -s * dx + c * dy;
      this.pis.rotation.z = Math.atan2(cy + 0.0682, cx + 0.2172) - Math.atan2(-0.0811, -0.4748);
    }
  }
  W(x, z, y = 0) { return this.g.localToWorld(V(x, y, z)); }
  draw2D(ctx, map, k, st) {
    const L = this.L, P = this.P, W = (x, z) => map(this.W(x, z));
    const poly = (pts, fill, stroke, lw = 1, dash) => { ctx.beginPath(); pts.forEach((p, i) => { const s = W(p[0], p[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.setLineDash(dash || []); ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); ctx.setLineDash([]); } };
    const rect = (r, f, s, lw, d) => poly([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], f, s, lw, d);
    const sf = st.safety;
    rect(L.slow, sf.slowHit ? PAL.a400 : PAL.a100, PAL.a500, 1, [4, 3]);
    rect(L.stop, sf.stopHit ? PAL.a900 : PAL.a300, null);
    if (st.windowActive) rect(L.win, null, PAL.a900, 2, [5, 3]);
    rect(L.access, null, PAL.n500, 1, [3, 3]);
    for (const f of L.fences) { const a = W(...f.a), b = W(...f.b); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = f.t === 'fence' ? 3 : 2; ctx.strokeStyle = f.t === 'curtain' ? PAL.a700 : f.t === 'gate' ? PAL.n500 : PAL.n900; ctx.setLineDash(f.t === 'fence' ? [] : [6, 4]); ctx.stroke(); ctx.setLineDash([]); }
    const T = L.table, tn = [-T.t[1], T.t[0]], tf = [T.near[0] + T.t[0] * T.len, T.near[1] + T.t[1] * T.len];
    poly([[T.near[0] + tn[0] * T.w / 2, T.near[1] + tn[1] * T.w / 2], [tf[0] + tn[0] * T.w / 2, tf[1] + tn[1] * T.w / 2], [tf[0] - tn[0] * T.w / 2, tf[1] - tn[1] * T.w / 2], [T.near[0] - tn[0] * T.w / 2, T.near[1] - tn[1] * T.w / 2]], PAL.n200, PAL.n700);
    rect(L.o2.pallet, null, PAL.n700, 1, [4, 3]);
    // basket
    const bm = this.basket.group.matrix, Lb = P.basket.len, Wd = P.basket.width;
    const bp = (x, z) => { const v = V(x, 0, z).applyMatrix4(bm); return [v.x, v.z]; };
    poly([bp(-Lb / 2, -Wd / 2), bp(Lb / 2, -Wd / 2), bp(Lb / 2, Wd / 2), bp(-Lb / 2, Wd / 2)], PAL.n300, PAL.n800, 1.5);
    const nearA = bp(Lb / 2, -Wd / 2), nearB = bp(Lb / 2, Wd / 2); poly([nearA, nearB], null, PAL.a700, 3);
    if (P.basket.wall) { const wd = P.basket.wallDist; poly([bp(-Lb / 2 - wd, -Wd / 2 - 0.05), bp(-Lb / 2 - wd, Wd / 2 + 0.05)], null, PAL.a500, 3); }
    // reach
    const rc = W(L.robot[0], L.robot[1]); ctx.beginPath(); ctx.arc(rc[0], rc[1], 2.55 * k, 0, 7); ctx.setLineDash([5, 4]); ctx.strokeStyle = PAL.accent; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    // umbrellas on table / held
    const drawUmb = u => { if (!u) return; const a = map(u.group.localToWorld(V(0, 0, 0))), b = map(u.group.localToWorld(V(u.u.L, 0, 0))); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = PAL.n900; ctx.lineWidth = 2; ctx.stroke(); if (u.canvasOn || u.o > 0.05) { const c = map(u.group.localToWorld(V(u.crown, 0, 0))); ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(3, u.Rr * Math.sin((177 - 79 * u.o) * Math.PI / 180) * k), 0, 7); ctx.fillStyle = u.canvasOn ? PAL.accent + '55' : 'transparent'; ctx.fill(); ctx.strokeStyle = PAL.a700; ctx.lineWidth = 1; ctx.stroke(); } };
    for (const it of this.tableItems || []) drawUmb(it.u); drawUmb(this.active);
    // robot arm
    const pts = [this.robot, ...this.J.slice(1, 5), this.flange].map(o => map(o.getWorldPosition(V())));
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 0.45 * k, 0, 7); ctx.fillStyle = PAL.accent; ctx.fill();
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = PAL.a900; ctx.lineWidth = Math.max(3, 0.18 * k); ctx.lineCap = 'round'; ctx.stroke();
    // people
    for (const [o, lab] of [[this.o1, 'O1'], [this.o2, 'O2']]) { const s = map(this.g.localToWorld(o.p.clone())); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(5, 0.28 * k), 0, 7); ctx.fillStyle = PAL.bg; ctx.fill(); ctx.strokeStyle = PAL.n900; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = PAL.n900; ctx.font = '600 10px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, s[0], s[1] + 3.5); }
    if (st.coll) { const s = map(this.g.localToWorld(st.coll.clone())); ctx.beginPath(); ctx.arc(s[0], s[1], 10, 0, 7); ctx.strokeStyle = PAL.a900; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = PAL.a900; ctx.font = '700 11px Barlow, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('kolizija', s[0] + 13, s[1] + 4); }
    const lab = W(L.label[0], L.label[1]); ctx.fillStyle = PAL.a900; ctx.font = '600 13px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Ćelija ' + (this.idx + 1), lab[0], lab[1]);
  }
}
