// Timbangan carbon, the live page. One input, stroke s (0..1), sets the carbon level; model(s) gives every number;
// scene.pose(m) places every part; the panels and the labels print the same m. Left alone the page tours itself
// (tourAt(c) is a pure function of the tour clock); any click, drag, wheel or key hands control over, 25 s of quiet
// hands it back.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {cost, DAYS, FIX, model, P, PRICES, SHIFTS} from './model.js';
import {warmUp} from 'teardown-kit/warm.js';
import {buildScene, DRIP, L, SPILL} from './scene.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const GATE_T = 0.4; // s to pull a gate up or let it down (A)
const MECH_X = 5; // the mechanism schematic draws its motion this many times larger
const FILL_S = FIX.carbonMax / P.flow; // s for a full crate at the gate flow, so tour time = the model's time
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const f1 = (x) => x.toFixed(1);
const f2 = (x) => x.toFixed(2);

// ------------------------------------------------------------ views (metres, degrees)
const VIEWS = {
  hero: {name: 'Hero', tx: -0.05, ty: 0.76, tz: -0.15, az: 32, el: 16, d: 4.9, labels: ['rail', 'crate', 'carbon', 'dial', 'box', 'gate', 'gatefc', 'stand', 'spill']},
  front: {name: 'Depan', tx: 0, ty: 0.8, tz: 0, az: 12, el: 7, d: 4.6, labels: ['box', 'gate', 'gatefc', 'carbon', 'dial', 'spill']},
  side: {name: 'Samping 3/4', tx: -0.05, ty: 0.8, tz: -0.12, az: -52, el: 14, d: 4.7, labels: ['box', 'crate', 'dial', 'stand', 'spill']},
  dial: {name: 'Dial', tx: 0, ty: L.dialY / 1000, tz: 0.04, az: 0, el: 4, d: 0.78, labels: ['dial']},
  mech: {name: 'Dalam timbangan', tx: -0.04, ty: (L.dialY + 10) / 1000, tz: 0, az: 12, el: 6, d: 0.62, labels: ['spring', 'rack', 'pinion', 'lever'], cut: 1},
  plan: {name: 'Atas', tx: 0, ty: 0.58, tz: 0.02, az: 0, el: 89, d: 1.75, labels: ['rail', 'crate', 'old'], ghost: 1},
  pour: {name: 'Tuang', tx: -0.12, ty: 0.68, tz: 0, az: 34, el: 14, d: 2.1, labels: ['gate', 'gatefc', 'carbon', 'crate', 'old', 'spill']},
  exp: {name: 'Exploded', tx: -0.05, ty: 1.05, tz: 0.1, az: 30, el: 13, d: 6.6, labels: ['xtop', 'xbody', 'xgates', 'xfunnel', 'xframe', 'xshelf', 'crate', 'carbon', 'tray', 'xspider', 'xface', 'xglass', 'xshell', 'xmech', 'xbase', 'stand', 'xdrip']},
  box: {name: 'Box carbon', tx: 0, ty: 1.2, tz: -0.45, az: 22, el: 52, d: 3.2, labels: ['box', 'lid', 'gate', 'gatefc'], lid: 1},
};
const ORDER = ['hero', 'front', 'side', 'plan', 'mech', 'dial', 'pour', 'box'];

// ------------------------------------------------------------ the tour: a pure function of its own clock
// 0..32 s the new tray fills to the top; 32..54 s the old pan fills until it falls at 5 kg.
const TOUR = 54;
// The tour is the operator's presses: at each time the cursor reaches a button and presses it, and the press is what
// changes the page (a view, the FCD gate, Exploded, Pan lama). A gate press shuts once the pallet is full: it opens,
// takes GATE_T to come up, then FILL_S (7.2 s at 1 kg/s) to fill. The tour ends as it began (new tray, empty).
const SHUT = {fcd: 0, fc: 0};
const FCD = {fcd: 1, fc: 0};
const OPEN1 = 2.2;
const OPEN2 = 34.2;
// The right panel is driven too: the Skema tab while the mechanism and the fall are on screen, Deskripsi for the top
// view, and after the spill the Cost tab: a carbon type, the kg/shift slider dragged [from, to] over its 4th field (s),
// a period, then back to Deskripsi. Cost goes back to its defaults while hidden, so the loop has no jump.
const COST0 = {type: 'JG-01', kg: 1, days: 22};
const TOUR_EV = [
  [OPEN1, 'gate', 1], [3.4, 'view', 'pour'], [6.5, 'view', 'box'], [OPEN1 + GATE_T + FILL_S, 'gate', 0],
  [10.8, 'view', 'mech'], [12.2, 'tab', 'sch'], [14, 'view', 'dial'], [17.5, 'view', 'front'], [19.6, 'tab', 'why'],
  [21, 'view', 'plan'], [24.5, 'view', 'side'], [27.5, 'exp', 1], [31, 'exp', 0], [32.2, 'old', 1],
  [33.2, 'view', 'pour'], [OPEN2, 'gate', 1], [36, 'tab', 'sch'], [OPEN2 + GATE_T + FILL_S, 'gate', 0],
  [44, 'view', 'hero'], [45.2, 'tab', 'cost'], [46.4, 'ctype', 'SG-3'], [47.6, 'ckg', [1, 3], 1.2],
  [50, 'cdays', 30], [51.2, 'tab', 'why'], [52.5, 'old', 0],
];
const evEnd = (e) => e[0] + (e[3] || 0); // a drag lasts; a press is a moment
function tourAt(c) {
  c = ((c % TOUR) + TOUR) % TOUR;
  let view = 'hero';
  let old = 0;
  let exp = 0;
  let gate = null; // the last gate press: [t, open]
  let open = null; // the press that started this pallet's pour
  let tab = 'why';
  const cost0 = {...COST0};
  for (const [t, k, a, d] of TOUR_EV) {
    if (t > c) break;
    if (k === 'view') view = a;
    else if (k === 'exp') [exp, view] = [a, a ? 'exp' : 'hero'];
    else if (k === 'old') [old, gate, open] = [a, null, null]; // a new pallet on the other pan
    else if (k === 'gate') [gate, open] = [[t, a], a ? t : open];
    else if (k === 'tab') tab = a;
    else if (k === 'ctype') cost0.type = a;
    else if (k === 'cdays') cost0.days = a;
    else if (k === 'ckg') cost0.kg = Math.round((a[0] + (a[1] - a[0]) * ss(t, t + d, c)) * 10) / 10; // the slider's 0.1 kg steps
  }
  const g = !gate ? 0 : clamp(gate[1] ? (c - gate[0]) / GATE_T : 1 - (c - gate[0]) / GATE_T, 0, 1);
  const s = open == null ? 0 : clamp((c - open - GATE_T) / FILL_S, 0, 1);
  return {s, view, old, exp, gates: {fcd: g, fc: 0}, tab, cost: cost0};
}

