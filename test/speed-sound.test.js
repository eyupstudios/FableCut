/* Speed in the Editor (Steve, 23 Nov 2026): "Fast renderer handles constant speed ... Ramps stay frame by frame";
   "Sound when speed changes: Normal pitch (default) / Deep / Mute, on the clip in Inspector"; "preview must sound
   the same as the export"; "Smooth slow-mo ... off by default, labelled 'slower to make', only on the slowed pieces,
   with the extra time shown on the Export window"; "Rename the 1x/1.5x/2x/4x monitor button to 'Preview speed'". */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Writable } = require("node:stream");
const C = require("../cuts-only");
const { createPeaks } = require("../peaks");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const DEFAULTS = (() => { const i = js.indexOf("const DEFAULT_PROPS = {"), j = js.indexOf("\n};", i);
  return new Function(js.slice(i, j + 3) + "; return DEFAULT_PROPS;")(); })();
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { windowsHide: true }).status === 0;

function edit(speedA = 1, speedB = 1, sound) {
  const props = (sp, extra) => ({ ...DEFAULTS, speed: sp, ...(sound ? { speedSound: sound } : {}), ...extra });
  const stem = (track, ch, start, inn, duration, sp) => ({ id: "a" + track + start, mediaId: "m", kind: "audio", track, start, in: inn, duration,
    linkGroup: "lg" + start, props: props(sp, { audioChannel: ch, pan: ch ? 1 : -1 }) });
  const pic = (start, inn, duration, sp) => ({ id: "v" + start, mediaId: "m", kind: "video", track: "V1", start, in: inn, duration,
    linkGroup: "lg" + start, props: props(sp, { volume: 0 }) });
  const A = [0, 100, 20, speedA], B = [20, 500, 10, speedB];
  return { name: "t", width: 1920, height: 1080, fps: 60, revision: 1, panSchema: 1,
    tracks: [{ id: "V1", kind: "video" }, { id: "A1", kind: "audio" }, { id: "A2", kind: "audio" }],
    media: [{ id: "m", name: "rec.mp4", kind: "video", src: "/media/rec.mp4", duration: 4000, width: 1920, height: 1080, audioChannels: 2 }],
    clips: [pic(...A), stem("A1", 0, ...A), stem("A2", 1, ...A), pic(...B), stem("A1", 0, ...B), stem("A2", 1, ...B)] };
}

test("a constant speed goes the fast way: each piece carries its speed and sound, in recording seconds", () => {
  assert.equal(DEFAULTS.speedSound, "normal");
  const r = C.plan(edit(0.5, 2, "deep"), DEFAULTS);
  assert.equal(r.ok, true, r.why.join(" | "));
  assert.deepEqual(r.pieces.map((p) => [p.in, p.out, p.at, p.speed, p.sound]), [[100, 110, 0, 0.5, "deep"], [500, 520, 20, 2, "deep"]]);
  assert.equal(r.duration, 30);
  assert.equal(C.plan(edit(0.5), DEFAULTS).pieces[0].sound, "normal");             // the default: normal pitch
  // IN-OUT inside a slowed piece: 10 s of edit at 0.5x = 5 s of recording
  const t = C.plan(edit(0.5, 2), DEFAULTS, { range: { start: 10, end: 25 } });
  assert.deepEqual(t.pieces.map((p) => [p.in, p.out, p.at]), [[105, 110, 10], [500, 510, 20]]);
  assert.equal(t.duration, 15);
  // smooth slow-mo costs only the slowed pieces' time
  assert.equal(C.slowedSeconds(r), 20);
  assert.ok(Math.abs(C.smoothExtraSeconds(r, 60, 1080) - 20 * C.SMOOTH_X) < 1e-9);
  assert.equal(C.slowedSeconds(C.plan(edit(1, 2), DEFAULTS)), 0);
});

test("still frame by frame: a ramp, a speed out of range, a picture and its sound at different speeds or sounds", () => {
  const no = (change, word) => { const p = edit(0.5); change(p); const r = C.plan(p, DEFAULTS);
    assert.equal(r.ok, false, word); assert.ok(r.why.join(" | ").includes(word), r.why.join(" | ")); };
  no((p) => { p.clips[0].keyframes = { speed: [{ t: 0, v: 1 }, { t: 5, v: 0.5 }] }; }, "keyframes");
  no((p) => { for (const c of p.clips.slice(0, 3)) c.props.speed = 0.2; }, "0.2x");
  no((p) => { p.clips[1].props.speed = 1; }, "sound");
  no((p) => { p.clips[2].props.speedSound = "mute"; }, "sound");
});

function wavFrom(buf) {                                   // [samples of channel 0, rate, channels]
  const ch = buf.readUInt16LE(22), rate = buf.readUInt32LE(24);
  let i = 12;
  while (i < buf.length - 8 && buf.toString("ascii", i, i + 4) !== "data") i += 8 + buf.readUInt32LE(i + 4);
  const data = buf.subarray(i + 8);
  const n = Math.floor(data.length / 2 / ch), x = new Float64Array(n);
  for (let k = 0; k < n; k++) x[k] = data.readInt16LE(k * 2 * ch) / 32768;
  return [x, rate, ch];
}
const crossings = (x) => { let n = 0; for (let k = 1; k < x.length; k++) if ((x[k - 1] < 0) !== (x[k] < 0)) n++; return n; };

