import { THREE } from './models.js?v=murfpcdx';
import { ik, abb, jointTime } from './kin.js?v=murfpcdx';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = t => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
const inR = (r, p) => p.x >= r[0] && p.x <= r[2] && p.z >= r[1] && p.z <= r[3];
export const STEPS = { 2: 'Otvaranje i nabacivanje platna', 3: 'Fiksiranje platna', 4: 'Zatezanje platna', 5: 'Otvaranje · sila · vizuelna kontrola', 6: 'Zatvaranje' };
export const SHORT = { 2: 'Platno', 3: 'Fiksiranje', 4: 'Zatezanje', 5: 'Kontrola', 6: 'Zatvaranje' };
const col = (m, i) => { const e = m.elements; return V(e[i * 4], e[i * 4 + 1], e[i * 4 + 2]); };
const moved = (m, v) => m.clone().setPosition(col(m, 3).add(v));
const withY = (m, y) => { const p = col(m, 3); p.y = y; return m.clone().setPosition(p); };

export function initProgram(c, delay) {
  const { rows: R, cols: C } = c.P.basket;
  c.order = []; for (let r = R - 1; r >= 0; r--) for (let k = C - 1; k >= 0; k--) c.order.push([r, k]);
  Object.assign(c, { ops: delay > 0 ? [{ k: 'timer', dur: delay, ph: 'Čeka', label: 'Start s pomakom' }] : [], op: null, time: 0, pick: 0, clampV: 0, windowActive: false, waitingPedal: false, active: null, tableItems: [], seq: 0,
    stats: { done: 0, nok: 0, places: [], pallets: 0, nbox: 0 }, coll: new Map(), hist: [], force: { now: 0, max: 0, curve: [] }, gantt: [], lanes: {}, warn: new Set(), stopT: 0, safety: { state: 'OK', scale: 1, stopHit: false, slowHit: false } });
  c.cur = null; c.lastNok = false; c.staticWarn = staticChecks(c);
}
export function staticChecks(c) {
  const P = c.P, w = [], g = P.grip, Lb = P.basket.len, L = P.umb.L;
  const prot = P.basket.wall ? L - Lb - P.basket.wallDist : (L - Lb) / 2;
  const need = g.type === '2a' ? g.clampSpacing + 0.14 : g.type === '1b' ? 0.13 : g.gripOffset + g.clampSpacing / 2 + 0.06;
  if (P.basket.wall && L > Lb + 2 * P.basket.wallDist) w.push('Graničnik je preblizu: suncobran ' + L.toFixed(2) + ' m ne stane do zida.');
  if (prot < need) w.push('Prepust donjeg kraja ' + prot.toFixed(2) + ' m < potrebno ' + need.toFixed(2) + ' m za hvat.');
  const bundle = Math.max(0.09, P.umb.D * 0.034), cp = P.basket.width / P.basket.cols, rp = P.basket.height / P.basket.rows;
  if (cp < bundle + 0.02) w.push('Korak ćelija ' + (cp * 1000).toFixed(0) + ' mm je manji od sklopljene krošnje (≈' + (bundle * 1000).toFixed(0) + ' mm).');
  if (rp < bundle + 0.04) w.push('Visina reda ' + (rp * 1000).toFixed(0) + ' mm je premala za krošnju i klapnu.');
  const top = Math.max(1.3 + L * 0.707, P.op.vertH + L * Math.cos((P.op.vertTilt || 0) * Math.PI / 180)) + 0.1;
  if (top > P.cell.hall - 0.3) w.push('Vrh suncobrana na ' + top.toFixed(2) + ' m – blizu visine hale (' + P.cell.hall + ' m).');
  c.prot = prot; c.need = need; c.crownTop = top;
  return w;
}

function standby(c) { const s = c.P.op.standby === 'spora' ? c.L.o1.slow : c.L.o1.out; return V(s[0], 0, s[1]); }
const o1Clear = c => !inR(c.L.stop, c.o1.p) && !c.o1.tgt;

