// Timbangan carbon: dial spring scale (30 kg, one turn of the needle) with the widened tray and its safety rails.
// Pure numbers, no three.js. One input: stroke s in 0..1 = how full the crate is (carbon level 0 -> fillH).
// Every part, panel and label on the page reads from model(s). Units: mm, kg, N, degrees.
//
// Where each number comes from (S = seen in the photos, E = estimated from photo pixels, A = assumed, not measured).
// ANCHOR is the one length every E-number scales from. Measure the dial glass and change ANCHOR; all E parts follow.
export const ANCHOR = 260; // A  dial bezel outer diameter. NOT measured. Measure it with a tape and put the real value here.
const r = (k) => Math.round(k * ANCHOR); // E  ratio measured in pixels against the dial glass

const PALLET_W = 520; // S  the pallet (crate), measured: 52 cm long
const PALLET_D = 240; // S  24 cm wide
const TRAY_CLR = 20; // A  room left round the pallet inside the new tray's rails
export const P = {
  // the scale (Nhon Hoa-style dial spring scale)
  cap: 30, // S  dial reads 0..30 kg in one turn (numbers 1..29 around the face, 30 at the top)
  div: 0.1, // A  smallest division 100 g (typical for 30 kg; not readable in the photo)
  dialD: ANCHOR, // A  see ANCHOR
  fsTravel: 8, // A  platform travel at full scale, mm (typical for this class of dial scale)
  pinionM: 0.4, // A  pinion module, mm
  pinionZ: 20, // A  pinion teeth
  springs: 2, // A  two tension springs in parallel
  scaleH: r(1.12), // E  stand top -> underside of the tray: base 15 + bezel 260 + gap (render: 425 px vs bezel 418 px)
  baseT: 15, // E  green base plate
  baseW: r(1.15), // E  green base, across
  baseD: r(1.25), // E  green base, front to back
  // the original pan
  oldW: 250, // S  measured by the plant: 25 x 25 cm
  oldD: 250, // S
  oldRim: 15, // A  folded rim
  // the widened tray: the pallet plus a little room all round, so it goes in and out without catching
  trayClr: TRAY_CLR, // A  free room each side ("sedikit longgar")
  trayW: PALLET_W + 2 * TRAY_CLR, // S + A  520 + 2 x 20 = 560 mm
  trayD: PALLET_D + 2 * TRAY_CLR, // S + A  240 + 2 x 20 = 280 mm
  railH: 50, // E  rail height on back, left, right (render: about 1/5 of the dial)
  lipH: 15, // E  front edge folded down; the front stays open for loading
  sheetT: 1.0, // A  stainless 304 sheet thickness, mm
  rhoSS: 7930, // S  density of stainless 304, kg/m3 (handbook)
  // the crate (green PP tray "TMMIN PPC CASTING")
  crateW: PALLET_W, // S  measured by the plant: 52 x 24 cm
  crateD: PALLET_D, // S
  crateH: 120, // A
  crateWall: 20, // A  wall + rib depth per side -> inner 480 x 200
  crateM: 1.8, // A  empty PP crate, kg
  // the carbon (granular recarburizer, the black grains on the floor)
  rhoBulk: 0.75, // A  bulk density, kg/L (calcined petroleum coke / graphite granules: 0.6..0.9)
  fillH: 100, // A  fill level at stroke 1: 10 mm under the crate's inner height of 110
  // the stand (perforated stainless table) and the hopper frame
  standW: r(2.3), // E  598 mm
  standD: r(2.1), // E  546 mm
  standH: r(1.1), // E  286 mm
  holeD: 25, // E  perforation diameter
  holeP: 62, // E  perforation pitch
  hopperGap: 220, // E  outlet above the tray floor (render: about 0.85 dial); must clear the crate
  // the carbon box (photo box-carbon.jpg: dial 220 px across). One stainless box, two compartments: FCD left, FC right.
  // The gates sit straight on the box front, no chute in front of it; so the scale stands back under the box front edge.
  // The box is further from the camera than the dial, so these may read a little small.
  boxW: r(4.22), // E  1097 mm (928 px)
  boxH: r(2.55), // E  663 mm (560 px)
  boxD: 450, // A  depth cannot be read off a front photo
  gateW: r(1.45), // E  377 mm, both gates side by side on the box front
  gateH: r(0.86), // E  224 mm
  funnelD: 160, // A  funnel top, front to back; its front is flush with the box front
  funnelH: r(0.45), // E  117 mm, the two funnel outlets under the box
  pourX: r(0.39), // E  101 mm, each outlet left/right of the dial centre (85 px); FCD (left) is the one pouring
  gateLift: 80, // A  the gate is pulled UP this far to pour
  boxFill0: 400, // A  carbon level in each compartment before this crate
  shelfW: r(1.27), // E  side shelf, front left
  // the old pan falling (seen by the operators: pan and crate fall at about 5 kg of carbon)
  tipKg: 5, // S  the operators' number
  // A  the spider the pan rests on; its pins are the edge the pan rocks over. 15 mm put its arms into the dial bezel
  //    (gap 291 - 15 - 275 = 1 mm, then -4 mm with a full crate). At 8 mm the gap is 8 mm = fsTravel: the spider
  //    only meets the bezel at full scale, like a travel stop.
  spiderT: 8,
  flow: 1.0, // A  gate flow, kg/s. The pour is the only clock: time since the tip = extra kg / flow
  tipT: 0.3, // A  time to rock over the pin before the load slides off it
  tilt1: 12, // A  deg, rocked over the pin; more and the far end of the crate meets the FC funnel
  tiltF: 40, // A  deg, at rest: the crate's left end on the floor, the pan leaning on the stand's edge
  dzF: 350, // A  mm it slides toward the operator while falling, which takes it past the frame's front-left leg
  repose: 35, // A  angle of repose of the spilled carbon, deg
  g: 9.81,
};

