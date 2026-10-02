// Radial cell layouts: robot at origin, every station's pole points away from the robot
// (required by the in-line tool – otherwise J5 exceeds ±120°). Plan: x right, z toward operator.
export function cellLayout(variant, P) {
  if (variant === '2c') return cornerLayout(P);
  const C = P.cell, Ds = C.stopDepth, Dw = C.slowDepth, Lb = P.basket.len, W = P.basket.width, wd = P.basket.wall ? P.basket.wallDist : 0.25, L = P.umb.L;
  const rB = C.rB, rT = C.rT, rP = C.rP, Ff = C.front, palLen = L + 0.25;
  const xr = rT + 1.1, zEnd = Ff + Ds + Dw;
  const behind = variant === '2b';
  const xl = behind ? -2.4 : -(rB + Lb + wd + 0.45);
  const zb = behind ? -(rB + Lb + wd + 0.45) : -2.2;
  const fences = [{ a: [xr, zb], b: [xr, -0.6], t: 'fence' }, { a: [xr, -0.6], b: [xr, 0.6], t: 'curtain' }, { a: [xr, 0.6], b: [xr, Ff], t: 'fence' }, { a: [xl, zb], b: [xl, Ff], t: 'fence' }];
  if (behind) fences.push({ a: [xl, zb], b: [-0.9, zb], t: 'fence' }, { a: [-0.9, zb], b: [0.9, zb], t: 'gate' }, { a: [0.9, zb], b: [xr, zb], t: 'fence' });
  else fences.push({ a: [xl, zb], b: [xr, zb], t: 'fence' });
  const xmax = Math.max(xr + 0.5 + palLen, rT + 3.2, xr + 2.6) + 0.3;
  return {
    name: behind ? '2b · Korpa iza, sto desno' : 'Radijalni · korpa lijevo',
    robot: [0, 0], yawDir: behind ? [1, 0] : [0, 1],
    basket: behind ? { near: [0, -rB], u: [0, 1] } : { near: [-rB, 0], u: [1, 0] },
    table: { near: [rT, 0], t: [1, 0], len: 3.2, w: 0.8, h: 0.85 },
    pres: { p: [0, rP], s: [0, 1], f: [0, 1], side: [1, 0] },
    front: Ff, x0: xl, x1: xr, label: [(xl + xr) / 2, zb + 0.4],
    stop: [xl, Ff, xr, Ff + Ds], slow: [xl, Ff + Ds, xr, zEnd], win: [-1.7, Ff, 1.7, Ff + Ds],
    o1: { out: [-1.1, zEnd + 0.5], slow: [-1.1, Ff + Ds + Dw * 0.5], A: [0.85, Ff + Ds * 0.55] },
    o2: { work: [xr + 0.55, 0.95], pack: [xr + 1.4, -2.2, xr + 2.6, -1.2], packSpot: [xr + 2.0, -0.9], pallet: [xr + 0.5, 1.5, xr + 0.5 + palLen, 2.5], palSpot: [xr + 0.5 + palLen / 2, 1.2] },
    fences, scanners: [[xl, Ff], [xr, Ff]],
    access: behind ? [-0.9, zb - 1.4, 0.9, zb] : [-(rB + Lb + wd), W / 2, -rB, Ff + 1.2],
    bbox: [xl - (behind ? 0 : 0.2), behind ? zb - 1.4 : zb, xmax, zEnd + 0.9], back: behind ? 'open' : 'closed',
  };
}