// ------------------------------------------------------------ page shell
const app = document.getElementById('app');
app.innerHTML = `
<canvas id="gl"></canvas>
<svg id="leads" width="${W}" height="${H}"></svg>
<div id="labels"></div>
<header class="hd">
  <div class="t1">TIMBANGAN CARBON <span>· PALLET SCALE + SAFETY RAILS</span></div>
  <div class="t2">Satu input: stroke s = carbon keluar dari pintu FCD / FC (0 → ${f2(FIX.carbonMax)} kg). Semua angka di layar dari model(s).</div>
</header>
<section class="pn left">
  <div class="h">MODEL · s = <b id="sv">0.00</b></div>
  <div class="big"><span id="rd">0.00</span><small> kg di dial</small></div>
  <div class="st" id="st"></div>
  <div class="rows" id="rows"></div>
  <div class="ctl">
    <button id="play" class="bt">▶</button>
    <div class="sl" id="sl"><div class="tr"><div class="fl" id="slf"></div></div><div class="kn" id="slk"></div></div>
  </div>
  <div class="gates">
    <div class="gt"><span>Pintu FCD<small id="g-fcd-s"></small></span><button class="bt" id="g-fcd"></button></div>
    <div class="gt"><span>Pintu FC<small id="g-fc-s"></small></span><button class="bt" id="g-fc"></button></div>
  </div>
  <div class="h h2">DIAL (kg) vs CARBON TERTUANG (kg)</div>
  <svg id="ch1" class="chart" viewBox="0 0 280 92"></svg>
  <div class="h h2">MOMEN GULING DI PIN SPIDER (N·m)</div>
  <svg id="ch2" class="chart" viewBox="0 0 280 92"></svg>
</section>
<section class="pn right">
  <div class="tabs"><button class="bt on" id="tab-why">Deskripsi</button><button class="bt" id="tab-sch">Skema</button><button class="bt" id="tab-cost">Cost</button></div>
  <div id="pg-sch" hidden>
    <div class="h">SKEMA 2D · TAMPAK DEPAN · dari model(s)</div>
    <svg id="sch" class="sch"></svg>
    <div class="h h2">MEKANISME · gerak ×<b>${MECH_X}</b></div>
    <svg id="mch" class="sch"></svg>
  </div>
  <div id="pg-why">
    <div class="h">UKURAN · tampak atas, skala sama (mm)</div>
    <svg id="d-pallet" class="dwg"></svg>
    <div class="dwg2"><svg id="d-old" class="dwg"></svg><svg id="d-new" class="dwg"></svg></div>
    <div class="rc bad"><div class="rch">ROOT CAUSE · PAN LAMA</div><ol id="rc-old"></ol></div>
    <div class="rc good"><div class="rch">PENANGGULANGAN · TRAY BARU</div><ol id="rc-new"></ol></div>
    <div class="h h2">CEK TANGAN</div>
    <div class="chk" id="chk"></div>
  </div>
  <div id="pg-cost" hidden>
    <div class="h">COST CARBON TERBUANG</div>
    <div class="sub">Jenis carbon · Rp/kg</div>
    <div class="chips" id="c-type"></div>
    <div class="sub">Tumpah per shift: <b id="c-kgv"></b></div>
    <input type="range" id="c-kg" min="0.1" max="5" step="0.1" value="1">
    <div class="ticks"><span>0.1 kg</span><span>5 kg</span></div>
    <div class="sub">Periode · ${SHIFTS} shift/hari</div>
    <div class="chips" id="c-days"></div>
    <div class="cbig" id="c-rp"></div>
    <div class="rows" id="c-rows"></div>
    <div class="sub">Semua jenis, periode yang sama</div>
    <div class="cmp" id="c-all"></div>
    <div class="st bad" id="c-sim"></div>
    <div class="chk">kg = kg/shift × ${SHIFTS} shift × hari · cost = kg × Rp/kg. ${DAYS[2]} hari = 1 bulan kerja; ${DAYS[1]} dan ${DAYS[3]} hari dihitung tiap hari kerja.</div>
  </div>
</section>
<div class="ft2"><span class="lbl">SUBSISTEM</span><div class="grp" id="iso"></div><span class="hint">tampilkan sendiri · C = potong (box + rumah dial)</span></div>
<footer class="ft">
  <div class="grp" id="views"></div>
  <div class="grp" id="tog"></div>
  <div class="tour bt" id="tour"></div>
</footer>
<div class="src">E = diukur dari foto, skala dari Ø dial ${P.dialD} mm (BELUM diukur) · A = asumsi · lihat sim/model.js · H = sembunyikan panel · Q = kualitas: <b id="q"></b></div>
<div id="ring"></div>
<div id="cur"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2 L3 20 L8 15.2 L11.4 22 L14.6 20.5 L11.2 13.8 L18 13.8 Z" fill="#1d1c1a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
`;
const $ = (id) => document.getElementById(id);
const canvas = $('gl');

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ecebe6');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;
const camera = new THREE.PerspectiveCamera(32, W / H, 0.01, 50);
const sun = new THREE.DirectionalLight('#fff6ea', 2.2);
sun.position.set(1.6, 3.2, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left: -1.6, right: 1.6, top: 2.7, bottom: -1.3, near: 0.5, far: 9}); // the whole box and a fallen crate
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.002;
scene.add(sun, new THREE.HemisphereLight('#ffffff', '#cfc9bd', 0.6));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({opacity: 0.16, polygonOffset: true, polygonOffsetFactor: -1}));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const sim = buildScene(scene);