export function buildCycle(c) {
  const P = c.P, L = c.L, ops = c.ops, up = V(0, 1, 0), b = c.basket, H = P.basket.height, topY = b.floorY + H;
  if (c.pick >= c.order.length) {
    ops.push({ k: 'timer', dur: P.cell.basketChange, ph: 'Zamjena korpe', label: 'Zamjena korpe' },
      { k: 'do', fn: () => { c.fillBasket(); c.pick = 0; } });
    return;
  }
  const [r, k] = c.order[c.pick++], u = c.umb[r][k];
  const B0 = c.basketPose(r, k, false), B1 = c.basketPose(r, k, true), X = col(B0, 0), axial = c.mount.mount === 'axial';
  const attach = () => { c.g.updateMatrixWorld(true); c.flange.attach(u.group); c.active = u; c.umb[r][k] = null; c.curRC = null; };
  c.curRC = [r, k];
  const flapRow = r + 1 < P.basket.rows && b.flaps[r + 1] && b.flaps[r + 1].a < 1 ? r + 1 : null;
  const pushD = col(B1, 3).distanceTo(col(B0, 3));
  if (axial) {
    const app = moved(B0, X.clone().multiplyScalar(-0.07));
    ops.push({ k: 'J', to: withY(app, topY + 0.3), ph: 'Uzimanje', label: 'Prilaz korpi' }, { k: 'L', to: app, ph: 'Uzimanje', label: 'Spuštanje ispred čela' },
      { k: 'L', to: B0, slow: 1, ph: 'Uzimanje', label: 'Konus u cijev štapa' }, { k: 'do', fn: attach });
    if (pushD > 0.003) ops.push({ k: 'L', to: B1, slow: 1, ph: 'Uzimanje', label: 'Guranje do graničnika' });
    ops.push({ k: 'clamp', v: 1, dur: 0.5, ph: 'Uzimanje', label: 'Stezanje' });
  } else {
    ops.push({ k: 'J', to: withY(B0, topY + 0.35), ph: 'Uzimanje', label: 'Prilaz odozgo' }, { k: 'L', to: B0, slow: 1, ph: 'Uzimanje', label: 'Spuštanje na štap' },
      { k: 'clamp', v: 1, dur: 0.5, ph: 'Uzimanje', label: 'Stezanje' }, { k: 'do', fn: attach });
    if (pushD > 0.003) ops.push({ k: 'L', to: B1, slow: 1, ph: 'Uzimanje', label: 'Guranje do graničnika' });
  }
  const B = pushD > 0.003 ? B1 : B0;
  ops.push({ k: 'L', to: moved(B, up.clone().multiplyScalar(b.pitch * 0.65)), slow: 1, flapRow, ph: 'Uzimanje', label: flapRow != null ? 'Dizanje – preklapanje klapne' : 'Dizanje' },
    { k: 'L', to: withY(B, topY + 0.35), ph: 'Uzimanje', label: 'Izvlačenje iz korpe' },
    { k: 'L', to: moved(withY(B, topY + 0.35), X.clone().multiplyScalar(-(P.cell.pullOut ?? 0.9))), ph: 'Uzimanje', label: 'Izvlačenje prema naprijed' },
    { k: 'L', to: null, lazy: () => moved(c.cur, V(L.robot[0] - col(c.cur, 3).x, 0, L.robot[1] - col(c.cur, 3).z).setLength(0.3)), ph: 'Uzimanje', label: 'Odmicanje od ograde' });
  const rp = V(L.robot[0], 0, L.robot[1]), pp = V(L.pres.p[0], 0, L.pres.p[1]), s = V(L.pres.s[0], 0, L.pres.s[1]), f = V(L.pres.f[0], 0, L.pres.f[1]);
  const dirN = pp.clone().sub(rp).normalize(), tp = rp.clone().add(dirN.clone().multiplyScalar(1.8)); tp.y = 1.3;
  const tiltA = (d, deg) => up.clone().multiplyScalar(Math.cos(deg * Math.PI / 180)).add(d.clone().multiplyScalar(Math.sin(deg * Math.PI / 180)));
  const tilt = deg => tiltA(dirN, deg);
  const transit = c.frame(tp, tilt(45), f);
  const p5 = rp.clone().add(dirN.clone().multiplyScalar(P.op.vertR || 2.5)); c.spotB = p5.clone().add(f.clone().multiplyScalar(0.75)).add(V(L.pres.side[0], 0, L.pres.side[1]).multiplyScalar(0.4));
  const p2 = V(pp.x, P.op.h2, pp.z), pose = roll => c.frame(p2, s, up, roll);
  ops.push({ k: 'J', to: transit, ph: 'Prenos', label: 'Prenos – štap uspravno' },
    { k: 'waitFn', fn: () => o1Clear(c), ph: 'Čeka', label: 'Čeka da O1 napusti zonu stop' },
    { k: 'J', to: pose(0), ph: 'Prezentacija', label: 'Prezentacija – horizontalno' },
    { k: 'do', fn: () => { c.windowActive = true; } },
    { k: 'wait', step: 2, ph: 'Čeka O1', label: 'Čeka potvrdu – korak 2' },
    { k: 'L', to: pose(Math.PI / 2), ph: 'Prezentacija', label: 'Rotacija 90°' }, { k: 'wait', step: 3, ph: 'Čeka O1', label: 'Čeka potvrdu – korak 3' },
    { k: 'L', to: pose(Math.PI), ph: 'Prezentacija', label: 'Rotacija 180°' }, { k: 'wait', step: 4, ph: 'Čeka O1', label: 'Čeka potvrdu – korak 4' },
    { k: 'J', to: c.frame(V(p5.x, P.op.vertH, p5.z), tilt(P.op.vertTilt || 0), f), ph: 'Prezentacija', label: 'Vertikalno – krošnja gore' },
    { k: 'wait', step: 5, ph: 'Čeka O1', label: 'Čeka potvrdu – korak 5' }, { k: 'wait', step: 6, ph: 'Čeka O1', label: 'Čeka potvrdu – korak 6' },
    { k: 'do', fn: () => { c.o1.tgt = standby(c); } },
    { k: 'waitFn', fn: () => o1Clear(c), ph: 'Čeka', label: 'Čeka da O1 napusti zonu stop' },
    { k: 'do', fn: () => { c.windowActive = false; } });
  const T = L.table, cap = P.cell.tableCap, offs = cap === 1 ? [0] : cap === 2 ? [-0.2, 0.2] : [-0.27, 0, 0.27];
  const tn = V(-T.t[1], 0, T.t[0]); let slot = 0;
  const tpose = () => { const used = c.tableItems.map(i => i.slot); slot = offs.findIndex((_, i) => !used.includes(i)); if (slot < 0) slot = 0; return c.frame(V(T.near[0], T.h + 0.02 + P.umb.poleD / 2, T.near[1]).add(tn.clone().multiplyScalar(offs[slot])).add(V(T.t[0], 0, T.t[1]).multiplyScalar(0.05)), V(T.t[0], 0, T.t[1]), up); };
  const tableOp = { k: 'J', to: null, ph: 'Odlaganje', label: 'Iznad izlaznog stola', lazy: () => moved(tpose(), up.clone().multiplyScalar(0.35)) };
  const dirT = V(T.near[0] - L.robot[0], 0, T.near[1] - L.robot[1]).normalize(), ttp = rp.clone().add(dirT.clone().multiplyScalar(1.6)); ttp.y = 1.8;
  ops.push({ k: 'waitFn', fn: () => c.tableItems.length < cap, ph: 'Čeka', label: 'Sto pun – čeka O2' }, { k: 'J', to: transit, ph: 'Prenos', label: 'Prenos – štap uspravno' }, { k: 'J', to: c.frame(ttp, tiltA(dirT, 40), V(T.t[0], 0, T.t[1])), ph: 'Prenos', label: 'Prenos do stola – uspravno' }, tableOp,
    { k: 'L', to: null, lazy: () => tpose(), slow: 1, ph: 'Odlaganje', label: 'Spuštanje na sto' },
    { k: 'clamp', v: 0, dur: 0.45, ph: 'Odlaganje', label: 'Otpuštanje' },
    { k: 'do', fn: () => { c.g.updateMatrixWorld(true); c.g.attach(c.active.group); c.tableItems.push({ u: c.active, slot, nok: c.lastNok }); c.active = null; } });
  if (axial) ops.push({ k: 'L', to: null, lazy: () => moved(c.cur, col(c.cur, 0).multiplyScalar(-0.15)), ph: 'Odlaganje', label: 'Izvlačenje konusa' });
  ops.push({ k: 'L', to: null, lazy: () => moved(c.cur, up.clone().multiplyScalar(0.4)), ph: 'Odlaganje', label: 'Odmicanje' },
    { k: 'do', fn: () => { const st = c.stats; st.done++; if (c.lastNok) st.nok++; st.places.push(c.time); if (st.places.length > 30) st.places.shift(); } });
}

