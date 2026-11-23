/* Speed changes the clip's length and its sound (Steve, 23 Nov 2026): "When I slow a clip, the picture slows but
   the sound ... stays at normal speed and goes out of sync. The sound must follow the speed of its clip, all linked
   sound tracks included"; "At 0.5x a 10 s clip must become 20 s long (pushing later clips along); at 2x it becomes
   5 s ... Never lose footage"; "Move Speed to its own section at the top of the Inspector, always open: speed
   slider + quick buttons (0.25x, 0.5x, 1x, 2x) + the sound menu". */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../edit-ops.js");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/** Picture + left/right sound on V1/A1/A2 for each shot, like a recording dropped on the timeline. */
function doc(shots, extra = []) {
  const clips = [];
  shots.forEach(([start, inn, duration, speed = 1], i) => {
    const g = "g" + i, props = (o) => ({ speed, ...o });
    clips.push({ id: "v" + i, kind: "video", track: "V1", mediaId: "m", start, in: inn, duration, linkGroup: g, props: props({ volume: 0 }) });
    clips.push({ id: "l" + i, kind: "audio", track: "A1", mediaId: "m", start, in: inn, duration, linkGroup: g, props: props({ audioChannel: 0 }) });
    clips.push({ id: "r" + i, kind: "audio", track: "A2", mediaId: "m", start, in: inn, duration, linkGroup: g, props: props({ audioChannel: 1 }) });
  });
  return { tracks: ["V2", "V1", "A1", "A2", "A3"].map((id) => ({ id })), media: [{ id: "m", kind: "video", duration: 600 }],
    clips: clips.concat(extra) };
}
const by = (d, id) => d.clips.find((c) => c.id === id);
const setSpeed = (d, id, sp) => E.forDoc(d).respeedGroup(by(d, id), (c) => { c.props.speed = sp; });

test("0.5x: a 10 s clip becomes 20 s, its two sound clips with it, and later clips move along", () => {
  const d = doc([[0, 100, 10], [10, 300, 5]], [{ id: "t", kind: "text", track: "V2", start: 12, duration: 2, props: {} },
    { id: "music", kind: "audio", track: "A3", mediaId: "m", start: 0, in: 0, duration: 15, props: {} }]);
  const r = setSpeed(d, "v0", 0.5);
  assert.deepEqual(r, { length: 20, shift: 10 });
  for (const id of ["v0", "l0", "r0"]) {
    const c = by(d, id);
    assert.equal(c.props.speed, 0.5, id);                  // the sound follows its picture
    assert.equal(c.duration, 20, id);
    assert.equal(c.in + c.duration * c.props.speed, 110, id);   // the same 10 s of the recording
  }
  for (const id of ["v1", "l1", "r1"]) assert.equal(by(d, id).start, 20, id);
  assert.equal(by(d, "t").start, 22);                      // a title over the next shot goes with it
  assert.equal(by(d, "music").start, 0);                   // the music under it, started earlier, stays
});

test("2x: the 10 s clip becomes 5 s and the next shot closes up; back to 1x gives the 10 s back", () => {
  const d = doc([[0, 100, 10], [10, 300, 5]]);
  assert.deepEqual(setSpeed(d, "l0", 2), { length: 5, shift: -5 });   // from a sound clip: the picture follows too
  for (const id of ["v0", "l0", "r0"]) assert.equal(by(d, id).duration, 5, id);
  assert.equal(by(d, "v0").props.speed, 2);
  assert.equal(by(d, "v1").start, 5);
  assert.deepEqual(setSpeed(d, "v0", 1), { length: 10, shift: 5 });
  assert.equal(by(d, "v1").start, 10);
  assert.equal(by(d, "r0").in + by(d, "r0").duration, 110);
});

