// Hand check of the model: every expected value below was worked out on paper, not copied from model.js.
// node sim/check.mjs  -> prints the table, throws on the first mismatch.
import {cost, FIX, model, P, PRICES} from './model.js';

const near = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? 'ok ' : 'BAD'}  ${name.padEnd(46)} ${got.toFixed(3).padStart(9)}   hand: ${want}`);
  if (!ok) throw new Error(name);
};

// sizes measured at the plant: old pan 25 x 25 cm, pallet 52 x 24 cm. The new tray is the pallet + 20 mm all round.
near('old pan (measured, mm)', P.oldW * 1000 + P.oldD, 250250, 0);
near('pallet (measured, mm)', P.crateW * 1000 + P.crateD, 520240, 0);
near('new tray width 520 + 2 x 20 (mm)', P.trayW, 560, 0);
near('new tray depth 240 + 2 x 20 (mm)', P.trayD, 280, 0);
// 1. pinion: pi x 0.4 x 20 = 25.133 mm of rack per needle turn; lever 25.133 / 8 = 3.1416
near('rack per turn pi.m.z (mm)', FIX.pitchC, 25.133, 0.001);
near('lever ratio (rack/platform)', FIX.lever, 3.1416, 0.0001);
// 2. springs: 30 x 9.81 / 8 = 36.79 N/mm together, 18.39 each
near('spring rate k (N/mm)', FIX.k, 36.79, 0.01);
near('per spring (N/mm)', FIX.kEach, 18.39, 0.01);
// 3. tray: 560x280 + 560x50 + 2x280x50 + 560x15 = 156800+28000+28000+8400 = 221200 mm2
//    x 1 mm x 7930 kg/m3 = 1.754 kg. old pan: 250x250 + 2x(250+250)x15 = 62500+15000 = 77500 mm2 -> 0.615 kg
near('tray sheet area (mm2)', FIX.trayArea, 221200, 1);
near('tray mass (kg)', FIX.trayM, 1.754, 0.001);
near('old pan mass (kg)', FIX.oldM, 0.615, 0.001);
//    extra dead load 1.754 - 0.615 = 1.140 kg, usable 30 - 1.140 = 28.860 kg
near('extra dead load (kg)', FIX.dead, 1.140, 0.001);
near('usable range 30 - dead (kg)', FIX.usable, 28.860, 0.001);
// 4. full pallet: inside 480 x 200 x 100 = 9.6 L x 0.75 = 7.2 kg carbon; dial 1.8 + 7.2 = 9.0 kg
const m1 = model(1);
near('carbon at s=1 (kg)', m1.carbon, 7.2, 0.001);
near('dial at s=1 (kg)', m1.reading, 9.0, 0.001);
//    needle 9.0 / 30 x 360 = 108.0 deg. through the chain: drop (1.140 + 9.0) x 9.81 / 36.79 = 2.704 mm,
//    rack 3.1416 x (2.704 - 0.304) = 7.540 mm, 7.540 / 25.133 x 360 = 108.0 deg  (same number two ways)
near('needle at s=1 (deg)', m1.needle, 108.0, 0.01);
near('platform drop at s=1 (mm)', m1.defl, 2.704, 0.001);
// 5. empty pallet s=0: 1.8 kg -> 21.6 deg; half: 3.6 kg carbon, 5.4 kg on the dial, 64.8 deg
near('needle at s=0 (deg)', model(0).needle, 21.6, 0.01);
near('needle at s=0.5 (deg)', model(0.5).needle, 64.8, 0.01);
// 6. support under the pallet: old 250 x 240 / (520 x 240) = 60000 / 124800 = 48.1 %; new tray 100 %
near('old pan supports (%)', FIX.coverOld * 100, 48.08, 0.01);
near('new tray supports (%)', FIX.coverNew * 100, 100, 0);
//    (520 - 250) / 2 = 135 mm hangs off each end of the old pan; across, 240 < 250 so none
near('pallet overhang each end, old (mm)', FIX.overhangW, 135, 0);
near('pallet overhang across, old (mm)', FIX.overhangD, 0, 0);
near('free slide to a rail, new (mm)', FIX.slideX, 20, 0);
near('hopper outlet above pallet rim (mm)', FIX.clearance, 100, 0);
// 7. old pan falls at 5 kg. pourX 0.39 x 260 = 101 mm. Spider pin back-solved: 5 x 101 / (5 + 0.615 + 1.8) = 505 / 7.415 = 68.11 mm
near('pour offset of the FCD outlet (mm)', P.pourX, 101, 0);
near('spider pin half-span, back-solved (mm)', FIX.spiderA, 68.11, 0.01);
//    the same pins under a LOOSE new tray: 68.11 x (1.754 + 1.8) / (101 - 68.11) = 242.06 / 32.89 = 7.36 kg,
//    just above a full pallet (7.2 kg): a loose tray would hold, by 0.16 kg. It is bolted anyway.
near('loose new tray would tip at (kg)', FIX.tipNewLoose, 7.36, 0.01);
//    just before the tip the dial reads 1.8 + 4.99 = 6.79 kg; after it the pan is gone: -0.615 kg -> -7.37 deg
near('old pan, 4.99 kg poured, dial (kg)', model(4.99 / 7.2, 'old').reading, 6.79, 0.001);
near('old pan, full pour, dial (kg)', model(1, 'old').reading, -0.615, 0.001);
near('old pan, full pour, needle (deg)', model(1, 'old').needle, -7.37, 0.01);
//    at rest, 40 deg, left end on the floor: pin y = (260 - 68.11) sin40 = 191.89 x 0.6428 = 123.35;
//    pin x = -299 - (286 - 123.35) / tan40 = -299 - 193.84 = -492.84, so the pin moves -492.84 + 68.11 = -424.73
//    and drops 577 - 123.35 = 453.65 mm; fall time 0.3 + sqrt(2 x 0.45365 / 9.81) = 0.3 + 0.3041 = 0.604 s
near('pin moves left (mm)', FIX.dxF, -424.73, 0.05);
near('pin drops (mm)', FIX.dyF, 453.65, 0.05);
near('fall time (s)', FIX.fallT, 0.604, 0.001);
//    0.2 s after the tip (5.2 kg poured) it is still rocking on the pin, so the dial still reads it all: 1.8 + 5.2 = 7.0 kg
near('old pan rocking on the pin, dial (kg)', model(5.2 / 7.2, 'old').reading, 7.0, 0.001);
// 11. clearances. The spider's underside over the dial bezel top: scaleH - spiderT - (baseT + dialD) = 291 - 8 - 275 = 8 mm
//     at the factory zero = the full-scale travel, so it touches only at 30 kg on the springs. With the full pallet on
//     the new tray the platform is down 2.70 mm: 8 - 2.70 = 5.30 mm left.
near('spider over the bezel at zero (mm)', P.scaleH - P.spiderT - (P.baseT + P.dialD), 8, 0);
near('spider over the bezel, full pallet (mm)', P.scaleH - P.spiderT - (P.baseT + P.dialD) - model(1).defl, 5.30, 0.01);
//    all 7.2 kg on the floor: 9.6 L as a 35 deg cone, r = cbrt(3 x 9.6e6 / (pi x 0.7002)) = cbrt(13.09e6) = 235.7 mm
near('spill cone radius, full pour (mm)', model(1, 'old').spillR, 235.7, 0.1);
near('no tip on the new tray (spilled kg)', model(1).spilled, 0, 0);
// 8. box: one compartment 1097/2 x 450 = 246825 mm2; a full pallet takes 9.6e6 / 246825 = 38.89 mm off the FCD level
near('FCD level drop per pallet (mm)', FIX.boxDrop, 38.89, 0.01);
near('needle at s=1 via the zero-knob rack shift (deg)', model(1).needle, 108.0, 0.01);
// the needle never runs past what the springs can travel
if (m1.reading > FIX.usable) throw new Error('over range');
console.log('\nall checks pass');
// 9. cost: 1 kg/shift x 2 x 22 = 44 kg x 17,500 = Rp 770,000; 5 x 2 x 30 = 300 kg x 19,200 = Rp 5,760,000;
//    0.1 x 2 x 1 = 0.2 kg x 18,950 = Rp 3,790; the full old-pan spill 7.2 kg x 17,950 = Rp 129,240
near('cost JG-01, 1 kg/shift, 22 days (Rp)', cost(1, 22, 'JG-01').rp, 770000, 0.01);
near('cost SG-3, 5 kg/shift, 30 days (Rp)', cost(5, 30, 'SG-3').rp, 5760000, 0.01);
near('cost GRAPH HEX-99, 0.1 kg/shift, 1 day (Rp)', cost(0.1, 1, 'GRAPH HEX-99').rp, 3790, 0.01);
near('one old-pan spill of HCMA (Rp)', model(1, 'old').spilled * PRICES.HCMA, 129240, 0.5);
console.log('\nall cost checks pass');
// 10. the gates. FC alone mirrors FCD: tips at the same 5 kg, to the right. Both open: carbon over the middle,
//     xbar = 0 < spiderA, so the old pan never tips and reads 1.8 + 7.2 = 9.0 kg like the new tray.
const FC = {fcd: 0, fc: 1};
const BOTH = {fcd: 1, fc: 1};
near('FC alone: tip mass (kg)', model(0.5, 'old', FC).tipKg, 5, 0.001);
near('FC alone: falls to the right (side)', model(1, 'old', FC).side, 1, 0);
near('both gates: old pan, full, dial (kg)', model(1, 'old', BOTH).reading, 9.0, 0.001);
near('both gates: nothing spilled (kg)', model(1, 'old', BOTH).spilled, 0, 0);
//     tipping moment, old pan, FCD: empty pallet 9.81 x (0 - 68.11 x 2.415) / 1000 = -1.613 N.m; at 5 kg: 9.81 x (505 - 505) = 0
near('tip moment, old pan, empty (N.m)', model(0, 'old').moment, -1.613, 0.001);
near('tip moment, old pan, 4.999 kg (N.m)', model(4.999 / 7.2, 'old').moment, 0, 0.001);
//     both gates drain each compartment by half: 38.89 / 2 = 19.45 mm -> 400 - 19.45 = 380.55 mm
near('both gates: FCD level after a full pallet (mm)', model(1, 'new', BOTH).boxLevel, 380.55, 0.01);
near('both gates: FC level after a full pallet (mm)', model(1, 'new', BOTH).boxLevelFC, 380.55, 0.01);
console.log('\nall gate checks pass');
