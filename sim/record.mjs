// Record the tour: SIM.render(t) is a pure function of t, so every frame is drawn on its own at 60 fps in headless
// Chrome (1600x900 layout x 1.2 = 1920x1080) and piped into ffmpeg as H.264, yuv420p (limited range, BT.709),
// +faststart. The same loop as the teardown kit's capture.mjs, with the colour range made explicit: the kit pipes
// full-range JPEG frames and its output came out yuvj420p.
//
//   node sim/record.mjs [--from 0] [--to 54] [--out teardown-out/sim-tour.mp4]
// Long tours can be recorded in parts (each part is a pure function of its own t) and joined with
//   ffmpeg -f concat -safe 0 -i list.txt -c copy -movflags +faststart teardown-out/sim-tour.mp4
// Needs the teardown skill (Chromium, ffmpeg paths): TEARDOWN_SKILL or ~/.claude/skills/teardown.
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const skill = process.env.TEARDOWN_SKILL || path.join(os.homedir(), '.claude', 'skills', 'teardown');
const {CHROMIUM_ARGS, FFMPEG, playwright} = await import(pathToFileURL(path.join(skill, 'paths.mjs')).href);
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const html = pathToFileURL(path.resolve('teardown-out/dist/sim.html')).href;
const out = path.resolve(opt('out', 'teardown-out/sim-tour.mp4'));
const {chromium} = playwright();
const browser = await chromium.launch({args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1.2});
await page.goto(html);
await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000}); // shaders warm, fonts in
const info = await page.evaluate(() => ({duration: SIM.duration, fps: SIM.fps}));
const fps = info.fps;
const from = Number(opt('from', 0));
const to = Number(opt('to', info.duration));
const frames = Math.round((to - from) * fps);
const ff = spawn(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-vf', 'scale=in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => SIM.render(t), from + i / fps); // frame i is t = from + i / fps, nothing else
  const buf = await page.screenshot({type: 'jpeg', quality: 97});
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\r${i}/${frames} frames  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`\r${frames}/${frames} frames  ${((Date.now() - t0) / 1000).toFixed(0)} s  -> ${out}  (ffmpeg exit ${code})`);
process.exit(code);
