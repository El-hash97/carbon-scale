// The geometry, built from code in mm (the root group is scaled to metres). buildScene() makes every part once;
// pose(m) places them from model(s) and nothing else. No part moves by its own clock.
import * as THREE from 'three';
import {FIX, P} from './model.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// ------------------------------------------------------------ layout, all from P
export const L = (() => {
  const standTop = P.standH;
  const baseTop = standTop + P.baseT;
  const dialR = P.dialD / 2;
  const dialY = baseTop + dialR; // bezel sits on the base
  const trayY = standTop + P.scaleH; // underside of the tray at zero load
  // mechanism in the dial plane: the stem left of centre, the rack on the pinion's pitch line right of centre.
  // lever arm a from the pivot to the stem, lever x a to the rack, so the rack runs FIX.lever x the platform drop.
  const pitchR = FIX.pitchD / 2;
  const stemX = -60;
  const rackX = pitchR;
  const a = (rackX - stemX) / (FIX.lever - 1);
  const pivotX = stemX - a;
  const leverY = dialY - 71;
  const barY = dialY - 31; // spring crossbar on the stem
  const springTop = dialY + 49;
  const mz = -20; // mechanism plane, behind the face
  const outletY = trayY + P.sheetT + P.hopperGap;
  // the carbon box: gates straight on its front face, funnels under its front edge (flush with the front).
  // The scale is set back under it so both outlets sit over the crate's centre line (z = 0).
  const boxY0 = outletY + P.funnelH;
  const boxTop = boxY0 + P.boxH;
  const zF = P.funnelD / 2; // box front, 80 mm in front of the crate's centre
  const boxZ = zF - P.boxD / 2;
  return {standTop, baseTop, dialR, dialY, trayY, pitchR, stemX, rackX, a, pivotX, leverY, barY, springTop, mz, outletY, boxY0, boxTop, zF, boxZ};
})();

// the spilled heap: under the crate's open end once it has fallen forward-left
// the exploded view: where each part moves at explode = 1, mm [x, y, z]. Chosen so no two parts touch and every
// part shows from the 3/4 view: the box opens upward in layers, the gates and funnels come forward, the pallet,
// carbon, tray and spider stack up in order, the dial comes apart front to back, the drip tray slides out.
export const EXPLODE = {
  // funnels: left and forward so the 3/4 camera sees them clear of the pallet. Their bottom stays 100 - 80e mm above
  // the pallet top the whole way (>= 20 mm), and they reach the frame leg's x only at e = 0.94, 200 mm in front of it.
  top: [0, 700, 0], body: [0, 350, 0], gates: [0, 350, 260], funnels: [-380, 250, 300], shelf: [-260, 350, 120],
  pallet: [0, 330, 0], carbon: [0, 160, 0], tray: [0, 160, 0], spider: [0, 70, 0],
  shell: [0, 0, -230], face: [0, 0, 140], glass: [0, 0, 240], drip: [0, 0, 700],
};
export const DRIP = {w: 960, d: 760, h: 30}; // the drip tray, mm (E, photo box-carbon)
export const SPILL = {x: -P.standW / 2 - 200, z: P.dzF};

const ACCENT = '#e8572a'; // the one accent: the part that is working right now
const MAT = {
  steel: new THREE.MeshStandardMaterial({color: '#c3c7cc', metalness: 0.85, roughness: 0.48, envMapIntensity: 0.55}),
  steelDark: new THREE.MeshStandardMaterial({color: '#8d939a', metalness: 0.8, roughness: 0.5, envMapIntensity: 0.6}),
  green: new THREE.MeshStandardMaterial({color: '#2f9d5a', metalness: 0.15, roughness: 0.45, transparent: true}),
  crate: new THREE.MeshStandardMaterial({color: '#2b8c45', metalness: 0, roughness: 0.62}),
  // dark: a sheen, not a mirror (fully glossy it read as grey metal against the pale room)
  carbon: new THREE.MeshPhysicalMaterial({color: '#1a1b1e', metalness: 0, roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.5}),
  brass: new THREE.MeshStandardMaterial({color: '#c8a048', metalness: 0.85, roughness: 0.45}),
  spring: new THREE.MeshStandardMaterial({color: '#5c636b', metalness: 0.8, roughness: 0.45}),
  accent: new THREE.MeshStandardMaterial({color: '#e8572a', metalness: 0.1, roughness: 0.5, emissive: '#e8572a', emissiveIntensity: 0.25}),
  glass: new THREE.MeshPhysicalMaterial({color: '#ffffff', metalness: 0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.16, depthWrite: false}),
  ghost: new THREE.LineBasicMaterial({color: '#e8572a', depthTest: false, transparent: true}), // drawn through the crate
  frame: new THREE.MeshStandardMaterial({color: '#aeb3b8', metalness: 0.8, roughness: 0.5, envMapIntensity: 0.5}),
};

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};

