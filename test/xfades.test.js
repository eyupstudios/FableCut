// Transitions panel (Steve, 24 Nov): ffmpeg's xfade transitions with moving previews, dragged onto a join, a length
// in seconds; they export with the FAST renderer and the preview matches the export.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const X = require("../xfades.js");
const F = require("../fades.js");
const CutsOnly = require("../cuts-only.js");

const W = 1920, H = 1080;
const DEFAULTS = { volume: 1, pan: 0, audioChannel: null, speed: 1, speedSound: "normal" };

test("the panel offers ffmpeg's own transitions, the same list the fast renderer takes", () => {
  const want = ["fade", "dissolve", "fadeblack", "fadewhite", "hblur", "pixelize", "wipeleft", "wiperight", "wipeup", "wipedown",
    "smoothleft", "smoothright", "smoothup", "smoothdown", "slideleft", "slideright", "slideup", "slidedown", "circleopen",
    "circleclose", "radial", "vertopen", "horzopen", "zoomin"];
  assert.deepEqual(X.IDS, want);
  const py = fs.readFileSync(path.join(__dirname, "..", "..", "wt-speed23", "auto_video_editor", "cutsrender.py"), "utf8");
  const list = py.match(/XFADE_STYLES = \(([\s\S]*?)\)/);
  if (list) assert.deepEqual(list[1].match(/"(\w+)"/g).map((s) => s.slice(1, -1)), want);   // Create Summat's renderer
});

test("every transition starts on the clip before and ends on the clip after", () => {
  for (const s of X.IDS) {
    const a0 = X.effect(s, 0, "out", W, H), b0 = X.effect(s, 0, "in", W, H);
    const a1 = X.effect(s, 1, "out", W, H), b1 = X.effect(s, 1, "in", W, H);
    // at the start the clip after shows nothing (or is off screen), the clip before is whole
    const bHidden = b0.alpha === 0 || (b0.clip && ((b0.clip.w === 0 || b0.clip.h === 0) || b0.clip.r === 0 || b0.clip.k === 0 || b0.clip.a === 0))
      || Math.abs(b0.dx) >= W || Math.abs(b0.dy) >= H || (b0.clip && b0.clip.kind === "notcircle" && b0.clip.r >= Math.hypot(W, H) / 2 - 1)
      || (b0.clip && b0.clip.kind === "soft" && X.softBands(b0.clip.dir, 0, W, H).every((band) => band.w * band.h === 0 || band.alpha === 0));
    assert.ok(bHidden, `${s}: the clip after is hidden at the start`);
    assert.ok(a0.alpha === 1 && !a0.dx && !a0.dy && a0.scale === 1 && a0.dip === 0, `${s}: the clip before is as it is at the start`);
    // at the end the clip after is whole and in place
    assert.ok(b1.alpha === 1 && !b1.dx && !b1.dy && b1.scale === 1 && (b1.dip || 0) < 1e-9 && !b1.blur && b1.pixel <= 1, `${s}: the clip after is whole at the end`);
    if (b1.clip) {
      const c = b1.clip;
      const whole = (c.kind === "rect" && c.w >= W - 1 && c.h >= H - 1) || (c.kind === "circle" && c.r >= Math.hypot(W, H) / 2 - 1)
        || (c.kind === "notcircle" && c.r <= 1) || (c.kind === "wedge" && c.a >= Math.PI * 2 - 1e-9) || (c.kind === "dissolve" && c.k >= 1)
        || (c.kind === "soft" && X.softBands(c.dir, 1, W, H).some((band) => band.alpha === 1 && band.w >= W - 1 && band.h >= H - 1));
      assert.ok(whole, `${s}: nothing of the clip after is cut at the end`);
    }
  }
});

