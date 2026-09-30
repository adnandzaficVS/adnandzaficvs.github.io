(function () {
  if (customElements.get('umbrella-view')) return;
  const URL3 = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  let p3;
  const load3 = () => p3 || (p3 = import(URL3));
  const ATTRS = ['shape', 'size', 'canopy', 'frame', 'vent', 'look', 'brandtext', 'brandimg', 'base', 'mech', 'autorotate', 'cam', 'zoom', 'env', 'person', 'furniture', 'focus', 'dims', 'wlabel', 'hlabel', 'nudge'];

  const lum = (hex) => {
    const h = (hex || '#000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  class UmbrellaView extends HTMLElement {
    static get observedAttributes() { return ATTRS; }
    constructor() { super(); this._p = {}; }
    connectedCallback() {
      if (this._c) return;
      this.style.display = 'block';
      this.style.position = this.style.position || 'relative';
      if (!this.style.width) this.style.width = '100%';
      if (!this.style.height) this.style.height = '100%';
      const c = document.createElement('canvas');
      Object.assign(c.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y', cursor: 'grab', outline: 'none' });
      this.appendChild(c);
      this._c = c;
      this._alive = true;
      load3().then((T) => { if (!this._alive) return; this.T = T; this._setup(); this._build(); }).catch((e) => console.warn('3D prikaz nije učitan', e));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this._q());
    }
    disconnectedCallback() {
      this._alive = false;
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._r) { this._clear(); this._r.dispose(); }
      if (this._c) this._c.remove();
      this._c = null; this._r = null; this.T = null;
    }
    attributeChangedCallback(n) {
      if (n === 'nudge') {
        const o = this._o, v = String(this._g('nudge', '')); if (!o || !v) return;
        const d = v.endsWith('L') ? 1 : -1; o.tAz = (o.tAz !== undefined ? o.tAz : o.az) + d * Math.PI / 4; o.last = performance.now(); return;
      }
      if (n === 'cam' || n === 'zoom' || n === 'focus') { this._camPreset(); return; }
      if ((n === 'env' || n === 'person' || n === 'furniture' || n === 'dims' || n === 'wlabel' || n === 'hlabel') && this._r && this._dims) { this._dims = Object.assign({}, this._dims, { R: this._R0 * 1.05 + 0.25 }); this._envBuild(); this._fit(); return; }
      this._q();
    }
    _camPreset() {
      const o = this._o; if (!o) return;
      const c = String(this._g('cam', 'front')).trim();
      const fp = this._focusPt();
      const P = fp ? [fp[5], fp[4]] : { front: [0.7, 0.3], top: [0.7, 1.22], low: [0.9, -0.04], side: [1.57, 0.12] }[c] || [0.7, 0.3];
      o.tAz = o.az + Math.atan2(Math.sin(P[0] - o.az), Math.cos(P[0] - o.az)); o.tEl = P[1]; o.last = performance.now();
      this._fit();
    }
    _g(n, d) {
      const v = this._p[n] !== undefined ? this._p[n] : this.getAttribute(n);
      return v === null || v === undefined || v === '' ? d : v;
    }
    _q() {
      if (!this._r || this._pending) return;
      this._pending = true;
      requestAnimationFrame(() => { this._pending = false; if (this._r) this._build(); });
    }

    _setup() {
      const T = this.T, c = this._c;
      const r = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      r.outputColorSpace = T.SRGBColorSpace;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      this._r = r;
      const s = new T.Scene();
      this._s = s;
      this._cam = new T.PerspectiveCamera(30, 1, 0.05, 100);
      s.add(new T.HemisphereLight(0xffffff, 0xd4cbbb, 1.5));
      const d = new T.DirectionalLight(0xfff4e4, 2.3);
      d.position.set(3.5, 9, 4.5);
      d.castShadow = true;
      d.shadow.mapSize.set(2048, 2048);
      Object.assign(d.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
      d.shadow.bias = -0.0004;
      d.shadow.radius = 5;
      s.add(d);
      const f = new T.DirectionalLight(0xdfe7ff, 0.8);
      f.position.set(-6, 2.5, -5);
      s.add(f);
      const disc = new T.Mesh(new T.CircleGeometry(1, 96), new T.ShadowMaterial({ name: 'sjena', opacity: 0.16, color: 0x0b1a33 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = -0.002;
      disc.receiveShadow = true;
      this._disc = disc;
      s.add(disc);

      this._o = { az: 0.7, el: 0.3, dist: 9, tDist: 9, ty: 1.3, tTy: 1.3, drag: false, last: 0 };
      c.addEventListener('pointerdown', (e) => {
        const o = this._o; o.drag = true; o.tAz = undefined; o.tEl = undefined; o.px = e.clientX; o.py = e.clientY; o.last = performance.now();
        c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing';
      });
      c.addEventListener('pointermove', (e) => {
        const o = this._o; if (!o.drag) return;
        o.az -= (e.clientX - o.px) * 0.008;
        o.el = Math.max(-0.08, Math.min(1.3, o.el + (e.clientY - o.py) * 0.006));
        o.px = e.clientX; o.py = e.clientY; o.last = performance.now();
      });
      const up = () => { this._o.drag = false; c.style.cursor = 'grab'; this._o.last = performance.now(); };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('dblclick', () => { this._o.az = 0.7; this._o.el = 0.3; });
      c.addEventListener('wheel', (e) => { e.preventDefault(); const now = performance.now(); if (now - (this._wt || 0) < 110 || Math.abs(e.deltaY) < 2) return; this._wt = now; this.dispatchEvent(new CustomEvent('wheelzoom', { detail: e.deltaY })); }, { passive: false });
      this._ro = new ResizeObserver(() => this._size());
      this._ro.observe(this);
      this._size();
      this._camPreset();
      const loop = () => { if (!this._alive) return; this._raf = requestAnimationFrame(loop); this._tick(); };
      loop();
    }
    _size() {
      if (!this._r) return;
      const w = this.clientWidth || 600, h = this.clientHeight || 400;
      this._r.setSize(w, h, false);
      this._cam.aspect = w / h;
      this._cam.updateProjectionMatrix();
      this._fit();
    }
    _focusPt() {
      const f = String(this._g('focus', 'none')).trim();
      return this._pts && this._pts[f];
    }
    _fit() {
      if (!this._dims) return;
      const fp = this._focusPt();
      if (fp) { this._o.tTx = fp[0]; this._o.tTy = fp[1]; this._o.tTz = fp[2]; this._o.tDist = fp[3]; return; }
      this._o.tTx = 0; this._o.tTz = 0;
      const { R, H } = this._dims;
      const rs = Math.sqrt(R * R + (H / 2) * (H / 2)) * 1.02;
      const v = (this._cam.fov * Math.PI) / 360;
      const hz = Math.atan(Math.tan(v) * this._cam.aspect);
      const zm = Math.max(0.55, Math.min(1.6, +this._g('zoom', '1') || 1));
      this._o.tDist = (rs / Math.sin(Math.min(v, hz))) / zm;
      this._o.tTy = H * 0.5;
    }
    _tick() {
      const o = this._o;
      const ar = String(this._g('autorotate', 'true')) !== 'false' && !this._focusPt();
      o.tx = (o.tx || 0) + ((o.tTx || 0) - (o.tx || 0)) * 0.1; o.tz = (o.tz || 0) + ((o.tTz || 0) - (o.tz || 0)) * 0.1;
      if (ar && !o.drag && performance.now() - o.last > 2500) o.az += 0.0022;
      if (o.tAz !== undefined && !o.drag) { o.az += (o.tAz - o.az) * 0.08; if (Math.abs(o.tAz - o.az) < 0.002) o.tAz = undefined; }
      if (o.tEl !== undefined && !o.drag) { o.el += (o.tEl - o.el) * 0.08; if (Math.abs(o.tEl - o.el) < 0.002) o.tEl = undefined; }
      o.dist += (o.tDist - o.dist) * 0.1;
      o.ty += (o.tTy - o.ty) * 0.1;
      const cam = this._cam, ce = Math.cos(o.el);
      cam.position.set(o.tx + Math.sin(o.az) * ce * o.dist, o.ty + Math.sin(o.el) * o.dist, o.tz + Math.cos(o.az) * ce * o.dist);
      cam.lookAt(o.tx, o.ty, o.tz);
      if (this._bd) this._bd.rotation.y = o.az;
      if (Math.abs((this._lastAz || 0) - o.az) > 0.004 || Math.abs((this._lastEl || 0) - o.el) > 0.004) {
        this._lastAz = o.az; this._lastEl = o.el;
        this.dispatchEvent(new CustomEvent('orbit', { detail: { az: o.az, el: o.el } }));
      }
      this._r.render(this._s, cam);
    }
    _envBuild() {
      const T = this.T, s = this._s;
      if (this._eg) {
        s.remove(this._eg);
        this._eg.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
      }
      const env = String(this._g('env', 'studio')), R = this._R0 || 1.5;
      const eg = new T.Group(); eg.name = 'okruzenje'; this._eg = eg; s.add(eg);
      const bd = new T.Group(); bd.name = 'pozadina'; this._bd = bd; eg.add(bd);
      this._disc.visible = env === 'studio';
      const SKY = { terrace: 0xe8edf2, garden: 0xdde8f0, beach: 0xcde2f1 };
      if (env === 'studio') { s.background = null; s.fog = null; }
      else { s.background = new T.Color(SKY[env] || 0xe8edf2); s.fog = new T.Fog(SKY[env] || 0xe8edf2, 12, 34); }
      const rnd = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
      const tex = (draw, rep) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 512; draw(cv.getContext('2d'));
        const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t;
      };
      const noise = (c, base, n, amp) => { c.fillStyle = base; c.fillRect(0, 0, 512, 512); for (let i = 0; i < n; i++) { const v = rnd(); c.fillStyle = 'rgba(' + (v > 0.5 ? '255,255,255,' : '0,0,0,') + (amp * rnd()).toFixed(3) + ')'; c.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3); } };
      const M = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
      const box = (w, h, d, mat, x, y, z, par) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (par || eg).add(m); return m; };
      const cyl = (r1, r2, h, mat, x, y, z, par, seg) => { const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 24), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (par || eg).add(m); return m; };
      if (env !== 'studio') {
        let map;
        if (env === 'terrace') map = tex((c) => { c.fillStyle = '#b9b0a2'; c.fillRect(0, 0, 512, 512); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 196 + (rnd() * 26) | 0; c.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 16) + ')'; c.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); } }, 30);
        else if (env === 'garden') map = tex((c) => noise(c, '#6f9a4e', 9000, 0.22), 40);
        else map = tex((c) => noise(c, '#e6d5b3', 9000, 0.12), 40);
        const g = new T.Mesh(new T.PlaneGeometry(60, 60), M({ name: 'tlo', map, roughness: 1 }));
        g.rotation.x = -Math.PI / 2; g.receiveShadow = true; eg.add(g);
        const back = R + 2.6;
        if (env === 'terrace') {
          const wm = M({ name: 'zid', color: 0xf0eadf }), gl = M({ name: 'staklo', color: 0x3b4a5a, roughness: 0.2, metalness: 0.3 }), fr = M({ name: 'okvir', color: 0x2a2e33, roughness: 0.5 });
          box(16, 3.6, 0.3, wm, 0, 1.8, -back, bd);
          [-3.2, 0, 3.2].forEach((x) => { box(1.6, 2.3, 0.06, fr, x, 1.25, -back + 0.16, bd); box(1.44, 2.14, 0.07, gl, x, 1.25, -back + 0.17, bd); });
          const pot = M({ name: 'posuda', color: 0x3a3f45, roughness: 0.6 }), leaf = M({ name: 'biljka', color: 0x4f7a3a });
          [-5, 5].forEach((x) => { box(0.6, 0.6, 0.6, pot, x, 0.3, -back + 0.7, bd); const b = new T.Mesh(new T.SphereGeometry(0.55, 16, 12), leaf); b.position.set(x, 1.05, -back + 0.7); b.castShadow = true; bd.add(b); });
        } else if (env === 'garden') {
          const hm = M({ name: 'zivica', color: 0x3f6b2f });
          box(18, 1.5, 0.9, hm, 0, 0.75, -back - 0.4, bd);
          const trunk = M({ name: 'stablo', color: 0x6b4f35 }), crown = M({ name: 'krosnja', color: 0x4a7a36 });
          [[-6, -back - 3], [5.5, -back - 4]].forEach(([x, z]) => { cyl(0.14, 0.18, 2.4, trunk, x, 1.2, z, bd, 10); const c = new T.Mesh(new T.SphereGeometry(1.5, 18, 14), crown); c.position.set(x, 3.2, z); c.castShadow = true; bd.add(c); });
        } else {
          const sea = new T.Mesh(new T.PlaneGeometry(90, 40), M({ name: 'more', color: 0x3d86ad, roughness: 0.25, metalness: 0.1 }));
          sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.012, -back - 22); bd.add(sea);
          const foam = new T.Mesh(new T.PlaneGeometry(90, 0.5), M({ name: 'pjena', color: 0xf4f1ea }));
          foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.014, -back - 2); bd.add(foam);
        }
      }
      if (String(this._g('dims', 'false')) === 'true') {
        const A = this._A || R, top = this._apex || 2.6, navy = new T.MeshBasicMaterial({ name: 'kota', color: 0x0b2655 });
        const seg = (p1, p2) => { const v = new T.Vector3().subVectors(p2, p1), L = v.length(); const m = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, L, 6), navy); m.position.copy(p1).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()); bd.add(m); };
        const V = (x, y, z) => new T.Vector3(x, y, z);
        const label = (txt, x, y, z) => {
          const cv = document.createElement('canvas'), cx = cv.getContext('2d'); cv.width = 512; cv.height = 128;
          cx.font = '600 52px "Schibsted Grotesk", Arial, sans-serif'; const w = Math.min(500, cx.measureText(txt).width + 64);
          cx.fillStyle = '#0b2655'; const r = 40, x0 = (512 - w) / 2, y0 = 24, h = 80;
          cx.beginPath(); cx.moveTo(x0 + r, y0); cx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); cx.arcTo(x0 + w, y0 + h, x0, y0 + h, r); cx.arcTo(x0, y0 + h, x0, y0, r); cx.arcTo(x0, y0, x0 + w, y0, r); cx.fill();
          cx.fillStyle = '#ffffff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, 256, 66);
          const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
          const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.set(0.2, 0.05, 1); sp.position.set(x, y, z); sp.renderOrder = 10; bd.add(sp);
        };
        const zf = R + 0.2, t = 0.08, yw = top + 0.32;
        seg(V(-A, yw, zf * 0.4), V(A, yw, zf * 0.4)); seg(V(-A, yw - t, zf * 0.4), V(-A, yw + t, zf * 0.4)); seg(V(A, yw - t, zf * 0.4), V(A, yw + t, zf * 0.4));
        label(String(this._g('wlabel', '')), 0, yw + 0.2, zf * 0.4);
        const xr = R + 0.45;
        seg(V(xr, 0, 0), V(xr, top, 0)); seg(V(xr - t, 0, 0), V(xr + t, 0, 0)); seg(V(xr - t, top, 0), V(xr + t, top, 0));
        label(String(this._g('hlabel', '')), xr + 0.5, top / 2, 0);
        this._dims.R = Math.max(this._dims.R, R + 1.1); this._dims.H = Math.max(this._dims.H, top + 0.6);
      }
      const ink = M({ name: 'mjerilo', color: 0x8e949c, roughness: 0.7 });
      if (String(this._g('person', 'false')) === 'true') {
        const px = R + 0.55, pz = 0.25;
        const legs = new T.Mesh(new T.CapsuleGeometry(0.075, 0.72, 4, 10), ink); legs.position.set(px - 0.1, 0.44, pz); legs.castShadow = true; eg.add(legs);
        const legs2 = legs.clone(); legs2.position.x = px + 0.1; eg.add(legs2);
        const torso = new T.Mesh(new T.CapsuleGeometry(0.19, 0.42, 4, 12), ink); torso.position.set(px, 1.16, pz); torso.castShadow = true; eg.add(torso);
        const head = new T.Mesh(new T.SphereGeometry(0.11, 18, 14), ink); head.position.set(px, 1.64, pz); head.castShadow = true; eg.add(head);
        this._dims.R = Math.max(this._dims.R, R + 0.85);
      }
      if (String(this._g('furniture', 'false')) === 'true') {
        const wood = M({ name: 'namjestaj', color: 0x9a7552, roughness: 0.7 }), met = M({ name: 'namjestaj_metal', color: 0x2e3338, roughness: 0.45, metalness: 0.5 });
        cyl(0.5, 0.5, 0.035, wood, 0, 0.74, 0, eg, 40);
        [0, 1, 2, 3].forEach((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; cyl(0.015, 0.015, 0.72, met, Math.cos(a) * 0.36, 0.36, Math.sin(a) * 0.36, eg, 8); });
        [0, 1, 2, 3].forEach((k) => {
          const a = (k * Math.PI) / 2, cx = Math.cos(a) * 0.82, cz = Math.sin(a) * 0.82;
          const ch = new T.Group(); ch.position.set(cx, 0, cz); ch.rotation.y = -a + Math.PI / 2; eg.add(ch);
          box(0.44, 0.035, 0.42, wood, 0, 0.45, 0, ch); box(0.44, 0.38, 0.03, wood, 0, 0.66, 0.2, ch);
          [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].forEach(([x, z]) => box(0.025, 0.45, 0.025, met, x, 0.225, z, ch));
        });
      }
    }
    _clear() {
      if (!this._grp) return;
      this._s.remove(this._grp);
      this._grp.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
      });
      this._grp = null;
    }

    _build() {
      const T = this.T;
      this._clear();
      const G = new T.Group();
      G.name = 'suncobran';
      this._grp = G;
      this._s.add(G);

      const shape = this._g('shape', 'LS'), size = String(this._g('size', '300')), mech = this._g('mech', 'CR');
      const vent = this._g('vent', 'none'), look = this._g('look', 'std'), base = this._g('base', 'none');
      let a, b;
      if (shape === 'LR') { a = +size.slice(0, 2) / 20; b = +size.slice(2) / 20; }
      else { a = b = (+size || 300) / 200; }
      const R = Math.max(a, b);
      const apex = 2.5 + 0.1 * R + (mech === 'T3' ? 0.08 : 0);
      const drop = 0.36 + 0.07 * R;
      const canopyHex = this._g('canopy', '#0033A0'), frameHex = this._g('frame', '#EEEDE7');
      const wood = frameHex.toLowerCase() === '#8b5e3c';

      const mCan = new T.MeshStandardMaterial({ name: 'platno', color: new T.Color(canopyHex), roughness: 0.9, metalness: 0, side: T.DoubleSide });
      const mFr = new T.MeshStandardMaterial({ name: 'konstrukcija', color: new T.Color(frameHex), roughness: wood ? 0.62 : 0.32, metalness: wood ? 0 : 0.4 });
      const mPl = new T.MeshStandardMaterial({ name: 'plastika', color: 0x2a2e33, roughness: 0.5 });
      const mMet = new T.MeshStandardMaterial({ name: 'postolje_metal', color: 0x3b4046, roughness: 0.45, metalness: 0.6 });
      const mCon = new T.MeshStandardMaterial({ name: 'beton', color: 0xa8a59d, roughness: 0.95 });

      const ribs = [];
      if (shape === 'LO') { for (let k = 0; k < 8; k++) { const t = (k * Math.PI) / 4; ribs.push([Math.cos(t) * a, Math.sin(t) * a]); } }
      else ribs.push([a, 0], [a, b], [0, b], [-a, b], [-a, 0], [-a, -b], [0, -b], [a, -b]);
      const M = 18, bnd = [];
      for (let k = 0; k < 8; k++) {
        const p = ribs[k], q = ribs[(k + 1) % 8];
        for (let j = 0; j < M; j++) {
          const s = j / M;
          let x, z;
          if (shape === 'LO') { const t = ((k + s) * Math.PI) / 4; x = Math.cos(t) * a; z = Math.sin(t) * a; }
          else { x = p[0] + (q[0] - p[0]) * s; z = p[1] + (q[1] - p[1]) * s; }
          bnd.push({ x, z, s, k });
        }
      }
      bnd.push({ x: bnd[0].x, z: bnd[0].z, s: 1, k: 7 });

      const yRel = (u, s, sc) => -drop * sc * (0.8 * u + 0.2 * u * u) - 0.05 * sc * R * u * u * Math.sin(Math.PI * s);
      const add = (geo, mat, name, shadow = true) => {
        const m = new T.Mesh(geo, mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true; G.add(m); return m;
      };
      const canopy = (sc, y0, u0, u1, yOff, name) => {
        const U = 18, n = bnd.length, pos = [], uv = [], idx = [];
        for (let i = 0; i <= U; i++) {
          const u = u0 + ((u1 - u0) * i) / U;
          for (let j = 0; j < n; j++) { const p = bnd[j]; pos.push(p.x * u * sc, y0 + yRel(u, p.s, sc) + yOff, p.z * u * sc); uv.push(j / (n - 1), u); }
        }
        for (let i = 0; i < U; i++) for (let j = 0; j < n - 1; j++) { const A = i * n + j, B = A + 1, C = A + n, D = C + 1; idx.push(A, C, B, B, C, D); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return add(g, mCan, name);
      };
      const strip = (sc, u, y0, yOff, h, mat, name) => {
        const n = bnd.length, pos = [], uv = [], idx = [];
        for (let j = 0; j < n; j++) {
          const p = bnd[j], yt = y0 + yRel(u, p.s, sc) + yOff, ux = (p.k + p.s + 1) / 2;
          pos.push(p.x * u * sc, yt, p.z * u * sc, p.x * u * sc, yt - h, p.z * u * sc);
          uv.push(ux, 1, ux, 0);
        }
        for (let j = 0; j < n - 1; j++) { const A = j * 2, B = A + 1, C = A + 2, D = A + 3; idx.push(A, B, C, C, B, D); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return add(g, mat, name);
      };

      // brand textures
      const btxt = this._g('brandtext', ''), bimg = this._g('brandimg', '');
      const ink = lum(canopyHex) > 0.55 ? '#14213d' : '#ffffff';
      const FONT = '"Schibsted Grotesk", Arial, sans-serif';
      let valMat = mCan, decalMat = null;
      if (btxt || bimg) {
        const side = shape === 'LO' ? (Math.PI * a) / 2 : a + b;
        const H = 160, W = Math.min(4096, Math.round((H * side) / 0.2));
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const cx = cv.getContext('2d');
        const vt = new T.CanvasTexture(cv); vt.colorSpace = T.SRGBColorSpace; vt.wrapS = T.RepeatWrapping; vt.anisotropy = 8;
        const dc = document.createElement('canvas'); dc.width = 1024; dc.height = 300;
        const dx = dc.getContext('2d');
        const dt = new T.CanvasTexture(dc); dt.colorSpace = T.SRGBColorSpace; dt.anisotropy = 8;
        const fitText = (ctx, txt, max, fs) => { ctx.font = `800 ${fs}px ${FONT}`; while (ctx.measureText(txt).width > max && fs > 30) { fs -= 8; ctx.font = `800 ${fs}px ${FONT}`; } };
        const draw = (img) => {
          cx.fillStyle = canopyHex; cx.fillRect(0, 0, W, H);
          dx.clearRect(0, 0, 1024, 300);
          if (img) {
            const iw0 = img.naturalWidth || img.width || 300, ih0 = img.naturalHeight || img.height || 100;
            let ih = H * 0.72, iw = (iw0 * ih) / ih0;
            if (iw > W * 0.8) { iw = W * 0.8; ih = (ih0 * iw) / iw0; }
            cx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
            let dw = 980, dh = (ih0 * dw) / iw0;
            if (dh > 280) { dh = 280; dw = (iw0 * dh) / ih0; }
            dx.drawImage(img, (1024 - dw) / 2, (300 - dh) / 2, dw, dh);
          } else if (btxt) {
            cx.fillStyle = ink; cx.textAlign = 'center'; cx.textBaseline = 'middle';
            fitText(cx, btxt, W * 0.7, 96); cx.fillText(btxt, W / 2, H / 2 + 4);
            dx.fillStyle = ink; dx.textAlign = 'center'; dx.textBaseline = 'middle';
            fitText(dx, btxt, 960, 200); dx.fillText(btxt, 512, 158);
          }
          vt.needsUpdate = true; dt.needsUpdate = true;
        };
        draw(null);
        if (bimg) { const im = new Image(); im.onload = () => draw(im); im.src = bimg; }
        valMat = new T.MeshStandardMaterial({ name: 'volan_stampa', map: vt, roughness: 0.9, side: T.DoubleSide });
        decalMat = new T.MeshStandardMaterial({ name: 'stampa_platno', map: dt, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, side: T.DoubleSide });
      }

      // canopy
      const cascade = look === 'cascade';
      if (cascade) {
        canopy(1, apex, 0, 0.62, 0, 'platno_gornje');
        strip(1, 0.62, apex, 0, 0.05, mCan, 'kaskada_rub');
        canopy(1, apex, 0.5, 1, -0.07, 'platno_donje');
      } else canopy(1, apex, 0, 1, 0, 'platno');
      const edgeOff = cascade ? -0.07 : 0;
      strip(1, 1, apex, edgeOff, 0.2, valMat, 'volan');

      // brand decals on canopy
      if (decalMat) {
        const heightAt = (x, z) => {
          const r = Math.hypot(x, z);
          if (shape === 'LO') {
            let th = Math.atan2(z, x); if (th < 0) th += Math.PI * 2;
            const seg = Math.PI / 4, s = (th % seg) / seg;
            return { u: r / a, s };
          }
          for (let k = 0; k < 8; k++) {
            const p = ribs[k], q = ribs[(k + 1) % 8], ex = q[0] - p[0], ez = q[1] - p[1];
            const den = ex * z - ez * x; if (Math.abs(den) < 1e-9) continue;
            const s = -(p[0] * z - p[1] * x) / den;
            if (s < -1e-6 || s > 1 + 1e-6) continue;
            const bx = p[0] + ex * s, bz = p[1] + ez * s;
            if (bx * x + bz * z <= 0) continue;
            return { u: r / Math.hypot(bx, bz), s: Math.min(1, Math.max(0, s)) };
          }
          return { u: 0, s: 0 };
        };
        [0, 2, 4, 6].forEach((k) => {
          const rx = ribs[k][0], rz = ribs[k][1], depth = Math.hypot(rx, rz);
          const d = [rx / depth, rz / depth], t = [d[1], -d[0]];
          const hw = shape === 'LO' ? a * 0.707 : k % 4 === 0 ? b : a;
          const uc = cascade ? 0.34 : 0.6;
          let w = Math.min(1.25 * hw * uc, depth * 0.9);
          let h = (w * 300) / 1024;
          const c0 = depth * uc;
          const NX = 16, NY = 6, pos = [], uv = [], idx = [];
          for (let iy = 0; iy <= NY; iy++) {
            const ly = c0 - h / 2 + (h * iy) / NY;
            for (let ix = 0; ix <= NX; ix++) {
              const lx = -w / 2 + (w * ix) / NX;
              const x = d[0] * ly + t[0] * lx, z = d[1] * ly + t[1] * lx;
              const hs = heightAt(x, z);
              pos.push(x, apex + yRel(hs.u, hs.s, 1) + 0.012, z);
              uv.push(ix / NX, 1 - iy / NY);
            }
          }
          for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) { const A = iy * (NX + 1) + ix, B = A + 1, C = A + NX + 1, D = C + 1; idx.push(A, C, B, B, C, D); }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
          g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
          g.setIndex(idx);
          g.computeVertexNormals();
          add(g, decalMat, 'stampa_' + k, false);
        });
      }

      // vent / top
      const V3 = (x, y, z) => new T.Vector3(x, y, z);
      const cyl = (p1, p2, r, mat, name, seg = 14) => {
        const v = new T.Vector3().subVectors(p2, p1), L = v.length();
        const m = add(new T.CylinderGeometry(r, r, L, seg), mat, name);
        m.position.copy(p1).addScaledVector(v, 0.5);
        m.quaternion.setFromUnitVectors(V3(0, 1, 0), v.normalize());
        return m;
      };
      if (vent === 'L') {
        cyl(V3(0, apex - 0.02, 0), V3(0, apex + 0.1, 0), 0.016, mFr, 'lufter_nosac');
        const cone = add(new T.ConeGeometry(0.2 + 0.05 * R, 0.13, shape === 'LO' ? 40 : 4, 1, true), mCan, 'lufter');
        cone.position.y = apex + 0.14;
        if (shape !== 'LO') cone.rotation.y = Math.PI / 4;
      } else if (vent === 'KL' || vent === 'C2') {
        const sc = vent === 'KL' ? 0.26 : 0.42, lift = vent === 'KL' ? 0.17 : 0.14;
        cyl(V3(0, apex - 0.02, 0), V3(0, apex + lift + 0.02, 0), 0.018, mFr, 'krovic_nosac');
        canopy(sc, apex + lift, 0, 1, 0, vent === 'KL' ? 'dupli_krovic' : 'kaskadni_krovic');
        strip(sc, 1, apex + lift, 0, vent === 'KL' ? 0.045 : 0.07, mCan, 'krovic_volan');
      } else {
        const cap = add(new T.CylinderGeometry(0.035, 0.05, 0.07, 20), mPl, 'kapa');
        cap.position.y = apex + 0.02;
      }

      // base
      let yb = 0;
      if (base === 'concrete') {
        const m = add(new T.CylinderGeometry(0.3, 0.31, 0.12, 48), mCon, 'postolje_betonsko'); m.position.y = 0.06; yb = 0.12;
      } else if (base === 'm854' || base === 'm860') {
        const S = base === 'm854' ? 0.854 : 0.86;
        const pl = add(new T.BoxGeometry(S, 0.03, S), mMet, 'postolje_ploca'); pl.position.y = 0.015;
        const q = S / 2 - 0.025;
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => {
          const tl = add(new T.BoxGeometry(q - 0.02, 0.045, q - 0.02), mCon, 'betonska_ploca_' + i);
          tl.position.set(sx * (q / 2 + 0.03), 0.053, sz * (q / 2 + 0.03));
        });
        cyl(V3(0, 0.03, 0), V3(0, 0.36, 0), 0.042, mMet, 'postolje_cijev');
        yb = 0.03;
      } else if (base === 'fold880') {
        [Math.PI / 4, -Math.PI / 4].forEach((r, i) => {
          const leg = add(new T.BoxGeometry(0.88 * 1.414, 0.05, 0.06), mMet, 'noga_' + i); leg.position.y = 0.025; leg.rotation.y = r;
        });
        cyl(V3(0, 0.05, 0), V3(0, 0.38, 0), 0.042, mMet, 'postolje_cijev');
        yb = 0.05;
      } else if (base === 'embed') {
        const fl = add(new T.BoxGeometry(0.22, 0.012, 0.22), mMet, 'prirubnica'); fl.position.y = 0.006;
        yb = 0.012;
      }

      // pole + mechanism
      const runnerY = apex - 0.7 - 0.07 * R;
      if (mech === 'T3') {
        cyl(V3(0, yb, 0), V3(0, 1.5, 0), 0.034, mFr, 'stub_donji', 24);
        cyl(V3(0, 1.5, 0), V3(0, apex + 0.04, 0), 0.029, mFr, 'stub_gornji', 24);
        const col = add(new T.CylinderGeometry(0.043, 0.043, 0.08, 24), mPl, 'teleskop_spojnica'); col.position.y = 1.5;
      } else {
        cyl(V3(0, yb, 0), V3(0, apex + 0.04, 0), 0.029, mFr, 'stub', 24);
      }
      const run = add(new T.CylinderGeometry(0.046, 0.046, 0.15, 24), mPl, 'klizac'); run.position.y = runnerY;
      if (mech === 'CR') {
        const hb = add(new T.BoxGeometry(0.07, 0.12, 0.06), mPl, 'rucica_kuciste'); hb.position.set(0.045, 1.25, 0);
        cyl(V3(0.08, 1.25, 0), V3(0.08, 1.25, 0.13), 0.008, mFr, 'rucica_krak');
        cyl(V3(0.08, 1.25, 0.13), V3(0.08, 1.17, 0.13), 0.013, mPl, 'rucica_drzac');
      } else if (mech === 'CS') {
        cyl(V3(0.035, runnerY - 0.07, 0), V3(0.035, 1.12, 0), 0.0035, new T.MeshStandardMaterial({ name: 'uze', color: 0xf1efe8, roughness: 0.9 }), 'uze', 6);
        const cl = add(new T.BoxGeometry(0.03, 0.09, 0.04), mPl, 'bitva'); cl.position.set(0.04, 1.08, 0);
      }

      // ribs + struts
      ribs.forEach(([rx, rz], k) => {
        let prev = V3(0, apex - 0.02, 0);
        for (let i = 1; i <= 4; i++) {
          const u = i / 4, pt = V3(rx * u, apex + yRel(u, 0, 1) + (cascade && u > 0.55 ? -0.07 : 0) - 0.014, rz * u);
          cyl(prev, pt, 0.0085, mFr, `krak_${k}_${i}`, 8);
          prev = pt;
        }
        const dl = Math.hypot(rx, rz);
        const from = V3((rx / dl) * 0.048, runnerY + 0.05, (rz / dl) * 0.048);
        const to = V3(rx * 0.48, apex + yRel(0.48, 0, 1) - 0.02, rz * 0.48);
        cyl(from, to, 0.0075, mFr, `potporni_krak_${k}`, 8);
      });

      this._disc.scale.setScalar(R * 3 + 4);
      this._dims = { R: R * 1.05 + 0.25, H: apex + 0.2 };
      this._R0 = R; this._A = Math.max(a, b); this._apex = apex + 0.04;
      const hy = mech === 'T3' ? 1.5 : mech === 'CS' ? 1.1 : 1.25;
      const ju = 0.62, jx = ribs[0][0] * ju, jy = apex + yRel(ju, 0, 1) - 0.05;
      this._pts = {
        top: [0, apex + 0.08, 0, 2.3, 0.9, 0.7],
        rib: [jx, jy, 0, 1.8, -0.42, Math.PI / 2 + 0.35],
        runner: [0, runnerY - 0.02, 0, 1.45, -0.32, 0.7],
        mech: [0.05, hy, 0.03, 0.95, 0.1, 0.45],
        base: [0, base === 'none' ? 0.3 : 0.2, 0, base === 'none' ? 1.4 : 2.0, 0.42, 0.7]
      };
      this._envBuild();
      this._fit();
    }
  }
  ATTRS.forEach((n) => {
    Object.defineProperty(UmbrellaView.prototype, n, {
      get() { return this._p[n]; },
      set(v) {
        const nv = v == null ? undefined : String(v);
        if (this._p[n] === nv) return;
        this._p[n] = nv;
        if (n === 'nudge' || n === 'cam' || n === 'zoom' || n === 'focus' || n === 'env' || n === 'person' || n === 'furniture' || n === 'dims' || n === 'wlabel' || n === 'hlabel') this.attributeChangedCallback(n); else this._q();
      },
    });
  });
  customElements.define('umbrella-view', UmbrellaView);
})();