// the perforated stand top: a plate with the hole grid cut through it
function perforatedTop() {
  const w = P.standW;
  const d = P.standD;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -d / 2);
  sh.lineTo(w / 2, -d / 2);
  sh.lineTo(w / 2, d / 2);
  sh.lineTo(-w / 2, d / 2);
  sh.closePath();
  const nx = Math.floor((w - 60) / P.holeP);
  const nz = Math.floor((d - 60) / P.holeP);
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= nz; j++) {
      const h = new THREE.Path();
      h.absarc(-((nx * P.holeP) / 2) + i * P.holeP, -((nz * P.holeP) / 2) + j * P.holeP, P.holeD / 2, 0, Math.PI * 2, true);
      sh.holes.push(h);
    }
  const g = new THREE.ExtrudeGeometry(sh, {depth: 3, bevelEnabled: false, curveSegments: 14});
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, MAT.steel);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function stand() {
  const g = new THREE.Group();
  const top = perforatedTop();
  top.position.y = L.standTop - 3;
  g.add(top);
  const w = P.standW;
  const d = P.standD;
  const sk = 40; // folded skirt
  g.add(box(w, sk, 2, MAT.steel, 0, L.standTop - sk / 2, d / 2), box(w, sk, 2, MAT.steel, 0, L.standTop - sk / 2, -d / 2));
  g.add(box(2, sk, d, MAT.steel, w / 2, L.standTop - sk / 2, 0), box(2, sk, d, MAT.steel, -w / 2, L.standTop - sk / 2, 0));
  const lh = L.standTop - sk;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(box(35, lh, 35, MAT.steel, sx * (w / 2 - 25), lh / 2, sz * (d / 2 - 25)));
  // the lower rails
  for (const sz of [-1, 1]) g.add(box(w - 50, 25, 25, MAT.steel, 0, 70, sz * (d / 2 - 25)));
  for (const sx of [-1, 1]) g.add(box(25, 25, d - 50, MAT.steel, sx * (w / 2 - 25), 70, 0));
  return g;
}