function startOp(c, op) {
  const P = c.P, sp = P.robot.speed / 100;
  op.t = 0; if (op.lazy) op.to = op.lazy();
  if (op.k === 'J') { const f = c.flangeOf(op.to), res = ik(f.p, f.R, c.q); op.q0 = c.q.slice(); op.q1 = res.q; op.dur = jointTime(op.q0, op.q1, sp); if (!res.ok) c.warn.add(op.label + ': ' + res.why); }
  else if (op.k === 'L') {
    const from = c.cur || op.to; op.p0 = V(); op.r0 = new THREE.Quaternion(); op.p1 = V(); op.r1 = new THREE.Quaternion(); const sc = V();
    from.decompose(op.p0, op.r0, sc); op.to.decompose(op.p1, op.r1, sc);
    const v = op.slow ? P.robot.approach : P.robot.lin * sp; op.dur = Math.max(0.3, op.p0.distanceTo(op.p1) / v + op.r0.angleTo(op.r1) / (1.4 * sp));
    const f = c.flangeOf(op.to), res = ik(f.p, f.R, c.q); if (!res.ok) c.warn.add(op.label + ': ' + res.why);
  } else if (op.k === 'wait') { c.waitStep = op.step; c.o1.job = { step: op.step, ph: 'walk' }; const s = op.step <= 4 ? c.L.o1.A : [c.spotB.x, c.spotB.z]; c.o1.tgt = V(s[0], 0, s[1]); }
}