// quality tiers for weaker GPUs. This page has no ambient occlusion or post passes at any tier, so the steps are the
// pixel ratio, the shadow map and how often the DOM panels are redrawn. ?q=0|1|2 fixes a tier; Q cycles it.
const TIERS = [
  {name: 'tinggi', pr: 2, shadow: 2048, every: 1},
  {name: 'sedang', pr: 1.25, shadow: 1024, every: 2},
  {name: 'ringan', pr: 0.85, shadow: 512, every: 2},
];
const qp = new URLSearchParams(location.search).get('q');
let tier = qp != null ? clamp(Math.round(+qp) || 0, 0, TIERS.length - 1) : matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700 ? 2 : 0;
let autoTier = qp == null;
let scale = 1;
const fit = () => {
  scale = Math.min(innerWidth / W, innerHeight / H);
  app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
  renderer.setPixelRatio(clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  spots = null; // the cursor's targets moved
  renderer.setSize(W, H, false);
};
let spots = null;
const applyTier = () => {
  const q = TIERS[tier];
  sun.shadow.mapSize.set(q.shadow, q.shadow);
  if (sun.shadow.map) {
    sun.shadow.map.dispose(); // re-allocated at the new size on the next shadow render; no shader changes
    sun.shadow.map = null;
  }
  fit();
  $('q').textContent = q.name + (autoTier ? ' (auto)' : '');
};
applyTier();
addEventListener('resize', fit);

// ------------------------------------------------------------ panels
const ROWS = [
  ['p', 'Carbon tertuang', (m) => `${f2(m.poured)} kg`],
  ['c', 'Carbon di crate', (m) => `${f2(m.carbon)} kg · ${f1(m.h)} mm`, true],
  ['x', 'Carbon tumpah', (m) => `${f2(m.spilled)} kg`],
  ['n', 'Sudut jarum', (m) => `${f1(m.needle)}°`],
  ['d', 'Pan turun δ', (m) => `${f2(m.defl)} mm`],
  ['u', 'Pakai kapasitas', (m) => `${f1(m.used * 100)} %`],
];
$('rows').innerHTML = ROWS.map(([k, n, , acc]) => `<div class="r${acc ? ' acc' : ''}"><span>${n}</span><b id="r_${k}"></b></div>`).join('');
// ------------------------------------------------------------ the description: drawings to one scale, every size from P
// top view in mm, x right, y toward the operator (the front). One viewBox width per drawing so all three share a scale.
const f0 = (x) => x.toFixed(0);
const rect = (x0, y0, x1, y1, cls, id = '') => `<rect ${id ? `id="${id}" ` : ''}x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" class="${cls}"/>`;
const ctr = (w, d, cls, id) => rect(-w / 2, -d / 2, w / 2, d / 2, cls, id);
// a dimension line: horizontal (dir 'h') at y from x0 to x1, or vertical ('v') at x from y0 to y1, with its number
const dim = (dir, at, a, b, txt) =>
  dir === 'h'
    ? `<path class="dm" d="M${a},${at} H${b} M${a},${at - 14} V${at + 14} M${b},${at - 14} V${at + 14}"/><text x="${(a + b) / 2}" y="${at + 46}" class="dt">${txt}</text>`
    : `<path class="dm" d="M${at},${a} V${b} M${at - 14},${a} H${at + 14} M${at - 14},${b} H${at + 14}"/><text x="${at + 22}" y="${(a + b) / 2 + 14}" class="dt l">${txt}</text>`;
const vb = (id, x0, y0, w, h) => $(id).setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
const DW = 700; // mm across each half drawing; the pallet drawing is twice that, so one scale for all three
const [pw, pd] = [P.crateW, P.crateD];
// the pallet alone, with what it holds
vb('d-pallet', -DW / 2 + 40, -190, DW * 2 + 20, 420);
$('d-pallet').innerHTML = `${ctr(pw, pd, 'g-pal')}${ctr(FIX.inW, FIX.inD, 'g-in')}
${dim('h', pd / 2 + 40, -pw / 2, pw / 2, pw)}${dim('v', pw / 2 + 40, -pd / 2, pd / 2, pd)}
<text x="${pw / 2 + 170}" y="-110" class="dt l b">PALLET (crate PP)</text>
<text x="${pw / 2 + 170}" y="-40" class="dt l">${pw} × ${pd} × ${P.crateH} mm · ${P.crateM} kg</text>
<text x="${pw / 2 + 170}" y="30" class="dt l">isi ${FIX.inW} × ${FIX.inD} mm → ${f1(FIX.fillL)} L</text>
<text x="${pw / 2 + 170}" y="100" class="dt l">penuh ${P.fillH} mm = ${f1(FIX.carbonMax)} kg carbon</text>`;
// the old pan with the pallet on it: what hangs off, the spider pins it rocks over, where the carbon lands
const oh = FIX.overhangW;
vb('d-old', -DW / 2, -250, DW, 540);
$('d-old').innerHTML = `<text x="0" y="-215" class="dt b o">PAN LAMA ${P.oldW} × ${P.oldD}</text>
${ctr(P.oldW, P.oldD, 'g-pan')}
${rect(-pw / 2, -pd / 2, -P.oldW / 2, pd / 2, 'g-hang')}${rect(P.oldW / 2, -pd / 2, pw / 2, pd / 2, 'g-hang')}
${ctr(pw, pd, 'g-pal2')}
<text x="${-(pw + P.oldW) / 4}" y="-${pd / 2 + 16}" class="dt o">${f0(oh)}</text><text x="${(pw + P.oldW) / 4}" y="-${pd / 2 + 16}" class="dt o">${f0(oh)}</text>
${[-1, 1].map((sx) => `<circle cx="${sx * FIX.spiderA}" cy="0" r="12" class="g-pin"/>`).join('')}
<path class="g-pour" d="M${-P.pourX - 26},-60 H${-P.pourX + 26} L${-P.pourX},-14 Z"/><text x="${-P.pourX}" y="-76" class="dt">FCD</text>
${dim('h', P.oldD / 2 + 40, -P.oldW / 2, P.oldW / 2, P.oldW)}
<text x="0" y="270" class="dt o">${f0(FIX.coverOld * 100)} % ditopang</text>`;
// the new tray: rails back, left, right; the pallet with its 20 mm all round; the front open
const [tw, td] = [P.trayW, P.trayD];
vb('d-new', -DW / 2, -250, DW, 540);
$('d-new').innerHTML = `<text x="0" y="-215" class="dt b g">TRAY BARU ${tw} × ${td}</text>
${ctr(tw, td, 'g-tray')}
<path class="g-rail" d="M${-tw / 2},${td / 2} V${-td / 2} H${tw / 2} V${td / 2}"/>
<path class="g-front" d="M${-tw / 2},${td / 2} H${tw / 2}"/>
${ctr(pw, pd, 'g-pal')}${ctr(FIX.inW, FIX.inD, 'g-fill', 'p-fill')}
<text x="${-tw / 2 + P.trayClr / 2}" y="16" class="dt sm">${P.trayClr}</text><text x="0" y="${-pd / 2 - 1}" class="dt sm">${P.trayClr}</text>
${dim('h', td / 2 + 40, -tw / 2, tw / 2, tw)}
<text x="0" y="270" class="dt g">${f0(FIX.coverNew * 100)} % ditopang · rail ${P.railH}</text>`;
// root cause and countermeasure, written from the same numbers
const li = (a) => a.map((t) => `<li>${t}</li>`).join('');
$('rc-old').innerHTML = li([
  `Pan ${P.oldW}×${P.oldD} lebih pendek dari pallet ${pw}: hanya <b>${f0(FIX.coverOld * 100)} %</b> pallet ditopang, <b>${f0(oh)} mm</b> menggantung di kiri dan kanan.`,
  `Pan cuma diletakkan di spider, tidak dibaut. Tumpuannya pin spider ±${f0(FIX.spiderA)} mm dari tengah.`,
  `Carbon jatuh dari corong FCD, ${P.pourX} mm dari tengah: beban berat sebelah. Mulai <b>${f0(P.tipKg)} kg</b> momen carbon (${f0(P.tipKg)}×${P.pourX}) melebihi momen tahanan ${f0(FIX.spiderA)}×(${f2(FIX.oldM)}+${P.crateM}+${f0(P.tipKg)}) → pan + pallet terguling, carbon tumpah.`,
  `Tidak ada penahan: pallet bebas bergeser; geser > ${f0(FIX.tipOld)} mm sudah lepas dari pan.`,
]);
$('rc-new').innerHTML = li([
  `Tray ${tw}×${td} = pallet + <b>${P.trayClr} mm</b> tiap sisi: pallet ditopang <b>100 %</b>, tetap longgar untuk masuk/keluar.`,
  `Rail ${P.railH} mm di belakang, kiri, kanan: pallet hanya bisa geser ${f0(FIX.slideX)} mm lalu tertahan. Depan terbuka untuk memasukkan pallet.`,
  `Tray dibaut ke spider, jadi tidak bisa terguling. Tanpa baut, model: terguling di ${f2(FIX.tipNewLoose)} kg, hanya ${f2(FIX.tipNewLoose - FIX.carbonMax)} kg di atas isi penuh ${f1(FIX.carbonMax)} kg.`,
  `Harga: tray ${f2(FIX.trayM)} kg (+${f2(FIX.dead)} kg, dinolkan knop) → kapasitas sisa ${f1(FIX.usable)} kg, cukup untuk ${f1(P.crateM + FIX.carbonMax)} kg.`,
]);
$('chk').innerHTML = [
  `tray = (${pw}+2·${P.trayClr}) × (${pd}+2·${P.trayClr}) = ${tw} × ${td} mm`,
  `topang lama = ${Math.min(P.oldW, pw)}×${Math.min(P.oldD, pd)} / ${pw}×${pd} = ${f1(FIX.coverOld * 100)} %`,
  `pin a = ${P.tipKg}·${P.pourX} / (${P.tipKg}+${f2(FIX.oldM)}+${P.crateM}) = ${f1(FIX.spiderA)} mm`,
  `penuh ${FIX.inW}×${FIX.inD}×${P.fillH} = ${f1(FIX.fillL)} L × ${P.rhoBulk} = ${f1(FIX.carbonMax)} kg → dial ${f1(P.crateM + FIX.carbonMax)} kg = ${f1(model(1).needle)}°`,
].map((t) => `<div>${t}</div>`).join('');

// ------------------------------------------------------------ controls
// old = which pan is on the scale (a setting of the model); ghost = the old-pan outline in the top view
// gates = which gate is up now (the fill runs while one is); src = where the carbon in the crate came from
const state = {s: 0, view: 'hero', cut: 0, old: 0, ghost: 0, lid: 0, exp: 0, labels: 1, gates: {...SHUT}, src: {...FCD}, iso: 'all'};
const off = {az: 0, el: 0, k: 1};
const setView = (k) => {
  state.view = k;
  state.cut = VIEWS[k].cut || 0;
  state.ghost = VIEWS[k].ghost || 0;
  state.lid = VIEWS[k].lid || 0;
  Object.assign(off, {az: 0, el: 0, k: 1});
};
const vbtn = {};
for (const [i, k] of ORDER.entries()) {
  const b = document.createElement('button');
  b.className = 'bt';
  b.innerHTML = `<i>${i + 1}</i>${VIEWS[k].name}`;
  b.onclick = () => {
    takeOver();
    setView(k);
  };
  $('views').appendChild(b);
  vbtn[k] = b;
}
const TOG = {old: ['O', 'Pan lama'], exp: ['E', 'Exploded'], cut: ['C', 'Cutaway'], lid: ['B', 'Buka tutup'], labels: ['L', 'Label']};
const tbtn = {};
for (const [k, [key, name]] of Object.entries(TOG)) {
  const b = document.createElement('button');
  b.className = 'bt';
  b.innerHTML = `<i>${key}</i>${name}`;
  b.onclick = () => {
    takeOver();
    state[k] = state[k] ? 0 : 1;
  };
  $('tog').appendChild(b);
  tbtn[k] = b;
}
// the gate controller: opening a gate starts the pour, closing it stops it. PLAY opens FCD or closes both.
const setGate = (k, v) => {
  takeOver();
  if (v && state.s >= 1) state.s = 0; // a new crate
  state.gates = {...state.gates, [k]: v};
  if (state.gates.fcd || state.gates.fc) state.src = {...state.gates};
};
$('g-fcd').onclick = () => setGate('fcd', state.gates.fcd ? 0 : 1);
$('g-fc').onclick = () => setGate('fc', state.gates.fc ? 0 : 1);
$('play').onclick = () => {
  if (state.gates.fcd || state.gates.fc) {
    takeOver();
    state.gates = {...SHUT};
  } else setGate('fcd', 1);
};
// which subsystem each label belongs to, so an isolated view only names what it shows
const SUB = {xtop: 'box', xbody: 'box', xgates: 'box', xfunnel: 'box', xframe: 'box', xshelf: 'box', xspider: 'scale', xface: 'scale', xglass: 'scale', xshell: 'scale', xmech: 'scale', xbase: 'scale', xdrip: 'stand', box: 'box', gate: 'box', gatefc: 'box', lid: 'box', rail: 'tray', tray: 'tray', crate: 'tray', carbon: 'tray', old: 'tray', dial: 'scale', spring: 'scale', rack: 'scale', pinion: 'scale', lever: 'scale', stand: 'stand', spill: 'stand'};
// Exploded also swings the camera out to see every part, and back to the hero view when it closes
tbtn.exp.onclick = () => {
  takeOver();
  state.exp = state.exp ? 0 : 1;
  setView(state.exp ? 'exp' : 'hero');
};
const ISO = {all: 'Semua', box: 'Box carbon', tray: 'Tray + crate', scale: 'Timbangan', stand: 'Meja + baki'};
const ibtn = {};
for (const [k, name] of Object.entries(ISO)) {
  const b = document.createElement('button');
  b.className = 'bt';
  b.textContent = name;
  b.onclick = () => {
    takeOver();
    state.iso = k;
  };
  $('iso').appendChild(b);
  ibtn[k] = b;
}
const sl = $('sl');
const slide = (e) => {
  const r = sl.getBoundingClientRect();
  state.s = clamp((e.clientX - r.left) / r.width, 0, 1);
};
sl.addEventListener('pointerdown', (e) => {
  takeOver();
  state.gates = {...SHUT}; // scrubbing: the gates are shut, s is set by hand
  sl.setPointerCapture(e.pointerId);
  slide(e);
  sl.onpointermove = (ev) => {
    lastInput = T;
    slide(ev);
  };
  sl.onpointerup = () => (sl.onpointermove = null);
});
// ------------------------------------------------------------ the cost tab: every number from cost(kg/shift, days, type)
const rp = (x) => `Rp ${Math.round(x).toLocaleString('id-ID')}`;
const kgf = (x) => `${x.toLocaleString('id-ID', {maximumFractionDigits: 1})} kg`;
const cs = {...COST0};
const tabs = {why: $('tab-why'), sch: $('tab-sch'), cost: $('tab-cost')};
let tabNow = 'why';
const showTab = (k) => {
  tabNow = k;
  for (const [j, c] of Object.entries(tabs)) {
    c.classList.toggle('on', j === k);
    $(`pg-${j}`).hidden = j !== k;
  }
};
for (const [k, b] of Object.entries(tabs)) b.onclick = () => showTab(k);
const chips = (id, items, label, key) => {
  $(id).innerHTML = '';
  for (const v of items) {
    const b = document.createElement('button');
    b.className = 'bt ch';
    b.innerHTML = label(v);
    b.onclick = () => {
      cs[key] = v;
      drawCost();
    };
    b.dataset.v = v;
    $(id).appendChild(b);
  }
};
chips('c-type', Object.keys(PRICES), (t) => `${t}<br><i>${PRICES[t].toLocaleString('id-ID')}</i>`, 'type');
chips('c-days', DAYS, (d) => `${d} hari`, 'days');
$('c-kg').oninput = (e) => {
  cs.kg = +e.target.value;
  drawCost();
};
function drawCost() {
  const c = cost(cs.kg, cs.days, cs.type);
  for (const b of $('c-type').children) b.classList.toggle('on', b.dataset.v === cs.type);
  for (const b of $('c-days').children) b.classList.toggle('on', +b.dataset.v === cs.days);
  $('c-kgv').textContent = kgf(cs.kg);
  $('c-rp').innerHTML = `${rp(c.rp)}<small> · ${kgf(c.kg)} ${cs.type} terbuang / ${cs.days} hari</small>`;
  $('c-rows').innerHTML = [
    ['Per shift', cost(cs.kg, 0.5, cs.type)],
    ['Per hari', cost(cs.kg, 1, cs.type)],
    [`${cs.days} hari`, c],
  ].map(([n, x]) => `<div class="r"><span>${n}</span><b>${kgf(x.kg)} · ${rp(x.rp)}</b></div>`).join('');
  $('c-all').innerHTML = `<table><tr><th>Jenis</th><th>Rp/kg</th><th>Cost ${cs.days} hari</th></tr>${Object.keys(PRICES)
    .map((t) => `<tr${t === cs.type ? ' class="o"' : ''}><td>${t}</td><td>${PRICES[t].toLocaleString('id-ID')}</td><td>${rp(cost(cs.kg, cs.days, t).rp)}</td></tr>`)
    .join('')}</table>`;
}
drawCost();

const handOff = (e) => {
  if (!(e.target.closest && e.target.closest('#tour'))) takeOver();
};
addEventListener('pointerdown', handOff, true);
addEventListener('wheel', handOff, {capture: true, passive: true});
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  takeOver(); // any key hands control over
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'h') {
    app.classList.toggle('bare'); // hide the panels, keep the machine and its labels
    spots = null;
    e.preventDefault();
    return;
  }
  if (k === 'q') {
    tier = (tier + 1) % TIERS.length;
    autoTier = false;
    applyTier();
    e.preventDefault();
    return;
  }
  if (ORDER[+k - 1]) vbtn[ORDER[+k - 1]].click();
  else if (k === 'c') tbtn.cut.click();
  else if (k === 'o') tbtn.old.click();
  else if (k === 'b') tbtn.lid.click();
  else if (k === 'e') tbtn.exp.click();
  else if (k === 'l') tbtn.labels.click();
  else if (k === 'f') $('g-fcd').click();
  else if (k === 'g') $('g-fc').click();
  else if (k === ' ') $('play').click();
  else if (k === 'arrowright' || k === 'arrowleft') {
    takeOver();
    state.s = clamp(state.s + (k === 'arrowright' ? 0.02 : -0.02), 0, 1);
  } else return;
  e.preventDefault();
});
// orbit and zoom
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  takeOver();
  drag = {x: e.clientX, y: e.clientY};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  off.az -= ((e.clientX - drag.x) / scale) * 0.3;
  off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -30, 70);
  drag = {x: e.clientX, y: e.clientY};
  lastInput = T;
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    takeOver();
    off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.5);
  },
  {passive: false},
);