// ------------------------------------------------------------ fixed numbers (no stroke in them)
/** mass in kg of a stainless sheet part from its area in mm2 */
const sheet = (areaMm2) => areaMm2 * 1e-6 * (P.sheetT / 1000) * P.rhoSS;
export const FIX = (() => {
  const trayArea = P.trayW * P.trayD + P.trayW * P.railH + 2 * P.trayD * P.railH + P.trayW * P.lipH;
  const oldArea = P.oldW * P.oldD + 2 * (P.oldW + P.oldD) * P.oldRim;
  const trayM = sheet(trayArea);
  const oldM = sheet(oldArea);
  const dead = trayM - oldM; // the factory zero already carries the old pan
  const inW = P.crateW - 2 * P.crateWall;
  const inD = P.crateD - 2 * P.crateWall;
  const inH = P.crateH - P.crateWall / 2;
  const fillL = (inW * inD * P.fillH) / 1e6; // litres at stroke 1
  const k = (P.cap * P.g) / P.fsTravel; // N/mm, both springs together
  const pitchC = Math.PI * P.pinionM * P.pinionZ; // rack travel for one turn of the needle
  const lever = pitchC / P.fsTravel; // platform mm -> rack mm
  // support under the crate: overlap of the crate footprint with the pan / tray, both centred
  const cover = (w, d) => (Math.min(w, P.crateW) * Math.min(d, P.crateD)) / (P.crateW * P.crateD);
  // the old pan rests loose on the spider pins at +-spiderA. Carbon lands under the FCD outlet, pourX left of centre.
  // It tips when the carbon's moment beats the pan + crate: tipKg.pourX = spiderA.(oldM + crateM + tipKg).
  // spiderA is not visible in the photos, so it is back-solved from the operators' 5 kg.
  const spiderA = (P.tipKg * P.pourX) / (P.tipKg + oldM + P.crateM);
  // the same pins under the new tray, if it were only laid on and not bolted: m.pourX = spiderA.(trayM + crateM + m)
  const tipNewLoose = (spiderA * (trayM + P.crateM)) / (P.pourX - spiderA);
  // where it comes to rest, tiltF over: the crate's left end on the floor, the pan's underside
  // on the stand's left edge. Solve for the pin: pinY = (crateW/2 - spiderA).sin, pinX = edge - (standH - pinY) / tan
  const t = P.tiltF * (Math.PI / 180);
  const pinY = (P.crateW / 2 - spiderA) * Math.sin(t); // its left end lands outside the drip tray, on the floor
  const pinX = -P.standW / 2 - (P.standH - pinY) / Math.tan(t);
  const dxF = pinX + spiderA; // the pin starts at -spiderA
  const dyF = P.standH + P.scaleH - pinY; // and at the tray height
  const fallT = P.tipT + Math.sqrt((2 * dyF) / 1000 / P.g); // rock, then free fall of the pin
  const compA = (P.boxW / 2) * P.boxD; // one compartment, plan area mm2
  return {
    spiderA, tipNewLoose, dxF, dyF, fallT, compA,
    boxDrop: (((P.crateW - 2 * P.crateWall) * (P.crateD - 2 * P.crateWall) * P.fillH) / compA),
    trayArea, trayM, oldM, dead, usable: P.cap - dead,
    inW, inD, inH, fillL, carbonMax: fillL * P.rhoBulk,
    k, kEach: k / P.springs, pitchD: P.pinionM * P.pinionZ, pitchC, lever,
    coverOld: cover(P.oldW, P.oldD), coverNew: cover(P.trayW, P.trayD),
    overhangW: Math.max(0, (P.crateW - P.oldW) / 2), overhangD: Math.max(0, (P.crateD - P.oldD) / 2),
    // how far the crate's centre may sit off the middle before it tips off the old pan (the short way)
    tipOld: P.oldD / 2,
    // how far the crate can slide before a rail stops it on the new tray (left/right, back); the front is open
    slideX: (P.trayW - P.crateW) / 2, slideBack: P.trayD - P.crateD,
    clearance: P.hopperGap - P.crateH, // outlet above the crate rim
  };
})();

