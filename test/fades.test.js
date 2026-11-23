// Fades and transitions (Steve, 23 Nov 2026): the join's Transition menu (None / Dip to black / Cross fade / Dip to
// white, a length), Fade in / Fade out on a clip (picture and sound together), and the fast render taking them.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const F = require("../fades.js");
const CutsOnly = require("../cuts-only.js");

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
const end = (c) => c.start + c.duration;

/** Two recordings cut back to back on V1, each with its two sound stems (A1 left, A2 right), linked. */
function edit() {
  const shot = (id, mediaId, start, inn, duration) => [
    { id, mediaId, kind: "video", track: "V1", start, in: inn, duration, linkGroup: "lg_" + id, props: { volume: 0 } },
    { id: id + "L", mediaId, kind: "audio", track: "A1", start, in: inn, duration, linkGroup: "lg_" + id, props: { audioChannel: 0, pan: -1 } },
    { id: id + "R", mediaId, kind: "audio", track: "A2", start, in: inn, duration, linkGroup: "lg_" + id, props: { audioChannel: 1, pan: 1 } },
  ];
  return {
    name: "Tonight", width: 1920, height: 1080, fps: 30,
    media: [{ id: "m1", kind: "video", src: "/media/one.mp4", duration: 60, width: 1920, height: 1080, audioChannels: 2 },
            { id: "m2", kind: "video", src: "/media/two.mp4", duration: 60, width: 1920, height: 1080, audioChannels: 2 }],
    clips: [...shot("a", "m1", 0, 10, 5), ...shot("b", "m2", 5, 20, 5)],
  };
}
/** The editor's helpers, as app.js hands them over (crossfadeCut: borrow half the length from each side). */
function helpers(p) {
  const byId = (id) => p.clips.find((c) => c.id === id);
  const withLinked = (cs) => p.clips.filter((x) => cs.some((c) => c === x || (c.linkGroup && c.linkGroup === x.linkGroup)));
  const trimHead = (x, s) => { x.start += s; x.in += s; x.duration -= s; };
  const crossfadeCut = (a, b, d) => {
    for (const x of withLinked([a])) x.duration += d / 2;
    for (const x of withLinked([b])) { x.start -= d / 2; x.in -= d / 2; x.duration += d / 2; }
    for (const x of withLinked([a])) if (x.kind === "audio") x.transitionOut = { type: "fade", duration: d, curve: "power" };
    for (const x of withLinked([b])) x.transitionIn = x.kind === "audio" ? { type: "fade", duration: d, curve: "power" } : { type: "fade", duration: d };
    return null;
  };
  return { byId, h: { withLinked, trimHead, crossfadeCut, clipSpeed: () => 1 } };
}
const DEFAULTS = { volume: 1, pan: 0, audioChannel: null, speed: 1, speedSound: "normal" };

test("the menu has the four choices, 1 s by default", () => {
  assert.deepEqual(F.JOINS.map((x) => x[1]), ["None", "Dip to black", "Cross fade", "Dip to white"]);
  assert.equal(F.DEFAULT_LENGTH, 1);
});

test("dip to black: the clip before fades out, the one after fades in, picture and sound, half the length each", () => {
  const p = edit(), { byId, h } = helpers(p);
  assert.equal(F.setJoin(byId("a"), byId("b"), "dip-black", 1, h), null);
  for (const id of ["a", "aL", "aR"]) assert.deepEqual(byId(id).transitionOut, { type: "dip-black", duration: 0.5 });
  for (const id of ["b", "bL", "bR"]) assert.deepEqual(byId(id).transitionIn, { type: "dip-black", duration: 0.5 });
  assert.deepEqual(F.joinOf(byId("a"), byId("b")), { type: "dip-black", length: 1 });
  assert.equal(end(byId("a")), 5, "nothing moves");
});

test("cross fade: the clips overlap by the length (spare footage from both sides), the sounds cross, None puts the cut back", () => {
  const p = edit(), { byId, h } = helpers(p);
  assert.equal(F.setJoin(byId("a"), byId("b"), "cross", 1, h), null);
  near(end(byId("a")) - byId("b").start, 1, "overlap");
  assert.deepEqual(F.joinOf(byId("a"), byId("b")), { type: "cross", length: 1 });
  assert.equal(byId("b").transitionIn.type, "cross");
  assert.equal(byId("a").transitionOut, undefined, "only the clip after fades over the other");
  for (const id of ["aL", "aR"]) assert.deepEqual(byId(id).transitionOut, { type: "cross", duration: 1, curve: "power" });
  for (const id of ["bL", "bR"]) assert.equal(byId(id).transitionIn.curve, "power");
  F.setJoin(byId("a"), byId("b"), "none", 1, h);
  for (const id of ["a", "aL", "aR"]) { assert.equal(end(byId(id)), 5); assert.equal(byId(id).transitionOut, undefined); }
  for (const id of ["b", "bL", "bR"]) { assert.equal(byId(id).start, 5); assert.equal(byId(id).in, 20); assert.equal(byId(id).transitionIn, undefined); }
});