export function pedal(c, ok = true) {
  const op = c.op; if (!op || op.k !== 'wait' || !c.o1.job || c.o1.job.ph !== 'done') return false;
  if (op.step === 5) { c.lastNok = !ok; const ft = c.P.grip.ft && (c.P.grip.type === '2a' || c.P.grip.type === '1c');
    c.hist.unshift({ id: 'C' + (c.idx + 1) + '-' + String(++c.seq).padStart(4, '0'), f: ft ? c.force.max : null, ok, t: c.time }); if (c.hist.length > 50) c.hist.pop(); }
  c.o1.job = null; c.waitingPedal = false; op.doneFlag = true; return true;
}

function o1Task(c, dt) {
  const o = c.o1, j = o.job, u = c.active, P = c.P; if (!j || !u) return;
  if (j.ph === 'walk' && !o.tgt) { j.ph = 'task'; j.t = 0; j.dur = P.op['t' + j.step] * (0.9 + 0.2 * Math.random()); if (j.step === 5) { c.force.max = 0; c.force.curve = []; c.fpk = P.force.mean + P.force.sd * (Math.random() + Math.random() + Math.random() - 1.5) * 1.4; } }
  if (j.ph !== 'task') return;
  j.t += dt; const g = Math.min(1, j.t / j.dur);
  const o2 = (P.op.o2 ?? 40) / 100;
  if (j.step === 2) u.set(Math.min(1, g / 0.4) * o2, g > 0.55, 0.16);
  else if (j.step === 3) u.set(o2, true, 0.12);
  else if (j.step === 4) u.set(g > 0.75 ? o2 * (1 - (g - 0.75) / 0.25) : o2, true, 0.12 - 0.08 * Math.min(1, g / 0.7));
  else if (j.step === 5) { const op = Math.min(1, g / 0.5); u.set(op, true, 0.04); const F = g < 0.5 ? c.fpk * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * Math.min(0.999, op * 0.92)), 0.8)) + (Math.random() - 0.5) * 6 : Math.max(0, c.force.now - dt * 300); c.force.now = F; c.force.max = Math.max(c.force.max, F); if (g < 0.55) c.force.curve.push(Math.round(F)); }
  else if (j.step === 6) u.set(1 - g, true, 0.04);
  if (g >= 1) { j.ph = 'done'; if (j.step === 6) c.force.now = 0;
    if (P.op.mode === 'auto') { const ok = !(j.step === 5 && (c.force.max > P.force.limit || Math.random() * 100 < P.op.nokRate)); pedal(c, ok); } else c.waitingPedal = true; }
}