// ------------------------------------------------------------ the one function of stroke
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const D2R = Math.PI / 180;
const SHUT = {fcd: 0, fc: 0};
/**
 * everything that moves or reads out, from stroke s (0..1) = carbon let out of the gates, 0..carbonMax kg.
 * Settings, not inputs: tray 'new' (wide, bolted) or 'old' (small pan, loose on the spider); src = which gates the
 * carbon came from {fcd, fc}; open = which gates are up right now (default: src while the crate is filling).
 */
export function model(s, tray = 'new', src = {fcd: 1, fc: 0}, open = null) {
  s = clamp01(s);
  const old = tray === 'old';
  const poured = s * FIX.carbonMax; // kg out of the gates
  const op = open ?? (s > 0 && s < 1 ? src : SHUT);
  // where the carbon lands: under the FCD outlet (x = -pourX), the FC outlet (+pourX), or split between both
  const nF = src.fcd ? 1 : 0;
  const nC = src.fc ? 1 : 0;
  const n = nF + nC || 1;
  const xbar = (P.pourX * (nC - nF)) / n;
  const side = xbar > 0 ? 1 : -1; // the old pan goes over the pin on the carbon's side
  const ax = Math.abs(xbar);
  // tip when carbon.|xbar| = spiderA.(oldM + crateM + carbon). FCD alone gives back the operators' 5 kg;
  // both gates put the carbon over the middle and the pan never tips.
  const tipKg = ax > FIX.spiderA ? (FIX.spiderA * (FIX.oldM + P.crateM)) / (ax - FIX.spiderA) : Infinity;
  // the fall, old pan only. Time since the tip comes from the pour itself: (poured - tipKg) / flow.
  const tf = old ? Math.max(0, (poured - tipKg) / P.flow) : 0;
  const tipped = old && poured >= tipKg;
  // u: 0 while it rocks on the pin, then 0..1 through the free fall (drop ~ t^2)
  const u = tipped && tf > P.tipT ? Math.min(1, (tf - P.tipT) / (FIX.fallT - P.tipT)) : 0;
  const tilt = !tipped ? 0 : tf < P.tipT ? P.tilt1 * (tf / P.tipT) ** 2 : P.tilt1 + (P.tiltF - P.tilt1) * u;
  const dx = FIX.dxF * u;
  const dy = FIX.dyF * u * u;
  // forward at a steady 2 m/s from the moment it slides off (like dx), all the way before its left end reaches the
  // frame leg at u = 0.6. An eased start here made it leap 75 mm in one frame.
  const dz = P.dzF * Math.min(1, u / 0.6);
  // while it rocks the pan still bears on the pin, which is the spider: the dial keeps the whole load until it slides off
  const on = tipped ? 1 - Math.min(1, u / 0.1) : 1; // share of the load still on the spider
  // the stream still lands in the crate while it rocks; once it slides off the pin what is in it empties out
  const slideKg = tipKg + P.tipT * P.flow;
  const inCrate = tipped && u > 0 ? slideKg * (1 - u) : poured;
  const spilled = poured - inCrate;
  const L = inCrate / P.rhoBulk; // litres in the crate
  const h = (L * 1e6) / (FIX.inW * FIX.inD); // level, mm
  // the scale. The factory zero carries the old pan; the zero knob re-zeroes for the new tray by shifting the rack.
  const panM = old ? FIX.oldM : FIX.trayM;
  const load = (panM + P.crateM + inCrate) * on; // kg on the spider
  const reading = load - panM; // goes below 0 once the pan itself has fallen off
  const spring = load - FIX.oldM; // kg on the springs above the factory zero
  const force = spring * P.g; // N on the springs above the factory zero
  const defl = force / FIX.k; // platform drop from the factory zero, mm
  const rackAbs = FIX.lever * defl; // rack travel from the factory zero, mm
  const zeroShift = FIX.lever * (((panM - FIX.oldM) * P.g) / FIX.k); // the zero knob slides the rack this far up
  const rack = rackAbs - zeroShift; // past the zeroed needle: 0 at the top of the face
  const needle = (rack / FIX.pitchC) * 360; // deg clockwise from 0, through the pinion
  // the moment that tips the pan over its pin, N.m: carbon's arm against pan + crate + carbon on the pin's arm
  // (as if the pan were loose; > 0 means it goes over). Counted on the carbon still poured onto the pan.
  const moment = (P.g * (poured * ax - FIX.spiderA * (panM + P.crateM + poured))) / 1000;
  const lvl = (share) => P.boxFill0 - ((poured * share) / P.rhoBulk) * 1e6 / FIX.compA;
  const spillV = (spilled / P.rhoBulk) * 1e6; // mm3
  const spillR = Math.cbrt((3 * spillV) / (Math.PI * Math.tan(P.repose * D2R))); // a cone at the angle of repose
  return {
    s, tray, poured, h, L, carbon: inCrate, reading, spring, force, defl, rackAbs, zeroShift, rack, needle,
    used: reading / (P.cap - (panM - FIX.oldM)), // share of the usable range
    perSpring: force / P.springs, // pull per spring above the factory zero
    tipped, tf, fall: u, on, tilt, dx, dy, dz, spilled, spillR, spillH: spillR * Math.tan(P.repose * D2R),
    xbar, side, tipKg, moment,
    pourF: s < 1 ? +op.fcd || 0 : 0, // a stream under each gate, as open as the gate, until the crate is full
    pourC: s < 1 ? +op.fc || 0 : 0,
    pour: s < 1 && (op.fcd || op.fc) ? 1 : 0,
    gate: (+op.fcd || 0) * P.gateLift, // FCD gate lift, mm (op may be part-way, 0..1)
    gateFC: (+op.fc || 0) * P.gateLift,
    boxLevel: lvl(nF / n), // FCD compartment level, mm
    boxLevelFC: lvl(nC / n),
    phase: s * 60, // grains in the stream fall by s, so a still slider is a still stream
  };
}

// ------------------------------------------------------------ cost of carbon lost to spills
// S  price per kg (Rp), from the plant. A shift is 2 per day; 22 working days a month.
export const PRICES = {'JG-01': 17500, 'SG-3': 19200, 'GRAPH HEX-99': 18950, HCMA: 17950};
export const SHIFTS = 2;
export const DAYS = [1, 7, 22, 30]; // 22 = one month of working days; 7 and 30 count every day as worked
/** kg spilled and its cost over a period: kgShift x SHIFTS x days, x price */
export function cost(kgShift, days, type) {
  const kg = kgShift * SHIFTS * days;
  return {kg, rp: kg * PRICES[type], perShift: kgShift * PRICES[type]};
}