// ------------------------------------------------------------ the tour hand-off
let T = 0;
let lastInput = -1e9;
const tour = {on: true, t0: 0};
function takeOver() {
  lastInput = T;
  tour.on = false;
}
const startTour = () => {
  tour.on = true;
  tour.t0 = T;
  state.iso = 'all';
  state.exp = 0;
  Object.assign(off, {az: 0, el: 0, k: 1});
};
$('tour').addEventListener('click', (e) => {
  e.stopPropagation();
  if (tour.on) takeOver();
  else startTour();
});

// ------------------------------------------------------------ labels
const LABEL = {
  rail: () => `Safety rail ${P.railH} mm · 3 sisi`,
  tray: () => `Tray SS304 ${P.trayW}×${P.trayD}×${P.sheetT} · ${f2(FIX.trayM)} kg`,
  crate: () => `Pallet ${P.crateW}×${P.crateD}×${P.crateH} · ${P.crateM} kg`,
  carbon: (m) => `Carbon ${f1(m.h)} mm · ${f2(m.carbon)} kg`,
  dial: (m) => `Dial ${f2(m.reading)} kg · jarum ${f1(m.needle)}°`,
  box: (m) => `Box carbon FCD | FC · FCD sisa ${m.boxLevel.toFixed(0)} mm`,
  gate: (m) => (m.gate ? `Pintu FCD terbuka ↑ ${m.gate.toFixed(0)} mm${m.pourF ? ' · menuang' : ''}` : 'Pintu FCD tertutup'),
  gatefc: (m) => (m.gateFC ? `Pintu FC terbuka ↑ ${m.gateFC.toFixed(0)} mm${m.pourC ? ' · menuang' : ''}` : 'Pintu FC tertutup'),
  lid: () => 'Pintu atas ½ · geser ke belakang, masuk di bawah plat paten ½',
  spill: (m) => `Carbon tumpah ${f2(m.spilled)} kg`,
  xtop: () => `Tutup atas: ½ plat paten + ½ pintu geser ×2 · ${P.boxW}×${P.boxD / 2} mm`,
  xbody: (m) => `Box SS FCD | FC · ${P.boxW}×${P.boxH}×${P.boxD} mm · isi FCD ${m.boxLevel.toFixed(0)} mm`,
  xgates: () => `Pintu tarik-atas ×2 · ${(P.gateW / 2 - 10).toFixed(0)}×${P.gateH} mm · angkat ${P.gateLift} mm`,
  xfunnel: () => `Corong ×2 · ${(P.gateW / 2 - 14).toFixed(0)} → 70 mm · tinggi ${P.funnelH} · jarak ±${P.pourX}`,
  xframe: () => `Rangka kaki 40×40 · tinggi ${L.boxTop.toFixed(0)} mm · rel bawah 450`,
  xshelf: () => `Rak samping ${P.shelfW}×220 mm`,
  xspider: () => `Spider · pin ±${FIX.spiderA.toFixed(0)} mm · tebal ${P.spiderT} mm`,
  xface: (m) => `Muka dial + jarum · 0–${P.cap} kg · tiap ${P.div * 1000} g · ${f2(m.reading)} kg`,
  xglass: () => `Kaca dial Ø${(2 * (L.dialR - 8)).toFixed(0)} mm`,
  xshell: () => `Rumah dial Ø${(2 * (L.dialR - 6)).toFixed(0)} × 90 mm`,
  xmech: () => `Mekanisme: pegas ×${P.springs} ${f2(FIX.kEach)} N/mm · tuas ×${f2(FIX.lever)} · rack · pinion m${P.pinionM} z${P.pinionZ}`,
  xbase: () => `Alas timbangan ${P.baseW}×${P.baseD}×${P.baseT} mm`,
  xdrip: () => `Baki tumpahan ${DRIP.w}×${DRIP.d}×${DRIP.h} mm`,
  stand: () => `Meja berlubang Ø${P.holeD} / jarak ${P.holeP} mm`,
  spring: (m) => `Pegas ×${P.springs} · ${f2(FIX.kEach)} N/mm · tarik ${f1(m.perSpring)} N`,
  rack: (m) => `Rack · turun ${f2(m.rack)} mm dari nol`,
  pinion: (m) => `Pinion m${P.pinionM} z${P.pinionZ} · ${f1(m.needle)}° dari nol`,
  lever: (m) => `Tuas ×${f2(FIX.lever)} · pan turun ${f2(m.defl)} mm`,
  old: (m) => (m.tipped ? `Pan lama + crate jatuh · miring ${f1(m.tilt)}°` : `Pan lama ${P.oldW}×${P.oldD} · topang ${f1(FIX.coverOld * 100)} %`),
};
// where each label sits relative to its point, in px
const PUSH = {xtop: [170, -20], xbody: [-190, -10], xgates: [170, 10], xfunnel: [-170, 20], xframe: [160, 30], xshelf: [-160, 0], xspider: [-170, 0], xface: [170, 20], xglass: [-170, -10], xshell: [-170, 10], xmech: [-170, 30], xbase: [-160, 30], xdrip: [-150, 30], rail: [-140, -90], tray: [120, 80], crate: [150, -30], carbon: [80, -130], dial: [150, 115], box: [-200, 70], gate: [-150, -120], gatefc: [150, -90], lid: [140, -70], spill: [-120, 70], stand: [130, 90], spring: [-170, -80], rack: [170, -170], pinion: [190, 110], lever: [-140, 100], old: [-150, 120]};
const PUSH_FALL = {crate: [-170, -70], carbon: [-160, -130]}; // after the fall, away from the dial
const LGAP = 6;
const lpos = {}; // where each label is drawn now; it glides to its target
const lwid = {}; // the widest a label has been, so a longer text does not shift a clamped box
const labelEls = {};
for (const k of Object.keys(LABEL)) {
  const d = document.createElement('div');
  d.className = 'lb';
  $('labels').appendChild(d);
  labelEls[k] = d;
}
const leads = $('leads');
const v3 = new THREE.Vector3();
function drawLabels(m, show, alpha, dt) {
  const A = sim.anchors(m);
  let svg = '';
  const boxes = [];
  for (const k of Object.keys(LABEL)) {
    const el = labelEls[k];
    v3.copy(A[k]).project(camera);
    const x = (v3.x * 0.5 + 0.5) * W;
    const y = (-v3.y * 0.5 + 0.5) * H;
    const [LB, RB] = app.classList.contains('bare') ? [20, W - 20] : [350, W - 390];
    if (!show.includes(k) || alpha < 0.02 || v3.z > 1 || x < LB - 20 || x > RB + 60 || y < 70 || y > H - 80) {
      el.style.display = 'none';
      delete lastLabels[k];
      delete lpos[k];
      continue;
    }
    const fall = m.fall > 0 && PUSH_FALL[k]; // only once it is off the pin, so the label swings with the crate
    const [dx, dy] = fall ? [fall[0] * -m.side, fall[1]] : PUSH[k];
    el.style.display = 'block';
    el.style.opacity = alpha;
    el.textContent = LABEL[k](m);
    // keep the whole box between the two panels
    const bw = (lwid[k] = Math.max(lwid[k] || 0, el.offsetWidth));
    const bh = el.offsetHeight;
    const lx = dx < 0 ? clamp(x + dx, LB + bw, RB) : clamp(x + dx, LB, RB - bw);
    boxes.push({k, el, x, y, lx, ly: clamp(y + dy, 100, H - 140), l: dx < 0 ? lx - bw : lx, w: bw, h: bh, left: dx < 0});
  }
  // no two boxes overlap: walk them top to bottom and push each below any box it would cover
  boxes.sort((a, b) => a.ly - b.ly);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    for (let j = 0; j < i; j++) {
      const o = boxes[j];
      const xo = b.l < o.l + o.w + LGAP && o.l < b.l + b.w + LGAP;
      if (xo && Math.abs(b.ly - o.ly) < (b.h + o.h) / 2 + LGAP) b.ly = o.ly + (b.h + o.h) / 2 + LGAP;
    }
  }
  const kl = 1 - Math.exp(-dt / 0.12);
  for (const b of boxes) {
    const q = lpos[b.k];
    const p = (lpos[b.k] = q ? [q[0] + (b.lx - q[0]) * kl, q[1] + (b.ly - q[1]) * kl] : [b.lx, b.ly]);
    b.el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(${b.left ? '-100%' : '0'}, -50%)`;
    lastLabels[b.k] = [Math.round(p[0]), Math.round(p[1]), Math.round(b.x), Math.round(b.y)];
    svg += `<circle cx="${b.x}" cy="${b.y}" r="3.5" fill="#e8572a" opacity="${alpha}"/><polyline points="${b.x},${b.y} ${p[0]},${p[1]}" stroke="#2a2a2a" stroke-width="1" fill="none" opacity="${alpha * 0.7}"/>`;
  }
  leads.innerHTML = svg;
}

// ------------------------------------------------------------ live charts: the whole curve from model(), a dot at this frame
const CH = {w: 280, h: 92, l: 30, r: 6, t: 8, b: 16};
const cx = (kg) => CH.l + (kg / FIX.carbonMax) * (CH.w - CH.l - CH.r);
let curves = {key: ''};
// the curves only change with where the carbon comes from, so they are sampled once per gate setting
function curvesFor(src) {
  const key = `${src.fcd}${src.fc}`;
  if (curves.key === key) return curves;
  const N = 160;
  const run = (tray, f) => Array.from({length: N + 1}, (_, i) => {
    const m = model(i / N, tray, src, SHUT);
    return [m.poured, f(m)];
  });
  curves = {key, dial: {new: run('new', (m) => m.reading), old: run('old', (m) => m.reading)}, mom: {new: run('new', (m) => m.moment), old: run('old', (m) => m.moment)}};
  return curves;
}
function chart(id, yr, series, marks, dot, unit) {
  const cy = (v) => CH.t + (1 - (v - yr[0]) / (yr[1] - yr[0])) * (CH.h - CH.t - CH.b);
  const path = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${cx(x).toFixed(1)},${cy(y).toFixed(1)}`).join('');
  let g = `<line x1="${CH.l}" x2="${CH.w - CH.r}" y1="${cy(0)}" y2="${cy(0)}" class="ax0"/>`;
  const step = FIX.carbonMax > 10 ? 5 : 2; // ticks that fit a full pallet
  for (let kg = 0; kg <= FIX.carbonMax + 1e-9; kg += step) g += `<line x1="${cx(kg)}" x2="${cx(kg)}" y1="${CH.t}" y2="${CH.h - CH.b}" class="axg"/><text x="${cx(kg)}" y="${CH.h - 4}" class="axt">${kg}</text>`;
  for (const v of [yr[0], 0, yr[1]]) g += `<text x="${CH.l - 4}" y="${cy(v) + 3}" class="axt r">${v.toFixed(Math.abs(v) < 10 && v % 1 ? 1 : 0)}</text>`;
  g += `<text x="${CH.l + 3}" y="${CH.t + 7}" class="axt l">${unit}</text>`;
  for (const [pts, cls] of series) g += `<path d="${path(pts)}" class="${cls}"/>`;
  for (const [kg, txt] of marks) g += `<line x1="${cx(kg)}" x2="${cx(kg)}" y1="${CH.t}" y2="${CH.h - CH.b}" class="mk"/><text x="${cx(kg) + 3}" y="${CH.t + 18}" class="axt l mk-t">${txt}</text>`;
  g += `<circle cx="${cx(dot[0])}" cy="${cy(dot[1])}" r="3.6" class="dot"/>`;
  $(id).innerHTML = g;
}
function drawCharts(m) {
  const c = curvesFor(state.src);
  const isOld = m.tray === 'old';
  const cls = (t) => (t === m.tray ? 'ln on' : 'ln') + (t === 'old' ? ' o' : '');
  const tip = Number.isFinite(m.tipKg) && m.tipKg < FIX.carbonMax ? [[m.tipKg, `pan lama jatuh ${f1(m.tipKg)} kg`]] : [];
  chart('ch1', [-2, Math.ceil((P.crateM + FIX.carbonMax) / 2) * 2 + 2], [[c.dial.new, cls('new')], [c.dial.old, cls('old')]], tip, [m.poured, m.reading], 'kg di dial');
  // the moment: where each curve crosses 0 the pan (or a loose tray) goes over
  const all = [...c.mom.new, ...c.mom.old].map(([, v]) => v);
  const yr = [Math.floor(Math.min(...all, 0)), Math.ceil(Math.max(...all, 0.5))];
  const ax = Math.abs(m.xbar);
  const looseNew = ax > FIX.spiderA ? (FIX.spiderA * (FIX.trayM + P.crateM)) / (ax - FIX.spiderA) : Infinity;
  const marks = [...tip.map(([kg]) => [kg, 'pan lama']), ...(looseNew < FIX.carbonMax ? [[looseNew, `tray lepas ${f1(looseNew)}`]] : [])];
  chart('ch2', yr, [[c.mom.new, cls('new')], [c.mom.old, cls('old')]], marks, [m.poured, m.moment], 'N·m · di atas 0 = terguling');
}