test("wipes and slides move the way ffmpeg's do (wipe left: the next clip comes in from the right)", () => {
  assert.deepEqual(X.effect("wipeleft", 0.25, "in", W, H).clip, { kind: "rect", x: W * 0.75, y: 0, w: W * 0.25, h: H });
  assert.deepEqual(X.effect("wipeup", 0.25, "in", W, H).clip, { kind: "rect", x: 0, y: H * 0.75, w: W, h: H * 0.25 });
  assert.equal(X.effect("slideleft", 0.25, "out", W, H).dx, -W * 0.25);
  assert.equal(X.effect("slideleft", 0.25, "in", W, H).dx, W * 0.75);
  // ffmpeg's fadeblack is black by a quarter of the way (its weights, vf_xfade.c)
  assert.ok(X.effect("fadeblack", 0.25, "out", W, H).dip > 0.99);
  assert.ok(X.effect("fadeblack", 0.25, "in", W, H).dip > 0.9);
  assert.ok(X.effect("fadeblack", 0.75, "in", W, H).dip < 0.3);
  const bands = X.softBands("left", 0.5, W, H);                     // a smooth wipe: solid, then a soft edge
  assert.equal(bands[0].alpha, 1);
  assert.ok(bands.slice(1).every((b, i, all) => b.alpha < 1 && (i === 0 || b.alpha < all[i - 1].alpha)));
});

test("a transition dropped on a join is a cross fade with its style; the fast render passes the style on", () => {
  const shot = (id, mediaId, start, inn, duration) => [
    { id, mediaId, kind: "video", track: "V1", start, in: inn, duration, linkGroup: "lg_" + id, props: { volume: 0 } },
    { id: id + "L", mediaId, kind: "audio", track: "A1", start, in: inn, duration, linkGroup: "lg_" + id, props: { audioChannel: 0, pan: -1 } },
    { id: id + "R", mediaId, kind: "audio", track: "A2", start, in: inn, duration, linkGroup: "lg_" + id, props: { audioChannel: 1, pan: 1 } },
  ];
  const p = { name: "x", width: 1920, height: 1080, fps: 30,
    media: [{ id: "m1", kind: "video", src: "/media/one.mp4", duration: 60, width: 1920, height: 1080, audioChannels: 2 },
            { id: "m2", kind: "video", src: "/media/two.mp4", duration: 60, width: 1920, height: 1080, audioChannels: 2 }],
    clips: [...shot("a", "m1", 0, 10, 5), ...shot("b", "m2", 5, 20, 5)] };
  const byId = (id) => p.clips.find((c) => c.id === id);
  const withLinked = (cs) => p.clips.filter((x) => cs.some((c) => c === x || (c.linkGroup && c.linkGroup === x.linkGroup)));
  const h = { withLinked, trimHead: (x, s) => { x.start += s; x.in += s; x.duration -= s; }, clipSpeed: () => 1,
    crossfadeCut: (a, b, d) => { for (const x of withLinked([a])) x.duration += d / 2;
      for (const x of withLinked([b])) { x.start -= d / 2; x.in -= d / 2; x.duration += d / 2; } return null; } };
  assert.equal(F.setJoin(byId("a"), byId("b"), "cross", 1, h, "circleopen"), null);
  assert.equal(byId("b").transitionIn.style, "circleopen");
  assert.equal(byId("bL").transitionIn.style, undefined);                // the sound crosses as before
  assert.equal(F.joinOf(byId("a"), byId("b")).style, "circleopen");
  const plan = CutsOnly.plan(p, DEFAULTS);
  assert.deepEqual(plan.why, []);
  assert.equal(plan.pieces[1].crossStyle, "circleopen");
  F.setJoin(byId("a"), byId("b"), "cross", 1, h, "fade");                // a plain cross fade carries no style
  assert.equal(byId("b").transitionIn.style, undefined);
});

test("the editor wires it: the Transitions tab with moving previews, drop on a join, the join menu's style", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<script src="xfades.js"><\/script>/);
  assert.match(html, /data-tab="transitions"/);
  for (const s of ["function renderTransitionsTab", "XF.drawPair(", "text/fablecut-xfade", "xfOnNearestJoin(", "data-join-style",
    "XF_OUT = xfOutgoing(clips, t)", "xfApply(p, tin.style", "XF.softBands(", "XF.path(ctx2d", "p._xfPixel"])
    assert.ok(app.includes(s), s);
});