test("normal pitch for the export: the stretch is the right length, every channel kept, the pitch unchanged", { skip: !hasFfmpeg && "no ffmpeg" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-stretch-"));
  const file = path.join(dir, "tone.wav");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=440:d=6:sample_rate=48000", "-ac", "2", file], { windowsHide: true });
  assert.equal(r.status, 0, String(r.stderr));
  const pk = createPeaks({ dir: path.join(dir, "peaks"), resolveSrc: (s) => (s === "/media/tone.wav" ? file : null), probe: async () => ({}) });
  assert.equal(pk.tempoChain(0.25), "atempo=0.5,atempo=0.500000");
  assert.equal(pk.tempoChain(4), "atempo=2.0,atempo=2.000000");
  const get = (from, len, speed, src = "/media/tone.wav") => new Promise((done) => {
    const parts = []; let code = 0;
    const res = new Writable({ write(c, _e, cb) { parts.push(c); cb(); } });
    res.writeHead = (c) => { code = c; };
    res.on("finish", () => done([code, Buffer.concat(parts)]));
    pk.streamStretch(src, from, len, speed, res);
  });
  for (const [speed, seconds] of [[0.5, 4], [2, 1], [0.25, 8]]) {
    const [code, buf] = await get(1, 2, speed);
    assert.equal(code, 200);
    const [x, rate, ch] = wavFrom(buf);
    assert.equal(ch, 2);
    assert.ok(Math.abs(x.length / rate - seconds) < 0.06, `${speed}x: ${x.length / rate} s`);
    const mid = x.subarray(Math.floor(0.2 * rate), x.length - Math.floor(0.2 * rate));
    const hz = crossings(mid) / 2 / (mid.length / rate);
    assert.ok(Math.abs(hz - 440) < 440 * 0.03, `${speed}x: ${hz} Hz`);
  }
  assert.equal((await get(1, 2, 8))[0], 400);
  assert.equal((await get(1, 2, 0.5, "/media/missing.wav"))[0], 404);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the Editor: the sound choice in the Inspector, preview like export, Smooth slow-mo, Preview speed", () => {
  // Inspector, under Speed; the linked stems share it
  assert.ok(js.includes('row("Sound when sped up or slowed", `<select data-k="speedSound"'));
  assert.ok(js.includes('[["normal", "Normal pitch"], ["deep", "Deep (like tape)"], ["mute", "Mute"]]'));
  assert.ok(/k === "speedSound"\) \{[^}]*withLinked\(\[c\]\)/.test(js));
  const sync = js.indexOf("function syncLinkedTiming");
  assert.ok(js.slice(sync, sync + 500).includes("L.props.speedSound = c.props.speedSound"));
  // preview: deep turns pitch keeping off, mute silences, normal keeps the pitch
  const at = js.indexOf("const how = speedChanged(c) ? clipSpeedSound(c)");
  const pv = js.slice(at, at + 900);
  for (const need of ["el.preservesPitch = keep", 'how === "deep"', 'how === "mute" ? { ...p, volume: 0 }']) assert.ok(pv.includes(need), need);
  // export mix: normal = the stretched sound at rate 1, mute left out, deep played faster / slower as before
  const mix = js.slice(js.indexOf("async function renderAudioMix"), js.indexOf("// Effect automation: step the offline render"));
  for (const need of ['clipSpeedSound(c) === "mute") continue', "getStretchBuffer(m, c)", "} else if (stretched) {",
    "src.start(mixWhen, Math.max(0, local0), mixDur);", "src.playbackRate.value = sp;"])
    assert.ok(mix.includes(need), need);
  assert.ok(js.includes("/api/audio/stretch?src="));
  // Export window: off by default, says it is slower, only when something is slowed, with the extra minutes
  assert.ok(/<input type="checkbox" id="xsSmooth">\s*Smooth slow-mo <span class="dim">\(slower to make\)<\/span>/.test(html));
  assert.ok(!/id="xsSmooth"[^>]*checked/.test(html) && html.includes('id="xsSmoothRow" hidden'));
  const fr = js.slice(js.indexOf("function fastRenderChoice()"), js.indexOf("/** Seconds one frame took"));
  for (const need of ['$("xsSmoothRow").hidden = !(slowed > 0)', "CutsOnly.smoothExtraSeconds(plan", "min extra to make",
    "smooth: !!choice.smooth", 'sound: p.sound || "normal"', "speed: p.speed || 1"])
    assert.ok(fr.includes(need), need);
  // the monitor button
  assert.ok(/id="btnSpeed"[^>]*><span class="btn-cap">Preview speed<\/span> <span id="btnSpeedRate">1×<\/span><\/button>/.test(html));
  assert.ok(js.includes('const rate = $("btnSpeedRate") || els.btnSpeed;'));
});