// 2c – corner concept: basket in the back-left corner and the output table on the right, both parallel
// (bottom ends toward the front); robot stands forward between them so J5 stays under 120°.
function cornerLayout(P) {
  const C = P.cell, Ds = C.stopDepth, Dw = C.slowDepth, Lb = P.basket.len, W = P.basket.width, wd = P.basket.wall ? P.basket.wallDist : 0.25, L = P.umb.L, palLen = L + 0.25;
  const bx = C.bx + W / 2, nearZ = 0.25 + wd + Lb, rx = bx + C.robDx, rz = nearZ + C.robDz, tx = rx + C.tDx, tz = nearZ + C.tDz;
  const tLen = 3.2, xr = tx + 0.6, Ff = rz + C.frontC, zEnd = Ff + Ds + Dw;
  const a = C.presAngle * Math.PI / 180, s = [-Math.sin(a), Math.cos(a)], side = [Math.cos(a), Math.sin(a)];
  const pb = [rx, rz + C.rP], tip = [pb[0] + s[0] * L, pb[1] + s[1] * L];
  const wx0 = Math.max(0, Math.min(pb[0], tip[0]) - 0.6), wx1 = Math.min(xr, Math.max(pb[0], tip[0]) + 1.2);
  const t0 = Math.max(0.05, tz - tLen);
  return {
    name: '2c · Ugaoni (korpa i sto paralelno)', robot: [rx, rz], yawDir: [0, 1],
    basket: { near: [bx, nearZ], u: [0, 1] },
    table: { near: [tx, tz], t: [0, -1], len: tLen, w: 0.8, h: 0.85 },
    pres: { p: pb, s, f: [0, 1], side },
    front: Ff, x0: 0, x1: xr, label: [xr / 2, 0.4],
    stop: [0, Ff, xr, Ff + Ds], slow: [0, Ff + Ds, xr, zEnd], win: [wx0, Ff, wx1, Ff + Ds],
    o1: { out: [rx - 0.6, zEnd + 0.5], slow: [rx - 0.6, Ff + Ds + Dw * 0.5], A: [pb[0] + s[0] * 1.6 + side[0] * 0.75, pb[1] + s[1] * 1.6 + side[1] * 0.75] },
    o2: { work: [xr + 0.55, (t0 + tz) / 2], pack: [xr + 1.4, tz + 0.3, xr + 2.6, tz + 1.3], packSpot: [xr + 1.15, tz + 0.8], pallet: [xr + 1.4, 0.2, xr + 2.4, 0.2 + palLen], palSpot: [xr + 1.15, 0.2 + palLen / 2] },
    fences: [{ a: [0, 0], b: [xr, 0], t: 'fence' }, { a: [0, 0], b: [0, 0.25], t: 'fence' }, { a: [0, 0.25], b: [0, nearZ], t: 'gate' }, { a: [0, nearZ], b: [0, Ff], t: 'fence' },
      { a: [xr, 0], b: [xr, t0], t: 'fence' }, { a: [xr, t0], b: [xr, tz], t: 'curtain' }, { a: [xr, tz], b: [xr, Ff], t: 'fence' }],
    scanners: [[0, Ff], [xr, Ff]],
    access: [-1.3, 0.25 + wd, 0, nearZ],
    bbox: [-1.3, 0, xr + 2.7, zEnd + 0.9], back: 'closed',
  };
}

// Transforms {tx,tz,sx,sz} for each cell of a cluster, plus aisle rectangles (world plan coords).
export function clusterLayout(kind, bb, back) {
  const [x0, z0, x1, z1] = bb, W = x1 - x0, out = { cells: [], aisles: [], warn: [] };
  if (kind === '1') { out.cells.push({ tx: 0, tz: 0, sx: 1, sz: 1 }); return out; }
  if (kind === 'niz') {
    out.cells.push({ tx: -x0, tz: -z0, sx: 1, sz: 1 }, { tx: W + x1, tz: -z0, sx: -1, sz: 1 }, { tx: 2 * W - x0, tz: -z0, sx: 1, sz: 1 }, { tx: 3 * W + x1, tz: -z0, sx: -1, sz: 1 });
    out.aisles.push({ r: [0, z1 - z0, 4 * W, z1 - z0 + 1.5], label: 'Prednji prolaz' });
    if (back === 'open') out.aisles.push({ r: [0, -2.0, 4 * W, 0], label: 'Zadnji prolaz · dovoz korpi' });
    return out;
  }
  if (kind === '2x2') {
    const A = 2.0, H = z1 - z0, tz2 = 2 * H + A - z0;
    out.cells.push({ tx: -x0, tz: -z0, sx: 1, sz: 1 }, { tx: W + x1, tz: -z0, sx: -1, sz: 1 }, { tx: -x0, tz: 2 * H + A + z0, sx: 1, sz: -1 }, { tx: W + x1, tz: 2 * H + A + z0, sx: -1, sz: -1 });
    out.aisles.push({ r: [0, H, 2 * W, H + A], label: 'Prolaz operatera' });
    if (back === 'open') out.warn.push('Blok 2×2 s 2b: korpe se dovoze s vanjskih (gornje i donje) strana.');
    return out;
  }
  const Am = 2.5;
  out.cells.push({ tx: -x0, tz: -z0, sx: 1, sz: 1 }, { tx: -x0, tz: z0, sx: 1, sz: -1 }, { tx: W + Am + x1, tz: -z0, sx: -1, sz: 1 }, { tx: W + Am + x1, tz: z0, sx: -1, sz: -1 });
  out.aisles.push({ r: [W, -(z1 - z0), W + Am, z1 - z0], label: 'Odvoz paleta' });
  if (back === 'open') out.warn.push('Leđa uz leđa nije izvodljivo s 2b (korpa se puni sa zadnje strane) – koristite 2c.');
  return out;
}