function walk(o, dt, sp = 1.3) {
  if (!o.tgt) return false; const d = o.tgt.clone().sub(o.p); d.y = 0; const L = d.length();
  if (L < 0.02) { o.p.copy(o.tgt); o.tgt = null; return false; }
  const s = Math.min(L, sp * dt); o.p.add(d.multiplyScalar(s / L)); o.m.rotation.y = Math.atan2(-o.tgt.z + o.p.z, o.tgt.x - o.p.x) - Math.PI / 2; return true;
}

function o2Logic(c, dt) {
  const o = c.o2, L = c.L.o2, P = c.P; const walking = walk(o, dt, 1.2);
  if (walking) { o.lane = 'Hod'; return; }
  o.t += dt;
  if (o.st === 'idle') { o.lane = 'Čeka'; if (c.tableItems.length) { o.st = 'take'; o.t = 0; } }
  else if (o.st === 'take') { o.lane = 'Preuzimanje'; if (o.t > 4) { const it = c.tableItems.shift(); it.u.group.parent?.remove(it.u.group); o.st = 'pack'; o.t = 0; o.tgt = V(L.packSpot[0], 0, L.packSpot[1]); } }
  else if (o.st === 'pack') { o.lane = 'Pakovanje'; if (o.t > P.op.t7) { o.st = 'pal'; o.t = 0; o.tgt = V(L.palSpot[0], 0, L.palSpot[1]); } }
  else if (o.st === 'pal') { o.lane = 'Paleta'; if (o.t > 3) { addBox(c); o.st = 'back'; o.tgt = V(L.work[0], 0, L.work[1]); } }
  else if (o.st === 'back') { o.st = 'idle'; }
}
function addBox(c) {
  const st = c.stats, P = c.P; if (st.nbox >= P.cell.palletCap) { c.boxes.clear(); st.nbox = 0; st.pallets++; }
  const pl = c.L.o2.pallet, pw = pl[2] - pl[0], pd = pl[3] - pl[1], longX = pw > pd, n = Math.max(1, Math.floor((longX ? pd : pw) / 0.24)), i = st.nbox++;
  const g = longX ? new THREE.BoxGeometry(P.umb.L + 0.1, 0.22, 0.22) : new THREE.BoxGeometry(0.22, 0.22, P.umb.L + 0.1);
  const m = new THREE.Mesh(g, c.boxMat || (c.boxMat = new THREE.MeshStandardMaterial({ color: 0xc9b89a, roughness: 0.9 })));
  const y = 0.25 + Math.floor(i / n) * 0.23, a = 0.14 + (i % n) * 0.24;
  if (longX) m.position.set(pw / 2, y, a); else m.position.set(a, y, pd / 2); c.boxes.add(m);
}