// the dial face: 0..30 kg in one turn, a tick every division
function dialTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#f6f6f2';
  x.fillRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  const R = S * 0.47;
  const n = Math.round(P.cap / P.div);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    const len = major ? 52 : half ? 34 : 20;
    x.strokeStyle = '#1b1b1b';
    x.lineWidth = major ? 5 : half ? 3 : 1.6;
    x.beginPath();
    x.moveTo(Math.sin(a) * R, -Math.cos(a) * R);
    x.lineTo(Math.sin(a) * (R - len), -Math.cos(a) * (R - len));
    x.stroke();
  }
  x.fillStyle = '#1b1b1b';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let k = 0; k < P.cap; k++) {
    const a = (k / P.cap) * Math.PI * 2;
    x.font = `${k % 5 === 0 ? 700 : 500} ${k % 5 === 0 ? 58 : 40}px Inter, sans-serif`;
    x.fillText(String(k), Math.sin(a) * (R - 92), -Math.cos(a) * (R - 92)); // upright, 0 straight up; the face never turns
  }
  x.font = '600 44px Inter, sans-serif';
  x.fillText('kg', 0, 150);
  x.font = '500 30px JetBrains Mono, monospace';
  x.fillStyle = '#555';
  x.fillText(`Max ${P.cap} kg   d = ${P.div * 1000} g`, 0, 205);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function gearGeo(z, m, width) {
  const rp = (m * z) / 2;
  const ra = rp + m;
  const rr = rp - 1.25 * m;
  const sh = new THREE.Shape();
  for (let i = 0; i < z; i++) {
    const a0 = (i / z) * Math.PI * 2;
    const da = (Math.PI * 2) / z;
    const pts = [[rr, a0], [rr, a0 + da * 0.12], [ra, a0 + da * 0.32], [ra, a0 + da * 0.55], [rr, a0 + da * 0.76]];
    pts.forEach(([r, a], k) => (i === 0 && k === 0 ? sh.moveTo(r * Math.cos(a), r * Math.sin(a)) : sh.lineTo(r * Math.cos(a), r * Math.sin(a))));
  }
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, {depth: width, bevelEnabled: false});
}
// the rack: a bar along y, teeth on its left (-x) face, pitch pi.m
function rackGeo(len, m) {
  const p = Math.PI * m;
  const sh = new THREE.Shape();
  sh.moveTo(m * 1.25, 0);
  sh.lineTo(m * 1.25 + 4, 0);
  sh.lineTo(m * 1.25 + 4, len);
  sh.lineTo(m * 1.25, len);
  for (let y = len - p; y >= 0; y -= p) {
    sh.lineTo(m * 1.25, y + p * 0.78);
    sh.lineTo(-m, y + p * 0.6);
    sh.lineTo(-m, y + p * 0.4);
    sh.lineTo(m * 1.25, y + p * 0.22);
  }
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, {depth: 5, bevelEnabled: false});
}
// a coil spring hanging down from its top
// built at its rest length len so the wire stays round; scale.y = stretched / rest is a few percent
function springGeo(R, wire, turns, len) {
  const pts = [];
  const N = turns * 24;
  for (let i = 0; i <= N; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(V(Math.cos(a) * R, (-i / N) * len, Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, wire, 6, false);
}

function scaleBody() {
  const g = new THREE.Group();
  const baseG = new THREE.Group();
  const shellG = new THREE.Group();
  const base = box(P.baseW, P.baseT, P.baseD, MAT.green, 0, L.standTop + P.baseT / 2, 0);
  baseG.add(base);
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(L.dialR - 6, L.dialR - 6, 90, 64, 1, true), MAT.green.clone());
  housing.rotation.x = Math.PI / 2;
  housing.position.set(0, L.dialY, 0);
  housing.material.side = THREE.DoubleSide;
  const back = new THREE.Mesh(new THREE.CircleGeometry(L.dialR - 6, 64), housing.material);
  back.rotation.y = Math.PI;
  back.position.set(0, L.dialY, -45);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(L.dialR - 6, 6, 12, 72), MAT.steelDark);
  bezel.position.set(0, L.dialY, 45);
  const face = new THREE.Mesh(new THREE.CircleGeometry(L.dialR - 12, 72), new THREE.MeshStandardMaterial({map: dialTexture(), roughness: 0.6, metalness: 0, transparent: true}));
  face.position.set(0, L.dialY, 38);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(L.dialR - 8, 72), MAT.glass);
  glass.position.set(0, L.dialY, 47);
  // a neck from the base up into the housing
  const neck = box(120, 30, 90, MAT.green, 0, L.baseTop + 10, 0);
  baseG.add(neck);
  shellG.add(housing, back, bezel);
  g.add(baseG, shellG, face, glass);
  for (const m of [housing, back]) m.castShadow = m.receiveShadow = true;
  return {g, face, glass, shell: housing.material, shellG, baseG};
}

function tray() {
  const g = new THREE.Group();
  const t = 1.5; // drawn a hair thicker than the 1 mm sheet so it reads
  const w = P.trayW;
  const d = P.trayD;
  g.add(box(w, t, d, MAT.steel, 0, t / 2, 0));
  g.add(box(w, P.railH, t, MAT.steel, 0, P.railH / 2, -d / 2)); // back rail
  for (const sx of [-1, 1]) g.add(box(t, P.railH, d, MAT.steel, (sx * w) / 2, P.railH / 2, 0)); // side rails
  g.add(box(w, P.lipH, t, MAT.steel, 0, -P.lipH / 2, d / 2)); // front lip, folded down; the front stays open
  return g;
}

// the original pan: a small sheet with a folded-up rim, laid loose on the spider
function oldPan() {
  const g = new THREE.Group();
  const [w, d, r, t] = [P.oldW, P.oldD, P.oldRim, 1.5];
  g.add(box(w, t, d, MAT.steel, 0, t / 2, 0));
  g.add(box(w, r, t, MAT.steel, 0, r / 2, d / 2), box(w, r, t, MAT.steel, 0, r / 2, -d / 2));
  g.add(box(t, r, d, MAT.steel, w / 2, r / 2, 0), box(t, r, d, MAT.steel, -w / 2, r / 2, 0));
  return g;
}

// the spider: part of the scale, it stays when the pan goes. Its pins at +-spiderA are the edge the old pan rocks over.
function spider() {
  const g = new THREE.Group();
  const a = FIX.spiderA;
  const T = P.spiderT;
  g.add(box(2 * a + 24, T, 16, MAT.steelDark, 0, -T / 2, 0), box(16, T, 2 * a + 24, MAT.steelDark, 0, -T / 2, 0));
  for (const [x, z] of [[a, 0], [-a, 0], [0, a], [0, -a]]) g.add(box(12, 4, 12, MAT.brass, x, -2, z));
  return g;
}