test("never loses footage", () => {
  // the 22 Nov bug left the picture at 0.5x and its sound at 1x over the same 10 s: the longest stretch is kept
  const d = doc([[0, 100, 10]]);
  by(d, "v0").props.speed = 0.5;
  setSpeed(d, "v0", 0.5);
  for (const id of ["v0", "l0", "r0"]) { assert.equal(by(d, id).duration, 20, id); assert.equal(by(d, id).props.speed, 0.5, id); }
  // sped up next to a clip on another track: the clip is still all there, the later clips move only as far as they can
  const e = doc([[0, 100, 10], [12, 300, 5]], [{ id: "x", kind: "video", track: "V2", mediaId: "m", start: 9, in: 0, duration: 2, props: {} },
    { id: "y", kind: "video", track: "V2", mediaId: "m", start: 12, in: 0, duration: 2, props: {} }]);
  const r = setSpeed(e, "v0", 2);
  assert.equal(r.length, 5);
  assert.equal(by(e, "v0").in + by(e, "v0").duration * 2, 110);
  assert.ok(by(e, "y").start >= by(e, "x").start + by(e, "x").duration - 1e-9);   // nothing pushed onto what sits before it
  // the end of the recording: a shot 5 s from the end at 0.25x is 20 s, never more than the file holds
  const f = doc([[0, 595, 5]]);
  assert.equal(setSpeed(f, "v0", 0.25).length, 20);
  // a keyframed fade stays on the same moment of the recording
  const g = doc([[0, 100, 10]]);
  by(g, "l0").keyframes = { volume: [{ t: 8, v: 1 }, { t: 10, v: 0 }] };
  setSpeed(g, "v0", 0.5);
  assert.deepEqual(by(g, "l0").keyframes.volume.map((k) => k.t), [16, 20]);
});

test("a speed ramp: the sound clips get the same ramp and the length plays the same stretch", () => {
  const d = doc([[0, 100, 10], [10, 300, 5]]);
  const r = E.forDoc(d).respeedGroup(by(d, "v0"), (c) => { c.keyframes = { speed: [{ t: 0, v: 1 }, { t: 4, v: 0.5, ease: "linear" }] }; });
  // 0-4 s averages 0.75x (3 s of recording), then 7 s left at 0.5x = 14 s: 18 s in all
  assert.ok(near(r.length, 18, 0.02), String(r.length));
  for (const id of ["l0", "r0"]) assert.deepEqual(by(d, id).keyframes.speed, by(d, "v0").keyframes.speed, id);
  assert.ok(near(by(d, "v1").start, 10 + r.shift) && near(r.shift, r.length - 10));
  // the ramp taken off again: back to one speed for all three
  E.forDoc(d).respeedGroup(by(d, "v0"), (c) => { delete c.keyframes.speed; });
  for (const id of ["v0", "l0", "r0"]) { assert.equal(by(d, id).keyframes, undefined, id); assert.ok(near(by(d, id).duration, 10, 0.02), id); }
});

test("locked: nothing changes and it says why", () => {
  const d = doc([[0, 100, 10]]);
  d.lockedTracks = ["A2"];
  assert.equal(typeof setSpeed(d, "v0", 0.5), "string");
  assert.equal(by(d, "v0").props.speed, 1);
  assert.equal(by(d, "v0").duration, 10);
});

test("the Inspector: Speed is its own section at the top with the slider, 0.25x 0.5x 1x 2x and the sound menu", () => {
  const ins = js.slice(js.indexOf("function renderInspector("), js.indexOf("/* One listener for every slider"));
  const top = ins.indexOf("speedSectionHtml(c, p, slider, row)"), clipSec = ins.indexOf("<h3>Clip — ${c.kind}</h3>");
  assert.ok(top > 0 && top < clipSec, "Speed comes before the Clip section");
  assert.ok(!ins.slice(ins.indexOf("<h3>Audio / Time</h3>")).includes('slider("speed"'), "no second speed slider in Audio / Time");
  const sec = js.slice(js.indexOf("function speedSectionHtml("), js.indexOf("function speedSectionHtml(") + 2200);
  for (const need of ["<h3>Speed</h3>", 'slider("speed", 0.25, 4, 0.05', "data-speed-set", 'data-k="speedSound"', "Sound when sped up or slowed"])
    assert.ok(sec.includes(need), need);
  assert.ok(js.includes("const SPEED_QUICK = [0.25, 0.5, 1, 2];"));
  // every way of changing speed goes through the group change: the slider, the buttons, reset, keyframe add / remove
  const at = ins.indexOf('else if (k === "speed" && (c.kind === "video" || c.kind === "audio"))');
  assert.ok(at > 0 && at < ins.indexOf("else if (ANIMATABLE.includes(k))") && ins.slice(at, at + 200).includes("if (!setClipSpeed(c, v))"));
  assert.ok(ins.includes("setClipSpeed(c, +btn.dataset.speedSet, true)"));
  assert.ok(ins.includes('btn.dataset.kf === "speed"') && ins.includes('btn.dataset.kfclear === "speed"'));
  const reset = js.slice(js.indexOf("function applyInspectorReset("), js.indexOf("function toggleKfAtPlayhead("));
  assert.ok(reset.includes('k === "speed"') && reset.includes("respeedClip(c,"));
  assert.ok(js.includes("EDIT.respeedGroup(c,"));
});