// ------------------------------------------------------------ the schematic: the same machine in 2D, front view, mm
const SCH_TOP = L.boxTop + 70;
const SX = (x) => (x + 720).toFixed(1);
const SY = (y) => (SCH_TOP - y).toFixed(1);
const srect = (x0, y0, x1, y1, cls) => `<rect x="${SX(Math.min(x0, x1))}" y="${SY(Math.max(y0, y1))}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" class="${cls}"/>`;
const spoly = (pts, cls) => `<polygon points="${pts.map(([x, y]) => `${SX(x)},${SY(y)}`).join(' ')}" class="${cls}"/>`;
const stext = (x, y, t, cls = '') => `<text x="${SX(x)}" y="${SY(y)}" class="st-t ${cls}">${t}</text>`;
$('sch').setAttribute('viewBox', `0 0 1440 ${SCH_TOP + 10}`);
function drawSchematic(m) {
  const a = FIX.spiderA;
  const mir = -m.side; // the fall goes to the carbon's side
  const ty = L.trayY - m.defl;
  const [c, sn] = [Math.cos(m.tilt * D2R), Math.sin(m.tilt * D2R)];
  // a point on the load (origin: tray centre, underside) to the page, through the pin, the tilt and the drop
  const lp = ([x, y]) => [mir * (-a + m.dx + c * (x + a) - sn * y), ty - m.dy + sn * (x + a) + c * y];
  const lrect = (x0, y0, x1, y1, cls) => spoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(lp), cls);
  let g = srect(-720, -10, 720, 0, 'sf');
  g += srect(-480, 0, 480, 30, 'sd'); // drip tray
  for (const sx of [-1, 1]) g += srect(sx * 274 - 17, 0, sx * 274 + 17, P.standH - 40, 'ss');
  g += srect(-P.standW / 2, P.standH - 40, P.standW / 2, P.standH, 'ss');
  // the carbon box on its frame
  const [bw, y0] = [P.boxW, L.boxY0];
  for (const sx of [-1, 1]) g += srect(sx * (bw / 2 + 20) - 20, 0, sx * (bw / 2 + 20) + 20, L.boxTop, 'sfr');
  g += srect(-bw / 2, y0, bw / 2, L.boxTop, 'ss');
  g += srect(-bw / 2, y0 + 38, -bw / 2 + P.shelfW, y0 + 44, 'ss');
  g += srect(-bw / 2 + 3, y0 + 3, -3, y0 + 3 + m.boxLevel, 'sc') + srect(3, y0 + 3, bw / 2 - 3, y0 + 3 + m.boxLevelFC, 'sc');
  g += `<line x1="${SX(0)}" x2="${SX(0)}" y1="${SY(y0)}" y2="${SY(L.boxTop)}" class="sl"/>`;
  g += stext(-bw / 4, L.boxTop - 120, 'FCD', 'big') + stext(bw / 4, L.boxTop - 120, 'FC', 'big');
  for (const [sx, lift, pour] of [[-1, m.gate, m.pourF], [1, m.gateFC, m.pourC]]) {
    const x = (sx * P.gateW) / 4;
    const hw = P.gateW / 4 - 5;
    if (lift) g += srect(x - hw, y0, x + hw, y0 + lift, 'sc');
    g += srect(x - hw, y0 + lift, x + hw, y0 + lift + P.gateH, lift ? 'sg on' : 'sg');
    g += spoly([[sx * P.pourX - 87, y0], [sx * P.pourX + 87, y0], [sx * P.pourX + 35, L.outletY], [sx * P.pourX - 35, L.outletY]], 'ss');
    const surf = m.tipped ? L.dialY + Math.sqrt((L.dialR - 6) ** 2 - P.pourX ** 2) : ty + P.sheetT + (P.crateH - FIX.inH) + m.h;
    if (pour) g += `<line x1="${SX(sx * P.pourX)}" x2="${SX(sx * P.pourX)}" y1="${SY(L.outletY)}" y2="${SY(surf)}" class="sst"/>`;
  }
  // the scale: base, dial, needle, spider
  g += srect(-P.baseW / 2, P.standH, P.baseW / 2, L.baseTop, 'sgr');
  g += `<circle cx="${SX(0)}" cy="${SY(L.dialY)}" r="${L.dialR}" class="sdl"/>`;
  const nr = L.dialR - 26;
  g += `<line x1="${SX(0)}" y1="${SY(L.dialY)}" x2="${SX(nr * Math.sin(m.needle * D2R))}" y2="${SY(L.dialY + nr * Math.cos(m.needle * D2R))}" class="snd"/>`;
  g += stext(0, L.dialY - 60, `${f2(m.reading)} kg`, 'mid');
  g += srect(-a - 12, ty - P.spiderT, a + 12, ty, 'sk');
  // the load: tray or old pan, the crate, the carbon in it
  if (m.tray === 'new') g += lrect(-P.trayW / 2, 0, P.trayW / 2, 3, 'ss') + lrect(-P.trayW / 2, 0, -P.trayW / 2 + 4, P.railH, 'ss') + lrect(P.trayW / 2 - 4, 0, P.trayW / 2, P.railH, 'ss');
  else g += lrect(-P.oldW / 2, 0, P.oldW / 2, 3, 'so') + lrect(-P.oldW / 2, 0, -P.oldW / 2 + 4, P.oldRim, 'so') + lrect(P.oldW / 2 - 4, 0, P.oldW / 2, P.oldRim, 'so');
  const fl = P.sheetT + (P.crateH - FIX.inH);
  g += lrect(-P.crateW / 2, P.sheetT, P.crateW / 2, P.sheetT + P.crateH, 'scr');
  if (m.h > 0.2) g += lrect(-FIX.inW / 2, fl, FIX.inW / 2, fl + m.h, 'sc');
  // what spilled: a cone at the angle of repose, seen from the front
  if (m.spillR > 1) {
    const x = (m.side < 0 ? 1 : -1) * SPILL.x;
    g += spoly([[x - m.spillR, 3], [x + m.spillR, 3], [x, 3 + m.spillH]], 'sc');
    g += stext(x, 3 + m.spillH + 30, `${f2(m.spilled)} kg tumpah`, 'mid acc');
  }
  $('sch').innerHTML = g;
  drawMech(m);
}
// the mechanism, zoomed: springs, stem, lever, rack, pinion, needle. Travel drawn MECH_X times larger; angles true.
const MX0 = L.pivotX - 25;
const MY1 = L.springTop + 26;
const MW = L.rackX + 80 - MX0;
const MH = MY1 - (L.leverY - 40);
const MXp = (x) => (x - MX0).toFixed(2);
const MYp = (y) => (MY1 - y).toFixed(2);
$('mch').setAttribute('viewBox', `0 0 ${MW.toFixed(1)} ${MH.toFixed(1)}`);
function drawMech(m) {
  const d = m.defl * MECH_X;
  const ln = (x0, y0, x1, y1, cls) => `<line x1="${MXp(x0)}" y1="${MYp(y0)}" x2="${MXp(x1)}" y2="${MYp(y1)}" class="${cls}"/>`;
  const tx = (x, y, t, cls = '') => `<text x="${MXp(x)}" y="${MYp(y)}" class="mt ${cls}">${t}</text>`;
  let g = '';
  for (const dx of [-35, 35]) {
    const x = L.stemX + dx;
    const top = L.springTop;
    const bot = L.barY + 4 - d;
    const pts = Array.from({length: 23}, (_, i) => `${MXp(x + (i % 2 ? 7 : -7) * (i > 0 && i < 22 ? 1 : 0))},${MYp(top - ((top - bot) * i) / 22)}`);
    g += `<polyline points="${pts.join(' ')}" class="msp"/>` + `<rect x="${MXp(x - 12)}" y="${MYp(top + 6)}" width="24" height="6" class="mfx"/>`;
  }
  g += ln(L.stemX, MY1, L.stemX, L.leverY - d, 'mst') + ln(L.stemX - 55, L.barY - d, L.stemX + 55, L.barY - d, 'mst');
  const th = Math.asin(Math.min(1, d / L.a));
  const ll = L.rackX + 6 - L.pivotX;
  g += ln(L.pivotX, L.leverY, L.pivotX + ll * Math.cos(th), L.leverY - ll * Math.sin(th), 'mlv');
  g += `<circle cx="${MXp(L.pivotX)}" cy="${MYp(L.leverY)}" r="4" class="mpv"/>`;
  const ry = L.leverY - FIX.lever * d + m.zeroShift * MECH_X;
  g += `<rect x="${MXp(L.rackX)}" y="${MYp(ry + 110)}" width="4" height="110" class="mrk"/>`;
  g += `<circle cx="${MXp(0)}" cy="${MYp(L.dialY)}" r="${FIX.pitchD / 2 + P.pinionM}" class="mpn"/>`;
  const n = m.needle * D2R;
  g += ln(0, L.dialY, 60 * Math.sin(n), L.dialY + 60 * Math.cos(n), 'mnd');
  g += tx(L.stemX - 50, L.springTop + 14, `pegas ×${P.springs} · ${f1(m.perSpring)} N`);
  g += tx(L.pivotX - 20, L.leverY - 32, `tuas ×${f2(FIX.lever)} · δ ${f2(m.defl)} mm`);
  g += tx(L.rackX + 10, ry + 20, `rack ${f2(m.rack)} mm`);
  g += tx(8, L.dialY + 8, `jarum ${f1(m.needle)}°`, 'acc');
  $('mch').innerHTML = g;
}