// the black drip tray on the floor under the stand, with its pull handle at the front (photo box-carbon)
function dripTray() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({color: '#4d5157', metalness: 0.3, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.25}); // dark, glossy, lighter than the carbon
  const [w, d, h] = [DRIP.w, DRIP.d, DRIP.h];
  g.add(box(w, 3, d, mat, 0, 1.5, 0));
  g.add(box(w, h, 2, mat, 0, h / 2, d / 2), box(w, h, 2, mat, 0, h / 2, -d / 2), box(2, h, d, mat, w / 2, h / 2, 0), box(2, h, d, mat, -w / 2, h / 2, 0));
  g.add(box(150, 8, 8, MAT.steelDark, 0, 18, d / 2 + 34), box(8, 8, 34, MAT.steelDark, -71, 18, d / 2 + 17), box(8, 8, 34, MAT.steelDark, 71, 18, d / 2 + 17));
  return g;
}

// a paper plaque on the box front: "FCD (CARBON)", "FC (CARBON)"
function plaque(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 340;
  const x = c.getContext('2d');
  x.fillStyle = '#ecebe4';
  x.fillRect(0, 0, 512, 340);
  x.strokeStyle = '#9a9a92';
  x.lineWidth = 6;
  x.strokeRect(3, 3, 506, 334);
  x.fillStyle = '#161616';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '800 180px Inter, sans-serif';
  x.fillText(text, 256, 150);
  x.font = '500 34px Inter, sans-serif';
  x.fillText('( CARBON )', 256, 292);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map: t, roughness: 0.75});
}