export function stepCell(c, dt, intruders) {
  c.time += dt; const P = c.P, L = c.L;
  if (walk(c.o1, dt)) c.o1.lane = 'Hod'; else if (c.o1.job && c.o1.job.ph === 'task') c.o1.lane = SHORT[c.o1.job.step]; else c.o1.lane = 'Čeka';
  o1Task(c, dt); o2Logic(c, dt);
  c.o1.m.position.copy(c.o1.p); c.o2.m.position.copy(c.o2.p);
  // safety
  const ppl = [c.o1.p, ...intruders.map(w => c.g.worldToLocal(w.clone()))];
  let stopHit = false, slowHit = false;
  for (const p of ppl) { const inW = c.windowActive && inR(L.win, p); if (inR(L.stop, p) && !inW) stopHit = true; if (inR(L.slow, p) || inW) slowHit = true; }
  if (stopHit) c.stopT = 1.0; else if (c.stopT > 0) c.stopT -= dt;
  const scale = c.stopT > 0 ? 0 : (slowHit || c.windowActive) ? P.robot.slow / 100 : 1;
  c.safety = { state: c.stopT > 0 ? 'STOP' : scale < 1 ? 'SPORO' : 'OK', scale, stopHit, slowHit };
  c.zm.stop.opacity = stopHit ? 0.85 : 0.45; c.zm.slow.opacity = slowHit ? 0.75 : 0.4; c.zm.win.opacity = c.windowActive ? 0.25 : 0;
  // robot program
  const dr = dt * scale;
  for (let guard = 0; guard < 20; guard++) {
    if (!c.op) { if (!c.ops.length) buildCycle(c); c.op = c.ops.shift(); startOp(c, c.op); }
    const op = c.op; let done = false;
    if (op.k === 'do') { op.fn(); done = true; }
    else if (op.k === 'J') { op.t += dr / op.dur; const e = ease(op.t); c.setJ(op.q0.map((v, i) => v + (op.q1[i] - v) * e)); if (op.t >= 1) { c.cur = op.to; done = true; } }
    else if (op.k === 'L') { op.t += dr / op.dur; const e = ease(op.t); const p = op.p0.clone().lerp(op.p1, e), q = op.r0.clone().slerp(op.r1, e), m = new THREE.Matrix4().compose(p, q, V(1, 1, 1));
      const f = c.flangeOf(m); c.setJ(ik(f.p, f.R, c.q).q); if (op.flapRow != null) c.basket.setFlap(op.flapRow, e); if (op.t >= 1) { c.cur = op.to; done = true; } }
    else if (op.k === 'clamp') { op.t += dr / op.dur; const e = ease(op.t); c.grip.userData.setClamp(op.v ? e : 1 - e); if (op.t >= 1) done = true; }
    else if (op.k === 'wait') done = !!op.doneFlag;
    else if (op.k === 'waitFn') done = op.fn();
    else if (op.k === 'timer') { op.t += dt / op.dur; if (op.k === 'timer' && op.label === 'Zamjena korpe') c.basket.setWall(Math.min(1, Math.max(0, op.t * 4 - 3))); done = op.t >= 1; }
    if (!done) break;
    c.op = null;
    if (c.stepMode && op.k !== 'do') { c.pausedByStep = true; break; }
  }
  if ((c.collT = (c.collT || 0) + dt) > 0.1) { c.collT = 0; collide(c); }
  // gantt lanes
  const rl = c.op ? (c.op.k === 'wait' ? 'Čeka O1' : c.op.ph || 'Čeka') : 'Čeka';
  lane(c, 'Robot', scale === 0 ? 'Stop' : rl); lane(c, 'Sigurnost', c.safety.state === 'OK' ? '' : c.safety.state === 'STOP' ? 'Stop' : 'Sporo');
  lane(c, 'O1', c.o1.lane); lane(c, 'O2', c.o2.lane);
}
function lane(c, name, label) {
  const l = c.lanes[name];
  if (!l || l.label !== label) { if (l && l.label) c.gantt.push({ lane: name, label: l.label, t0: l.t0, t1: c.time }); c.lanes[name] = { label, t0: c.time }; }
  if (c.gantt.length > 800) c.gantt.splice(0, 200);
}
export function cellStatus(c) {
  const P = c.P, st = c.stats, pl = st.places, n = pl.length;
  const avg = n > 1 ? (pl[n - 1] - pl[0]) / (n - 1) : null, last = n > 1 ? pl[n - 1] - pl[n - 2] : null;
  const grid = []; for (let r = P.basket.rows - 1; r >= 0; r--) grid.push(c.umb[r].map((u, k) => ({ full: !!u, cur: c.curRC && c.curRC[0] === r && c.curRC[1] === k })));
  const open = Object.entries(c.lanes).filter(([, l]) => l.label).map(([lane, l]) => ({ lane, label: l.label, t0: l.t0, t1: c.time }));
  return { idx: c.idx, name: c.L.name, time: c.time, opLabel: c.op ? c.op.label || '' : '', ph: c.op ? c.op.ph || '' : '', waitStep: c.op && c.op.k === 'wait' ? c.op.step : null,
    jobPh: c.o1.job ? c.o1.job.ph : null, waitingPedal: c.waitingPedal, safety: c.safety, windowActive: c.windowActive, done: st.done, nok: st.nok, pallets: st.pallets, nbox: st.nbox,
    remaining: c.umb.reduce((a, r) => a + r.filter(Boolean).length, 0), grid, flaps: c.basket.flaps.map(f => f ? f.a : 0), force: { now: c.force.now, max: c.force.max, curve: c.force.curve },
    hist: c.hist.slice(0, 12), cycleLast: last, cycleAvg: avg, perHour: avg ? 3600 / avg : null, joints: abb(c.q), warn: [...c.warn], coll: [...c.coll.keys()], collNow: !!c.collNow, gantt: c.gantt.concat(open), tableN: c.tableItems.length };
}