// ------------------------------------------------------------ the frame
const cam = {...VIEWS.hero};
const camV = {}; // camera velocity
const CAM_W = 5; // rad/s: a view change settles in about a second
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
let cutE = 0;
let lidE = 0;
let expE = 0;
const EXP_T = 1.2; // s to come apart or go back together
let viewSince = 0;
let lastView = '';
let last = performance.now();
const gE = {fcd: 0, fc: 0}; // the gates as they move: they ease toward state.gates, never jump
let hold = false; // the scrubber holds the browser clock and steps the page itself
const lastLabels = {};
function tick(dt, draw = true) {
  T += dt;
  if (!tour.on && T - lastInput > IDLE) startTour();
  if (tour.on) {
    const t = tourAt(T - tour.t0);
    state.s = t.s;
    state.old = t.old;
    state.gates = t.gates;
    state.src = {...FCD};
    state.exp = t.exp;
    if (t.tab !== tabNow) showTab(t.tab);
    if (t.cost.type !== cs.type || t.cost.kg !== cs.kg || t.cost.days !== cs.days) {
      Object.assign(cs, t.cost);
      $('c-kg').value = cs.kg;
      drawCost();
    }
    if (t.view !== state.view) setView(t.view);
  } else if ((state.gates.fcd || state.gates.fc) && state.s < 1) {
    state.s = Math.min(1, state.s + ((state.gates.fcd + state.gates.fc) * dt) / FILL_S);
    if (state.s >= 1) state.gates = {...SHUT}; // full: the operator shuts the gate
  }
  if (state.view !== lastView) {
    lastView = state.view;
    viewSince = T;
  }
  if (tour.on) Object.assign(gE, state.gates); // the tour's gates are already a ramp in tourAt
  else for (const g of ['fcd', 'fc']) gE[g] += (state.gates[g] - gE[g]) * (1 - Math.exp(-dt / GATE_T));
  const m = model(state.s, state.old ? 'old' : 'new', state.src, gE);
  // the camera eases toward its view; the machine itself is posed only from m
  const V0 = VIEWS[state.view];
  const tgt = {tx: V0.tx, ty: V0.ty, tz: V0.tz, az: V0.az + off.az, el: clamp(V0.el + off.el, -10, 89), d: V0.d * off.k};
  const k = 1 - Math.exp(-dt / 0.35);
  for (const key of ['az', 'tx', 'ty', 'tz', 'el', 'd']) {
    const e = key === 'az' ? wrap(tgt.az - cam.az) : tgt[key] - cam[key];
    camV[key] = (camV[key] || 0) + (CAM_W * CAM_W * e - 2 * CAM_W * (camV[key] || 0)) * dt;
    cam[key] += camV[key] * dt;
  }
  const ce = Math.cos(cam.el * D2R);
  camera.position.set(cam.tx + cam.d * ce * Math.sin(cam.az * D2R), cam.ty + cam.d * Math.sin(cam.el * D2R), cam.tz + cam.d * ce * Math.cos(cam.az * D2R));
  camera.lookAt(cam.tx, cam.ty, cam.tz);
  camera.updateMatrixWorld();
  cutE += (state.cut - cutE) * k;
  lidE += (state.lid - lidE) * k;
  expE = Math.min(1, Math.max(0, expE + (Math.sign(state.exp - expE) * dt) / EXP_T)); // a steady 1.2 s each way
  sim.pose(m, {cut: cutE, old: !!state.ghost, frame: cam.el < 70, lid: lidE, iso: state.iso, explode: expE});
  lastM = m;
  if (!draw) return;
  renderer.render(scene, camera);
  drawCursor();
  {
    const la = state.labels ? clamp((T - viewSince - 0.6) / 0.5, 0, 1) : 0;
    const isOld = m.tray === 'old';
    const shown = (k) => state.iso === 'all' || SUB[k] === state.iso;
    const show = VIEWS[state.view].labels.concat(isOld || state.ghost ? ['old'] : []).filter((k) => !(k === 'rail' && isOld) && !(k === 'spill' && m.spilled < 0.05) && !(k === 'old' && !isOld && !state.ghost)).filter(shown);
    drawLabels(m, show, la, dt);
  }
  if (++frameNo % TIERS[tier].every) return; // the low tiers redraw the panels every other frame

  $('sv').textContent = f2(m.s);
  $('rd').textContent = f2(m.reading);
  for (const [key, , fn] of ROWS) $(`r_${key}`).textContent = fn(m);
  $('slf').style.width = `${m.s * 100}%`;
  $('slk').style.left = `${m.s * 100}%`;
  $('play').textContent = m.pour ? '❚❚' : '▶';
  for (const [k, g] of [['fcd', m.gate], ['fc', m.gateFC]]) {
    $(`g-${k}`).textContent = g ? 'TUTUP ↓' : 'BUKA ↑';
    $(`g-${k}`).classList.toggle('on', !!g);
    $(`g-${k}-s`).textContent = g ? ` · terbuka ${g.toFixed(0)} mm` : ' · tertutup';
  }
  for (const k of Object.keys(ISO)) ibtn[k].classList.toggle('on', k === state.iso);
  drawCharts(m);
  if (!$('pg-sch').hidden) drawSchematic(m);
  $('p-fill').style.opacity = 0.1 + 0.8 * (m.h / P.fillH);
  const st = $('st');
  st.className = `st${m.tray === 'old' ? ' bad' : ''}`;
  st.textContent =
    m.tray === 'new' ? 'TRAY BARU · dibaut ke spider · crate ditopang 100 %'
    : m.tipped ? `PAN LAMA JATUH · ${f2(m.spilled)} kg carbon tumpah · dial ${f2(m.reading)} kg`
    : Number.isFinite(m.tipKg) ? `PAN LAMA · jatuh pada ${f1(m.tipKg)} kg carbon · sekarang ${f2(m.poured)} kg`
    : 'PAN LAMA · carbon dari FCD + FC jatuh di tengah · tidak terguling';
  for (const v of ORDER) vbtn[v].classList.toggle('on', v === state.view);
  for (const t of Object.keys(TOG)) tbtn[t].classList.toggle('on', !!state[t]);
  const tourEl = $('tour');
  if (tourEl.classList.contains('on') !== tour.on || !tourEl.firstChild) {
    tourEl.classList.toggle('on', tour.on);
    tourEl.innerHTML = tour.on ? '<i></i>AUTO TOUR' : '▶ LANJUT TOUR';
    tourEl.title = tour.on ? 'klik, geser, scroll atau tekan tombol apa saja untuk ambil alih' : 'jalankan tour lagi (otomatis setelah 25 s diam)';
  }
  const dot = tourEl.querySelector('i');
  if (dot) dot.style.opacity = Math.floor((T - tour.t0) / 0.6) % 2 ? 0.15 : 1; // blinks on the tour clock
  // the cost of what the simulation just spilled, at the chosen carbon's price
  $('c-sim').textContent = m.spilled > 0
    ? `Dari simulasi: ${f2(m.spilled)} kg ${cs.type} tumpah = ${rp(m.spilled * PRICES[cs.type])} (sekali jatuh)`
    : `Dari simulasi: 0 kg tumpah = Rp 0${m.tray === 'new' ? ' · tray baru' : ' · pan lama belum jatuh'}`;
}
let lastM = null;
let frameNo = 0;

