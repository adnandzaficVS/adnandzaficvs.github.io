// IRB 6640-235/2.55 kinematics, matched to the GLB node offsets (y-up, arm plane XY, x forward).
export const IRB = { a1: 0.32, d1: 0.78, a2: 1.075, a3: 0.2, d4: 1.1425, d6: 0.2 };
const L3 = Math.hypot(IRB.d4, IRB.a3), GAM = Math.atan2(IRB.a3, IRB.d4);
const D2R = Math.PI / 180;
export const VMAX = [100, 90, 90, 170, 120, 190].map(v => v * D2R);

export const mul = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return C; };
export const tr = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
export const Rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const Ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const Rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const wrapNear = (x, ref) => x + 2 * Math.PI * Math.round((ref - x) / (2 * Math.PI));

// p: flange position in robot base frame, R: row-major 3x3 whose columns are flange x,y,z axes.
export function ik(p, R, prev = [0, 0, 0, 0, 0, 0]) {
  const W = [p[0] - IRB.d6 * R[0], p[1] - IRB.d6 * R[3], p[2] - IRB.d6 * R[6]];
  let t1 = Math.atan2(-W[2], W[0]);
  t1 = wrapNear(t1, prev[0]);
  if (Math.abs(t1) > Math.PI) t1 -= Math.sign(t1) * 2 * Math.PI;
  const r = Math.hypot(W[0], W[2]), h = W[1];
  const Dx = r - IRB.a1, Dy = h - IRB.d1;
  let c = (Dx * Dx + Dy * Dy - IRB.a2 * IRB.a2 - L3 * L3) / (2 * IRB.a2 * L3);
  let ok = true, why = '';
  if (c > 1 || c < -1) { ok = false; why = 'izvan dosega'; c = Math.max(-1, Math.min(1, c)); }
  const d = -Math.acos(c);
  const pa = Math.atan2(Dy, Dx) - Math.atan2(L3 * Math.sin(d), IRB.a2 + L3 * Math.cos(d));
  const al = pa - Math.PI / 2, be = pa + d - al - GAM;
  const R03 = mul(Ry(t1), Rz(al + be));
  const M = mul(tr(R03), R);
  let b = Math.acos(Math.max(-1, Math.min(1, M[0]))), a, cc;
  if (Math.abs(Math.sin(b)) < 1e-4) { a = prev[3]; cc = Math.atan2(M[7], M[4]) - a; }
  else { a = Math.atan2(M[6], M[3]); cc = Math.atan2(M[2], -M[1]); }
  const s1 = [wrapNear(a, prev[3]), b, wrapNear(cc, prev[5])];
  const s2 = [wrapNear(a + Math.PI, prev[3]), -b, wrapNear(cc + Math.PI, prev[5])];
  const cost = s => Math.abs(s[0] - prev[3]) + Math.abs(s[1] - prev[4]) + Math.abs(s[2] - prev[5]);
  const w = cost(s1) <= cost(s2) ? s1 : s2;
  const q = [t1, al, be, w[0], w[1], w[2]];
  const J = abb(q);
  if (ok) {
    if (Math.abs(J[0]) > 170) { ok = false; why = 'J1 granica'; }
    else if (J[1] < -65 || J[1] > 85) { ok = false; why = 'J2 granica'; }
    else if (J[2] < -180 || J[2] > 70) { ok = false; why = 'J3 granica'; }
    else if (Math.abs(J[4]) > 120) { ok = false; why = 'J5 granica'; }
  }
  return { q, ok, why };
}
// Joint values in ABB sign convention (degrees) for display / limit checks.
export const abb = q => [q[0], -q[1], -q[2], q[3], -q[4], q[5]].map(v => v / D2R);
export function jointTime(q0, q1, speed) {
  let t = 0; for (let i = 0; i < 6; i++) t = Math.max(t, Math.abs(q1[i] - q0[i]) / VMAX[i]);
  return t / Math.max(0.05, speed) + 0.35;
}