// the carbon box: one stainless box split FCD | FC, on its own frame behind the stand.
// Filling: the front half of the top is a door per compartment that slides BACK under the fixed back half.
// Pouring: each gate on the box front is pulled UP.
function carbonBox() {
  const g = new THREE.Group();
  const [w, h, d, t] = [P.boxW, P.boxH, P.boxD, 3];
  const [y0, zF, zc] = [L.boxY0, L.zF, L.boxZ];
  const ym = y0 + h / 2;
  const wall = MAT.steel.clone(); // its own material: the cutaway fades the front, sides and top
  wall.transparent = true;
  const [body, lidG, gatesG, funnels, frame, shelf] = Array.from({length: 6}, () => new THREE.Group());
  g.add(body, lidG, gatesG, funnels, frame, shelf);
  body.add(box(w, h, t, wall, 0, ym, zF - t / 2), box(w, h, t, MAT.steel, 0, ym, zF - d + t / 2));
  for (const sx of [-1, 1]) body.add(box(t, h, d, wall, sx * (w / 2 - t / 2), ym, zc));
  body.add(box(w, t, d, MAT.steel, 0, y0 + t / 2, zc), box(t, h, d - 2 * t, MAT.steel, 0, ym, zc)); // floor; the FCD | FC wall
  for (const [txt, sx] of [['FCD', -1], ['FC', 1]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(200, 133), plaque(txt));
    p.position.set((sx * w) / 4, y0 + h * 0.62, zF + 0.6);
    body.add(p);
  }
  // the carbon in each compartment; FCD drains by what went into the crate
  const [iw, id] = [w / 2 - 2 * t, d - 2 * t];
  const fcd = box(iw, 1, id, MAT.carbon, -w / 4, 0, zc);
  const fc = box(iw, 1, id, MAT.carbon, w / 4, 0, zc);
  body.add(fcd, fc);
  // the gates: straight on the box front over an opening at the bottom, a plate per outlet in guides,
  // pulled up by its handle. Nothing reaches forward of the box.
  const [gw, gh] = [P.gateW, P.gateH];
  body.add(box(gw - 2 * t, gh - 2 * t, 1, MAT.carbon, 0, y0 + gh / 2, zF + 0.5)); // the opening, carbon behind it
  const gates = [-1, 1].map((sx) => {
    const gg = new THREE.Group();
    gg.add(box(gw / 2 - 10, gh, 3, MAT.frame.clone(), 0, gh / 2, 0));
    gg.add(box(80, 10, 10, MAT.steelDark, 0, gh + 30, 6), box(8, 34, 8, MAT.steelDark, -36, gh + 13, 6), box(8, 34, 8, MAT.steelDark, 36, gh + 13, 6));
    gg.position.set((sx * gw) / 4, y0, zF + 4);
    gatesG.add(gg);
    return gg;
  });
  for (const x of [-gw / 2, 0, gw / 2]) gatesG.add(box(12, gh + 120, 8, MAT.steelDark, x, y0 + (gh + 120) / 2, zF + 8));
  // the two funnel outlets under the box, front faces flush with the box front, over the crate
  const fm = MAT.steel.clone();
  fm.side = THREE.DoubleSide;
  const top = gw / 2 - 14;
  for (const sx of [-1, 1]) {
    const geo = new THREE.CylinderGeometry(Math.SQRT1_2 * top, Math.SQRT1_2 * 70, P.funnelH, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    geo.scale(1, 1, P.funnelD / top);
    const f = new THREE.Mesh(geo, fm);
    f.position.set(sx * P.pourX, L.outletY + P.funnelH / 2, 0);
    f.castShadow = true;
    funnels.add(f);
  }
  // the top: the back half is a fixed plate; the front half is a door per compartment that slides back
  // UNDER the fixed plate (fixed plate on top, door below it). Nothing sticks out behind the box.
  lidG.add(box(w, 3, d / 2, wall, 0, L.boxTop + 7.5, zF - (3 * d) / 4));
  for (const sx of [-1, 1]) lidG.add(box(t, 6, d / 2, MAT.steelDark, sx * (w / 2 - 2), L.boxTop + 3, zF - (3 * d) / 4)); // spacers
  const door0 = zF - d / 4;
  const lids = [-1, 1].map((sx) => {
    const l = new THREE.Group();
    l.add(box(w / 2 - 12, 3, d / 2, wall, 0, 0, 0));
    l.add(box(130, 10, 10, MAT.steelDark, 0, 26, d / 4 - 25), box(8, 26, 8, MAT.steelDark, -61, 13, d / 4 - 25), box(8, 26, 8, MAT.steelDark, 61, 13, d / 4 - 25));
    l.position.set((sx * w) / 4, L.boxTop + 2.5, door0);
    lidG.add(l);
    return l;
  });
  // the frame: four legs hugging the box sides, low rails, the side shelf at the front left
  const X = w / 2 + 20;
  for (const sx of [-1, 1]) for (const z of [zF - 20, zF - d + 20]) frame.add(box(40, L.boxTop, 40, MAT.frame, sx * X, L.boxTop / 2, z));
  for (const sx of [-1, 1]) frame.add(box(40, 40, d - 40, MAT.frame, sx * X, 450, zc));
  frame.add(box(2 * X, 40, 40, MAT.frame, 0, 450, zF - d + 20));
  shelf.add(box(P.shelfW, 5, 220, MAT.steel, -w / 2 + P.shelfW / 2, y0 + 40, zF + 110), box(P.shelfW, 30, 3, MAT.steel, -w / 2 + P.shelfW / 2, y0 + 25, zF + 220));
  return {g, body, top: lidG, gatesG, funnels, frame, shelf, gates, lids, fcd, fc, wall, y0: y0 + t, door0, slide: d / 2 - 60}; // the door stops with its handle at the plate
}

function crate() {
  const g = new THREE.Group();
  const w = P.crateW;
  const d = P.crateD;
  const h = P.crateH;
  const wl = P.crateWall;
  const fl = h - FIX.inH; // floor thickness, so the inside depth is FIX.inH
  g.add(box(w - 2 * wl, fl, d - 2 * wl, MAT.crate, 0, fl / 2, 0));
  g.add(box(w, h, wl, MAT.crate, 0, h / 2, d / 2 - wl / 2), box(w, h, wl, MAT.crate, 0, h / 2, -d / 2 + wl / 2));
  g.add(box(wl, h, d - 2 * wl, MAT.crate, w / 2 - wl / 2, h / 2, 0), box(wl, h, d - 2 * wl, MAT.crate, -w / 2 + wl / 2, h / 2, 0));
  return {g, floor: fl};
}

export function buildScene(scene) {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  scene.add(root);
  const standG = new THREE.Group(); // subsystem: the stand, the drip tray, the spilled heap
  const drip = dripTray();
  standG.add(stand(), drip);
  root.add(standG);
  const body = scaleBody();
  root.add(body.g);
  const bx = carbonBox();
  root.add(bx.g);

  // the moving set: everything the platform carries goes down by the drop
  const live = new THREE.Group();
  live.position.y = L.trayY;
  root.add(live);
  const spiderG = spider();
  live.add(spiderG);
  // what rests on the spider: the pan or the tray, the crate and its carbon. It hangs from the left pin so the
  // old pan can rock over it; on the new tray the tilt stays 0.
  const pin = new THREE.Group();
  const load = new THREE.Group();
  load.position.x = FIX.spiderA;
  pin.add(load);
  const mirror = new THREE.Group(); // x -1 when the carbon came from FC: the same fall, to the right
  mirror.add(pin);
  live.add(mirror);
  const trayG = tray();
  const panG = oldPan();
  const panMat = MAT.steel.clone();
  panG.traverse((o) => o.isMesh && (o.material = panMat));
  load.add(trayG, panG);
  const cr = crate();
  cr.g.position.y = P.sheetT; // centred as an operator puts it: 20 mm free to each side rail on the new tray
  load.add(cr.g);

  // the carbon that missed: a cone at the angle of repose on the floor, left of the stand where the crate empties
  const coneGeo = new THREE.ConeGeometry(1, 1, 40);
  coneGeo.translate(0, 0.5, 0);
  const spill = new THREE.Mesh(coneGeo, MAT.carbon);
  spill.position.set(SPILL.x, 0, SPILL.z); // on the floor, past the drip tray
  spill.castShadow = spill.receiveShadow = true;
  standG.add(spill);
  const carbon = box(FIX.inW, 1, FIX.inD, MAT.carbon);
  cr.g.add(carbon);
  const level = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(FIX.inW, 0.01, FIX.inD)), new THREE.LineBasicMaterial({color: '#e8572a'}));
  cr.g.add(level);

  // the stream from the left hopper: grains whose fall phase is model.phase
  const N = 90;
  const grains = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.2, 0), MAT.carbon, N);
  const jit = Array.from({length: N}, (_, i) => [Math.sin(i * 12.9898) * 22, Math.sin(i * 78.233) * 26]); // fixed spread
  root.add(grains);

  // the old pan as a ghost outline at the same height, for the comparison
  const old = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(P.oldW, P.oldRim, P.oldD)), MAT.ghost);
  old.position.y = L.trayY + P.oldRim / 2;
  old.visible = false;
  old.renderOrder = 10;
  root.add(old);

  // the mechanism inside the housing
  const mech = new THREE.Group();
  mech.position.z = L.mz;
  root.add(mech);
  const stemTop = L.trayY - P.spiderT; // the stem carries the spider: it ends at its underside
  const stemG = new THREE.Group();
  stemG.add(box(8, stemTop - L.leverY, 8, MAT.steelDark, L.stemX, (stemTop + L.leverY) / 2, 0));
  stemG.add(box(110, 8, 8, MAT.steelDark, L.stemX, L.barY, 0));
  mech.add(stemG);
  const rest = L.springTop - (L.barY + 4); // spring length at the factory zero
  const springs = [-35, 35].map((dx) => {
    const s = new THREE.Mesh(springGeo(9, 1.4, 11, rest), MAT.spring);
    s.position.set(L.stemX + dx, L.springTop, 0);
    mech.add(s);
    mech.add(box(24, 6, 12, MAT.steelDark, L.stemX + dx, L.springTop + 3, 0)); // the fixed anchor
    return s;
  });
  const leverG = new THREE.Group();
  leverG.position.set(L.pivotX, L.leverY, 0);
  const ll = L.rackX + 6 - L.pivotX;
  leverG.add(box(ll, 6, 6, MAT.steelDark, ll / 2, 0, 0));
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 14, 20), MAT.brass);
  pivot.rotation.x = Math.PI / 2;
  leverG.add(pivot);
  mech.add(leverG);
  const rack = new THREE.Mesh(rackGeo(110, P.pinionM), MAT.brass);
  rack.position.set(L.rackX, L.leverY, -2.5);
  mech.add(rack);
  const pinion = new THREE.Mesh(gearGeo(P.pinionZ, P.pinionM, 5), MAT.brass);
  pinion.position.set(0, L.dialY, -2.5);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 62, 12), MAT.steelDark);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, L.dialY, 30);
  mech.add(pinion, shaft);
  // the needle, on the pinion shaft, in front of the face
  const needle = new THREE.Group();
  needle.position.set(0, L.dialY, 41);
  const nl = L.dialR - 26;
  needle.add(box(3, nl, 1.2, MAT.accent, 0, nl / 2 - 18, 0));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 4, 24), MAT.accent);
  hub.rotation.x = Math.PI / 2;
  needle.add(hub);
  root.add(needle);

  const tmp = new THREE.Object3D();
  const D2R = Math.PI / 180;

  /** pose every part from one model(s); cut 0..1 fades the housing for the cutaway, old shows the old-pan outline,
   * lid 0..1 slides the box doors back, iso shows one subsystem alone: 'all' | 'box' | 'tray' | 'scale' | 'stand' */
  function pose(m, {cut = 0, old: showOld = false, frame = true, lid = 0, iso = 'all', explode = 0} = {}) {
    const e = explode * explode * (3 - 2 * explode); // eased in and out
    lastE = e;
    const ex = (k) => EXPLODE[k].map((v) => v * e);
    const put = (obj, k, x = 0, y = 0, z = 0) => obj.position.set(x + ex(k)[0], y + ex(k)[1], z + ex(k)[2]);
    const drop = m.defl; // real mm, no exaggeration
    const isOld = m.tray === 'old';
    live.position.y = L.trayY - drop;
    trayG.visible = !isOld;
    panG.visible = isOld;
    old.visible = showOld && !isOld;
    // show one subsystem alone, or all; the top view also looks past the carbon box
    const on = (k) => iso === 'all' || iso === k;
    bx.g.visible = frame && on('box');
    grains.visible = (on('tray') || on('box')) && e < 0.01; // the stream only makes sense with the box on its outlets
    put(bx.top, 'top');
    put(bx.body, 'body');
    put(bx.gatesG, 'gates');
    put(bx.funnels, 'funnels');
    put(bx.shelf, 'shelf');
    put(trayG, 'tray');
    put(panG, 'tray');
    put(spiderG, 'spider');
    put(body.shellG, 'shell');
    put(body.face, 'face', 0, L.dialY, 38);
    put(body.glass, 'glass', 0, L.dialY, 47);
    put(needle, 'face', 0, L.dialY, 41);
    put(drip, 'drip');
    put(cr.g, 'pallet', 0, P.sheetT);
    mirror.visible = on('tray');
    body.g.visible = mech.visible = needle.visible = spiderG.visible = on('scale');
    standG.visible = on('stand');
    bx.wall.opacity = 1 - 0.85 * cut;
    bx.wall.depthWrite = cut < 0.5;
    mirror.scale.x = -m.side; // built falling left (FCD); FC mirrors it
    // the fall (old pan only): rock about the left pin, then the pin drops and slides as the model says
    pin.rotation.z = m.tilt * D2R;
    pin.position.set(-FIX.spiderA + m.dx, -m.dy, m.dz);
    spill.visible = m.spillR > 1;
    spill.position.x = -m.side * SPILL.x;
    spill.scale.set(m.spillR, Math.max(m.spillH, 0.01), m.spillR);
    // carbon: a block of the real level on the crate floor
    carbon.visible = level.visible = m.h > 0.2;
    carbon.scale.y = Math.max(m.h, 0.2);
    carbon.position.y = cr.floor + m.h / 2 + ex('carbon')[1];
    level.position.y = cr.floor + m.h + 0.3 + ex('carbon')[1];
    // the box: FCD level, gates up while pouring, lids back
    for (const [mesh, lv] of [[bx.fcd, m.boxLevel], [bx.fc, m.boxLevelFC]]) {
      mesh.scale.y = Math.max(lv, 1);
      mesh.position.y = bx.y0 + lv / 2;
    }
    bx.gates[0].position.y = L.boxY0 + m.gate;
    bx.gates[1].position.y = L.boxY0 + m.gateFC;
    bx.lids.forEach((l) => (l.position.z = bx.door0 - lid * bx.slide));
    // the stream: from the FCD outlet to the carbon surface, or to the spider once the pan has gone
    // with the pan gone the stream clears the spider arms (pourX > spiderA + 12) and lands on the dial housing
    const surf = m.tipped ? L.dialY + Math.sqrt((L.dialR - 6) ** 2 - P.pourX ** 2) : L.trayY - drop + P.sheetT + cr.floor + m.h;
    const span = L.outletY - surf;
    for (let i = 0; i < N; i++) {
      const f = (m.phase + i / N) % 1;
      // odd grains from FC when both gates are open
      const fc = m.pourC && (!m.pourF || i % 2);
      tmp.position.set((fc ? P.pourX : -P.pourX) + jit[i][0] * (0.4 + f), L.outletY - f * f * span, jit[i][1] * 0.5); // free fall: s ~ t^2
      tmp.scale.setScalar(fc ? m.pourC : m.pourF);
      tmp.updateMatrix();
      grains.setMatrixAt(i, tmp.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
    // mechanism: stem and crossbar down by the drop, springs stretched by it, the lever turns about its pivot,
    // the rack runs lever x drop (plus the zero knob's shift), the pinion turns rack / (pi m z) of a turn, the needle with it.
    // The face never turns: 0 stays straight up.
    stemG.position.y = -drop;
    for (const s of springs) s.scale.set(1, (rest + drop) / rest, 1);
    leverG.rotation.z = -Math.asin(drop / L.a);
    rack.position.y = L.leverY - FIX.lever * drop + m.zeroShift;
    const turn = (m.rack / FIX.pitchC) * Math.PI * 2;
    pinion.rotation.z = -turn;
    needle.rotation.z = -turn;
    const paint = (mat, base, on) => {
      mat.color.set(on ? ACCENT : base);
      mat.emissive.set(on ? ACCENT : '#000000');
      mat.emissiveIntensity = on ? 0.25 : 0;
    };
    paint(bx.gates[0].children[0].material, '#aeb3b8', m.gate > 0);
    paint(bx.gates[1].children[0].material, '#aeb3b8', m.gateFC > 0);
    paint(panMat, '#c3c7cc', m.tipped);
    level.visible = level.visible && !!m.pour;
    // the cutaway: housing to a ghost, face and glass faded
    body.shell.opacity = 1 - 0.9 * cut;
    body.shell.depthWrite = cut < 0.5;
    body.face.material.opacity = 1 - 0.85 * cut;
    body.face.material.depthWrite = cut < 0.5;
    body.glass.visible = cut < 0.5;
  }

  // points the labels point at, in metres, from the same layout and pose
  const at = (x, y, z) => V(x * 0.001, y * 0.001, z * 0.001);
  let lastE = 0; // the explode pose() last drew, so the anchors match it
  const anchors = (m) => {
    const ty = L.trayY - m.defl;
    root.updateMatrixWorld();
    return {
      rail: at(-P.trayW / 2, ty + P.railH, P.trayD / 2 - 15),
      tray: trayG.localToWorld(V(P.trayW / 2 - 30, 0, P.trayD / 2)),
      crate: cr.g.localToWorld(V(P.crateW / 2 - 60, P.crateH, P.crateD / 2)),
      carbon: cr.g.localToWorld(V(60, cr.floor + m.h + EXPLODE.carbon[1] * lastE, 40)),
      dial: at(L.dialR * 0.75, L.dialY - L.dialR * 0.35, 47),
      box: at(-P.boxW / 4 - 100, L.boxY0 + P.boxH * 0.62, L.zF),
      gate: at(-P.gateW / 4, L.boxY0 + P.gateH + m.gate + 30, L.zF + 10),
      gatefc: at(P.gateW / 4, L.boxY0 + P.gateH + m.gateFC + 30, L.zF + 10),
      lid: bx.lids[1].localToWorld(V(0, 30, P.boxD / 4 - 25)),
      spill: at(-m.side * SPILL.x, m.spillH * 0.7, SPILL.z),
      stand: at(P.standW / 2 - 30, L.standTop, P.standD / 2),
      spring: at(L.stemX - 35, L.springTop - 40, L.mz),
      rack: at(L.rackX + 4, L.leverY + 30 - FIX.lever * m.defl, L.mz),
      pinion: at(0, L.dialY, L.mz),
      lever: at(L.pivotX + 20, L.leverY, L.mz),
      old: panG.localToWorld(V(-P.oldW / 2, P.oldRim, P.oldD / 2)),
      xtop: bx.top.localToWorld(V(P.boxW / 2 - 80, L.boxTop + 10, L.zF - P.boxD * 0.75)),
      xbody: bx.body.localToWorld(V(-P.boxW / 2, L.boxY0 + P.boxH * 0.75, L.zF)),
      xgates: bx.gatesG.localToWorld(V(P.gateW / 4, L.boxY0 + P.gateH + m.gateFC, L.zF + 4)),
      xfunnel: bx.funnels.localToWorld(V(-P.pourX, L.outletY + P.funnelH / 2, P.funnelD / 2)),
      xframe: bx.frame.localToWorld(V(P.boxW / 2 + 40, 450, L.zF - 20)),
      xshelf: bx.shelf.localToWorld(V(-P.boxW / 2, L.boxY0 + 40, L.zF + 220)),
      xspider: spiderG.localToWorld(V(-FIX.spiderA - 12, -P.spiderT, 0)),
      xface: body.face.localToWorld(V((L.dialR - 12) * 0.6, -(L.dialR - 12) * 0.6, 0)),
      xglass: body.glass.localToWorld(V(-(L.dialR - 8) * 0.7, (L.dialR - 8) * 0.5, 0)),
      xshell: body.shellG.localToWorld(V(-(L.dialR - 6), L.dialY, 0)),
      xmech: mech.localToWorld(V(L.stemX - 35, L.springTop - 40, 0)),
      xbase: body.baseG.localToWorld(V(P.baseW / 2, L.standTop + P.baseT, P.baseD / 2)),
      xdrip: drip.localToWorld(V(DRIP.w / 2, DRIP.h, DRIP.d / 2)),
    };
  };
  const ink = new THREE.LineBasicMaterial({color: '#26282b', transparent: true, opacity: 0.4});
  const pale = [];
  const hsl = {};
  root.traverse((o) => {
    const mt = o.material;
    if (!o.isMesh || !mt || !mt.color || mt.depthWrite === false || o.geometry.type === 'TorusGeometry') return;
    if (mt.color.getHSL(hsl).l > 0.55) pale.push(o);
  });
  for (const o of pale) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), ink));
  return {root, pose, anchors};
}