// ------------------------------------------------------------ the operator's cursor: a pure function of the tour clock
const appXY = (el) => {
  const a = app.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return [(r.left + r.width / 2 - a.left) / scale, (r.top + r.height / 2 - a.top) / scale];
};
const chip = (id, v) => $(id).querySelector(`[data-v="${v}"]`);
const target = ([, k, a]) =>
  ({view: () => vbtn[a], gate: () => $('g-fcd'), exp: () => tbtn.exp, old: () => tbtn.old, tab: () => $(`tab-${a}`),
    ctype: () => chip('c-type', a), cdays: () => chip('c-days', a), ckg: () => $('c-kg')})[k]();
// the slider thumb at value v, in app px (the native thumb sits 8 px in from each end of the track)
const thumbXY = (v) => {
  const el = $('c-kg');
  const a = app.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const u = (v - +el.min) / (+el.max - +el.min);
  return [(r.left - a.left) / scale + 8 + u * (r.width / scale - 16), (r.top + r.height / 2 - a.top) / scale];
};
const REST = [[820, 640], [760, 560], [900, 600], [700, 620]]; // where the hand waits between presses, over the machine
let WP = [];
function plan() {
  // waypoints [t, x, y]: arrive 0.18 s before a press, stay 0.22 s after it ends (a drag carries the thumb from its
  // start to its end), wait at a rest point if the next press is far. A part on a hidden tab is placed once its tab opens.
  spots = TOUR_EV.map((e) => (e[1] === 'ckg' ? [thumbXY(e[2][0]), thumbXY(e[2][1])] : [appXY(target(e))]));
  WP = [[0, ...REST[0]]];
  TOUR_EV.forEach((e, i) => {
    const [a, z] = [spots[i][0], spots[i][spots[i].length - 1]];
    WP.push([e[0] - 0.18, ...a], [e[0], ...a], [evEnd(e), ...z], [evEnd(e) + 0.22, ...z]);
    const next = TOUR_EV[i + 1] ? TOUR_EV[i + 1][0] : TOUR;
    if (next - evEnd(e) > 1.9) WP.push([evEnd(e) + 1.3, ...REST[i % REST.length]]);
  });
  WP.push([TOUR, ...REST[0]]); // and back where it started, so the loop is seamless
}
function ss(a, b, x) {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}
function cursorAt(c) {
  c = ((c % TOUR) + TOUR) % TOUR;
  let i = 0;
  while (i < WP.length - 2 && c > WP[i + 1][0]) i++;
  const [t0, x0, y0] = WP[i];
  const [t1, x1, y1] = WP[i + 1];
  const k = ss(t0, t1, c);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07); // a hand moves in a slight arc
  let press = -1;
  let ring = null;
  TOUR_EV.forEach((e, j) => {
    if (c >= e[0] - 0.06 && c < evEnd(e) + 0.12) press = j; // held down for the whole of a drag
    if (c >= e[0] && c < e[0] + 0.5) ring = [...spots[j][0], (c - e[0]) / 0.5];
  });
  return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring};
}
let pressed = null;
function drawCursor() {
  const cur = $('cur');
  const ringEl = $('ring');
  const on = tour.on && !app.classList.contains('bare');
  cur.style.display = ringEl.style.display = on ? 'block' : 'none';
  if (pressed) pressed.classList.remove('press');
  pressed = null;
  if (!on) return;
  plan(); // every frame: the left panel grows as it fills in, and the buttons move with it
  const p = cursorAt(T - tour.t0);
  cur.style.transform = `translate(${p.x - 4}px, ${p.y - 3}px) scale(${p.press >= 0 ? 0.86 : 1})`;
  if (p.press >= 0) (pressed = target(TOUR_EV[p.press])).classList.add('press');
  ringEl.style.display = p.ring ? 'block' : 'none';
  if (p.ring) Object.assign(ringEl.style, {left: `${p.ring[0]}px`, top: `${p.ring[1]}px`, opacity: 1 - p.ring[2], transform: `translate(-50%, -50%) scale(${0.4 + p.ring[2]})`});
}

