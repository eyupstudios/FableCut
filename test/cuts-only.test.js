/* "Only cuts of recordings?" (cuts-only.js, 22 Nov 2026): the check that sends an export to Create Summat's fast
   renderer. Every doubt must be a "no" with its reason: a wrong "yes" would render a video without the title, the
   effect or the sound change that was made. The base case is Steve's real edit of 22 Nov (two cuts of one stream). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../cuts-only");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const DEFAULTS = (() => { const i = js.indexOf("const DEFAULT_PROPS = {"), j = js.indexOf("\n};", i);
  return new Function(js.slice(i, j + 3) + "; return DEFAULT_PROPS;")(); })();
const MEDIA = "2026-11-20_v2934732880_GTA 6.mp4";

function edit() {
  const stem = (track, ch, start, inn, duration) => ({ id: "a" + track + start, mediaId: "m", kind: "audio", track, start, in: inn, duration,
    name: "x", linkGroup: "lg" + start, props: { ...DEFAULTS, audioChannel: ch, pan: ch ? 1 : -1 } });
  const pic = (start, inn, duration) => ({ id: "v" + start, mediaId: "m", kind: "video", track: "V1", start, in: inn, duration, name: "x",
    linkGroup: "lg" + start, props: { ...DEFAULTS, volume: 0 } });
  const A = [0, 0, 4217.1332666666995], B = [4217.1332666666995, 4333.1667, 131.6251];
  return { name: "Part 3", width: 1920, height: 1080, fps: 60, background: "#000000", revision: 149, panSchema: 1, folders: [], markers: [],
    inPoint: null, outPoint: null, disabledTracks: [],
    tracks: ["V3", "V2", "V1"].map((id) => ({ id, kind: "video" })).concat(["A1", "A2", "A3", "A4"].map((id) => ({ id, kind: "audio" }))),
    media: [{ id: "m", name: MEDIA, kind: "video", src: "/media/" + encodeURIComponent(MEDIA), duration: 4475.8, width: 1920, height: 1080, audioChannels: 2 }],
    clips: [pic(...A), stem("A1", 0, ...A), stem("A2", 1, ...A), pic(...B), stem("A1", 0, ...B), stem("A2", 1, ...B)] };
}
const no = (change, word) => { const p = edit(); change(p); const r = C.plan(p, DEFAULTS);
  assert.equal(r.ok, false, word); assert.deepEqual(r.pieces, []); assert.ok(r.why.join(" | ").includes(word), `${word}: ${r.why.join(" | ")}`); };

test("two cuts of one stream with their own sound: yes, with the cuts in recording time", () => {
  const r = C.plan(edit(), DEFAULTS);
  assert.equal(r.ok, true, r.why.join(" | "));
  assert.deepEqual(r.pieces.map((p) => [p.file, p.in, +p.out.toFixed(4), p.at]),
    [[MEDIA, 0, 4217.1333, 0], [MEDIA, 4333.1667, 4464.7918, 4217.1332666666995]]);
  assert.ok(Math.abs(r.duration - 4348.7584) < 0.001 && r.fps === 60);
  assert.equal(C.describe(r, true).fast, true);
  assert.equal(C.describe(r, false).fast, false);                       // outside Create Summat there is no fast renderer
});

test("anything that is not a plain cut is a no, and it says why", () => {
  no((p) => p.clips.push({ id: "t", kind: "text", track: "V2", start: 5, duration: 4, props: { ...DEFAULTS, text: "PART 3" } }), "title");
  no((p) => { p.clips[0].keyframes = { opacity: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }; }, "animated");
  no((p) => { p.clips[3].transitionIn = { type: "fade", duration: 1 }; }, "transition");
  no((p) => { p.clips[0].props.speed = 2; }, "sound");                     // the picture sped up, its sound not: out of step
  no((p) => { p.clips[0].props.brightness = 120; }, "brightness");
  no((p) => { p.clips[0].props.scale = 1.2; }, "scale");
  no((p) => { p.clips[0].props.cropL = 10; }, "cropL");
  no((p) => { p.clips[0].props.filterPreset = "noir"; }, "filterPreset");
  no((p) => { p.clips[0].props.somethingNew = 3; }, "somethingNew");      // a property this check has never heard of
  no((p) => { p.clips[3].start += 2; p.clips[4].start += 2; p.clips[5].start += 2; }, "gap");
  no((p) => { p.clips[3].start -= 2; p.clips[4].start -= 2; p.clips[5].start -= 2; }, "overlap");
  no((p) => { p.clips[3].track = "V2"; }, "more than one track");
  no((p) => { p.clips.push({ ...p.clips[0], id: "v2", track: "V2", start: 10, duration: 5 }); }, "more than one track");
  no((p) => { p.media[0].kind = "image"; }, "not a recording");
  no((p) => { p.media[0].width = 1080; p.media[0].height = 1920; }, "different shape");
  no((p) => { p.exportFrame = { x: 0, y: 0, w: 100, h: 100 }; }, "exportFrame");
  no((p) => { p.clips = []; }, "nothing on the timeline");
});

test("the sound must be the recording's own, untouched", () => {
  no((p) => { p.clips[1].props.volume = 0.5; }, "sound");
  no((p) => { p.clips[1].props.pan = 0; }, "sound");
  no((p) => { p.clips[2].props.gain = 6; }, "sound");
  no((p) => { p.clips.splice(1, 1); }, "sound");                          // one side removed
  no((p) => { p.clips[1].start += 3; }, "sound");                         // moved off its picture
  no((p) => { p.clips[0].props.volume = 1; }, "sound");                   // the picture clip plays its sound as well: twice as loud
  no((p) => { p.clips[1].fx = [{ type: "eq" }]; }, "sound effect");
  no((p) => { p.clips.push({ id: "mu", mediaId: "m", kind: "audio", track: "A3", start: 0, in: 100, duration: 30, props: { ...DEFAULTS } }); }, "other sound");
  no((p) => { p.tracks[3].gain = -6; }, "track A1");
  no((p) => { p.tracks[4].mute = true; }, "track A2");
  no((p) => { p.master = { gain: -3 }; }, "master");
  no((p) => { p.buses = [{ id: "B1", gain: 0 }]; }, "buses");
  no((p) => { p.disabledTracks = ["A2"]; }, "switched off");
});

test("IN-OUT: the same cuts trimmed to the range", () => {
  const r = C.plan(edit(), DEFAULTS, { range: { start: 4000, end: 4300 } });
  assert.equal(r.ok, true, r.why.join(" | "));
  assert.deepEqual(r.pieces.map((p) => [+p.in.toFixed(3), +p.out.toFixed(3)]), [[4000, 4217.133], [4333.167, 4416.033]]);
  assert.ok(Math.abs(r.duration - 300) < 0.01);
  assert.equal(C.plan(edit(), DEFAULTS, { range: { start: 5000, end: 5100 } }).ok, false);
  assert.equal(C.plan(edit(), null).ok, false);                           // the editor's defaults unknown: no
});

test("the Export window uses it and says which method it is using", () => {
  assert.ok(html.indexOf('<script src="cuts-only.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(html.includes('id="xsMethod"') && html.includes('id="forceFrames"'));
  const fn = js.slice(js.indexOf("function fastRenderChoice()"), js.indexOf("/** Seconds one frame took"));
  for (const need of ["CutsOnly.plan(project, DEFAULT_PROPS", "forceFrames", "is upright", "getExportFrame()", 'type: "fast-export"', "hostWindow().postMessage("])
    assert.ok(fn.includes(need), need);
  const start = js.slice(js.indexOf("function startChosenExport()"), js.indexOf("function syncExportRangeSelect()"));
  assert.ok(start.indexOf("fastRenderChoice()") < start.indexOf("fastExport({ delivery: dlvSpec })"));   // the fast render is tried first
  assert.ok(start.includes("sendFastExport(quick);") && js.includes('$("xsMethod").textContent = method.text;'));
  for (const [p, hosted, word] of [[{ ok: true, why: [] }, true, "fast render"], [{ ok: true, why: [] }, false, "frame by frame"],
    [{ ok: false, why: ["there is a title at 0:05", "x"] }, true, "needed because there is a title at 0:05 (and 1 more)"]])
    assert.ok(C.describe(p, hosted).text.includes(word), word);
});