function segDist(p, a, b) { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().add(ab.multiplyScalar(t))); }
function plan(p, f) { const a = V(f.a[0], 0, f.a[1]), b = V(f.b[0], 0, f.b[1]); return segDist(V(p.x, 0, p.z), a, b); }
function collide(c) {
  const L = c.L, u = c.active, op = c.op && c.op.label ? c.op.label : ''; c.collNow = null;
  c.robot.updateMatrixWorld(true);
  const toL = o => c.g.worldToLocal(o.getWorldPosition(V()));
  const base0 = V(L.robot[0], 0, L.robot[1]), base1 = V(L.robot[0], 0.95, L.robot[1]);
  const jp = [c.J[1], c.J[2], c.J[4], c.flange].map(toL);
  const fences = L.fences.filter(f => f.t !== 'curtain');
  const hit = (what, p) => { const k = what + (op ? ' – ' + op : ''); c.coll.set(k, (c.coll.get(k) || 0) + 1); c.collNow = p; };
  if (u) {
    const inv = c.g.matrixWorld.clone().invert(), M = inv.multiply(u.group.matrixWorld), pts = [];
    const th = (177 - 79 * u.o) * Math.PI / 180, N = u.u.ribs;
    for (let x = 0.7; x <= u.u.L + 0.01; x += 0.3) pts.push(V(x, 0, 0));
    for (let k = 0; k < N; k++) { const f = k * 2 * Math.PI / N; for (const r of [0.5, 1]) pts.push(V(u.crown + u.Rr * r * Math.cos(th), u.Rr * r * Math.sin(th) * Math.cos(f), u.Rr * r * Math.sin(th) * Math.sin(f))); }
    for (const q of pts) {
      const p = q.applyMatrix4(M);
      if (p.y < 0.03) { hit('Suncobran dodiruje pod', p); continue; }
      if (p.y < 2.2 && fences.some(f => plan(p, f) < 0.05)) { hit('Suncobran – ograda', p); continue; }
      if (segDist(p, base0, base1) < 0.5 || segDist(p, jp[0], jp[1]) < 0.22 || segDist(p, jp[1], jp[2]) < 0.18) hit('Suncobran – robot', p);
    }
  }
  for (const p of [jp[1], jp[2], jp[3], jp[1].clone().lerp(jp[2], 0.5)]) { if (p.y < 0.05) hit('Robot dodiruje pod', p); else if (p.y < 2.2 && fences.some(f => plan(p, f) < 0.2)) hit('Robot – ograda', p); }
  if (!c.collMarker) { c.collMarker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0x1d2d3d, transparent: true, opacity: 0.85 })); c.g.add(c.collMarker); }
  c.collMarker.visible = !!c.collNow; if (c.collNow) c.collMarker.position.copy(c.collNow);
}