// ------------------------------------------------------------ the frame, with an automatic step down on a slow GPU
const perf = {n: 0, sum: 0, slow: 0, age: 0};
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!hold) {
    tick(dt);
    if (autoTier && tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 2) {
        // the first 2 s after load or a step are uploads settling; after that two slow half-seconds in a row step down
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0; // slower than ~45 fps
          perf.sum = perf.n = 0;
          if (perf.slow >= 2) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
  }
  requestAnimationFrame(frame);
}
// warm every shader before the first frame, the hidden parts too (old pan, spilled heap, outline...), then draw once
// into a small off-screen target so the shadow-map programs link there and not in a visible frame
{
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  const t0 = performance.now();
  // the fonts too: a label's width (and so where it sits) depends on them, so no frame is drawn before they load
  Promise.all([warmUp(renderer, camera, [{scene}]), document.fonts.ready]).then(() => {
    const rt = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    rt.dispose();
    for (const o of hidden) o.visible = false;
    window.WARM_MS = performance.now() - t0;
    window.SIM.ready = true; // the recorder waits for this: every shader is linked
    last = performance.now();
    requestAnimationFrame(frame);
  });
}
// The recorder's clock. render(t) is a pure function of t: the page is a fixed-step simulation (1/60 s) from a full
// reset, so the frame at t is always the state after round(t * 60) steps from the same start, whatever was drawn
// before. Stepping forward a frame at a time (the recorder) and jumping straight to t give the same pixels.
const FPS = 60;
const restart = () => {
  hold = true;
  T = 0;
  lastInput = -1e9;
  Object.assign(state, {s: 0, view: 'hero', cut: 0, old: 0, ghost: 0, lid: 0, exp: 0, labels: 1, gates: {...SHUT}, src: {...FCD}, iso: 'all'});
  startTour();
  tour.t0 = 0;
  Object.assign(cam, VIEWS.hero);
  for (const k of Object.keys(camV)) delete camV[k];
  cutE = lidE = expE = 0;
  viewSince = 0;
  lastView = '';
  frameNo = 0;
  Object.assign(gE, {fcd: 0, fc: 0});
  for (const o of [lpos, lwid, lastLabels]) for (const k of Object.keys(o)) delete o[k];
  Object.assign(cs, COST0);
  $('c-kg').value = cs.kg;
  drawCost();
  showTab('why');
  app.classList.remove('bare');
  tick(0);
};
let simN = -1; // the step the page is at, for render()
const render = (t) => {
  const n = Math.round(t * FPS);
  if (simN < 0 || n < simN) {
    restart();
    simN = 0;
  }
  for (; simN < n; simN++) tick(1 / FPS);
  return {t, n};
};
const advance = (sec) => {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i++) tick(1 / 60); // every frame drawn, as in the browser: labels glide frame by frame
};
const probe = () => ({c: T - tour.t0, view: state.view, cam: {...cam}, m: lastM, labels: {...lastLabels}});
const gpuName = () => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
};
const bench = (t, n = 150) => {
  hold = true;
  tier = t;
  autoTier = false;
  applyTier();
  const gl = renderer.getContext();
  for (let i = 0; i < 10; i++) tick(1 / 60); // settle: shadow map re-allocated, caches warm
  gl.finish();
  const ms = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    tick(1 / 60);
    gl.finish();
    ms.push(performance.now() - a);
  }
  ms.sort((x, y) => x - y);
  return {tier: TIERS[t].name, pr: renderer.getPixelRatio(), shadow: TIERS[t].shadow, avg: ms.reduce((x, y) => x + y, 0) / n, p95: ms[Math.floor(n * 0.95)], gpu: gpuName()};
};
window.SIM = {model, state, tourAt, FIX, P, takeOver, setView, setGate, restart, advance, probe, bench, gpuName, TIERS, startTour, cursorAt: (c) => cursorAt(c),
  render, duration: TOUR, fps: FPS, ready: false, TOUR_EV};