test("changing a cross fade to a dip to white undoes the overlap first", () => {
  const p = edit(), { byId, h } = helpers(p);
  F.setJoin(byId("a"), byId("b"), "cross", 2, h);
  F.setJoin(byId("a"), byId("b"), "dip-white", 2, h);
  assert.equal(end(byId("a")), 5);
  assert.equal(byId("b").start, 5);
  assert.deepEqual(F.joinOf(byId("a"), byId("b")), { type: "dip-white", length: 2 });
});

test("Fade in / Fade out on a clip: its picture and sound, never longer than the clip; 0 takes it off", () => {
  const p = edit(), { byId, h } = helpers(p);
  const g = h.withLinked([byId("a")]);
  F.setFade(g, "in", 2);
  F.setFade(g, "out", 9, "white");
  for (const x of g) {
    assert.deepEqual(x.transitionIn, { type: "dip-black", duration: 2 });
    assert.deepEqual(x.transitionOut, { type: "dip-white", duration: 5 });
  }
  assert.deepEqual(F.fadeOf(byId("a"), "out"), { seconds: 5, color: "white" });
  F.setFade(g, "in", 0);
  assert.ok(g.every((x) => x.transitionIn === undefined));
});

test("the fast render takes cuts with fades and cross fades, and passes them on", () => {
  const p = edit(), { byId, h } = helpers(p);
  F.setFade(h.withLinked([byId("a")]), "in", 1.5);
  F.setJoin(byId("a"), byId("b"), "cross", 1, h);
  F.setFade(h.withLinked([byId("b")]), "out", 2, "white");
  const plan = CutsOnly.plan(p, DEFAULTS);
  assert.deepEqual(plan.why, []);
  assert.ok(plan.ok);
  assert.equal(plan.pieces.length, 2);
  assert.equal(plan.pieces[0].fadeIn, 1.5);
  assert.equal(plan.pieces[0].fadeInColor, "black");
  near(plan.pieces[1].cross, 1, "cross");
  assert.equal(plan.pieces[1].fadeOut, 2);
  assert.equal(plan.pieces[1].fadeOutColor, "white");
  near(plan.duration, 10, "spare footage was borrowed for the blend: nothing after the cut moved");
  assert.match(CutsOnly.describe(plan, true).text, /^Fast render\. .*cuts and fades/);
});

test("a dip on the picture but not on its sound, or an old-style eased transition, goes frame by frame with the reason", () => {
  let p = edit(), { byId, h } = helpers(p);
  byId("a").transitionOut = { type: "dip-black", duration: 0.5 };
  let plan = CutsOnly.plan(p, DEFAULTS);
  assert.ok(!plan.ok && plan.why.some((w) => /fades differently/.test(w)), plan.why.join("; "));
  ({ byId, h } = helpers(p = edit()));
  byId("a").transitionOut = { type: "slide-left", duration: 0.5 };
  plan = CutsOnly.plan(p, DEFAULTS);
  assert.ok(!plan.ok && plan.why.some((w) => /transition/.test(w)));
});

test("the editor wires it: join buttons, the menu, video fade grips, Inspector fades, the preview's straight-line dips", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf('<script src="fades.js">') > 0 && html.indexOf('<script src="fades.js">') < html.indexOf('<script src="app.js">'));
  assert.ok(app.includes("paintJoins();") && app.includes("function showJoinMenu(") && app.includes('e.target.closest(".join-btn")'));
  assert.ok(app.includes('else if (c.kind === "video") inner += fadeGripsHtml(c);'));
  assert.ok(app.includes("<h3>Fades</h3>") && app.includes("FADES.setFade(fadeGroup(c), side, secs, color)"));
  assert.ok(app.includes('const STRAIGHT_FADES = new Set(["dip-black", "dip-white", "cross"]);'));
  assert.ok(app.includes('case "dip-black": case "dip-white":') && app.includes("if (p._dip > 0) {"));
  assert.ok(/fadeIn: p\.fadeIn \|\| 0, fadeInColor: .*cross: p\.cross \|\| 0/s.test(app), "the fades go to Create Summat");
});

test("times show as h:mm:ss, frames only when zoomed in; typed times read the same way", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const src = app.slice(app.indexOf("const FRAMES_PPS"), app.indexOf("/* Typed timecode"));
  const make = (pps) => new Function("state", "projectFps", src + "; return fmt;")({ pps }, () => 30);
  assert.equal(make(60)(445), "0:07:25");
  assert.equal(make(60)(3723.5), "1:02:03");
  assert.equal(make(200)(445.5), "0:07:25:15");
  const ruler = fs.readFileSync(path.join(__dirname, "..", "ruler-worker.js"), "utf8");
  const rf = new Function(ruler.slice(ruler.indexOf("function fmt("), ruler.indexOf("function draw(")) + "; return fmt;")();
  assert.equal(rf(445, 30, false), "0:07:25");
  assert.equal(rf(445.5, 30, true), "0:07:25:15");
});
