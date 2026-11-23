// Timeline zoom around the red playhead (Steve, 23 Nov 2026): the slider, Ctrl+scroll and + / - keep the playhead in
// the same place on screen; when it is out of view, the zoom brings it to the middle.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const fn = app.slice(app.indexOf("function zoomAnchor("), app.indexOf("/* Fit clip content into 95%"));

function make(time, pps, scrollLeft, width = 1000) {
  const scroller = { scrollLeft, clientWidth: width, getBoundingClientRect: () => ({ left: 100, width }) };
  const ctx = { els: { timelineScroll: scroller, zoomSlider: {} }, state: { time, pps, dirtyTimeline: false } };
  const run = new Function("els", "state", "clamp", "ZOOM_MIN", "ZOOM_MAX", "rebuildClips",
    fn + "; return { setZoom, zoomAnchor };")(ctx.els, ctx.state, (v, a, b) => Math.min(b, Math.max(a, v)), 1, 2000, () => {});
  return { ...run, scroller, state: ctx.state };
}

test("the playhead keeps its place on screen when zooming in and out", () => {
  const z = make(30, 20, 200);                       // playhead at 30 s: 600 px into the content, 400 px on screen
  const before = z.state.time * z.state.pps - z.scroller.scrollLeft;
  z.setZoom(80);
  assert.equal(z.state.time * z.state.pps - z.scroller.scrollLeft, before);
  z.setZoom(5);
  assert.equal(Math.round(Math.max(0, z.state.time * z.state.pps - z.scroller.scrollLeft)), Math.round(Math.min(before, z.state.time * 5)));
});

test("a playhead out of view is brought to the middle", () => {
  const z = make(300, 20, 0);                        // 6000 px in: off screen
  z.setZoom(40);
  assert.equal(z.state.time * z.state.pps - z.scroller.scrollLeft, 500);
});

test("every zoom control goes through it, none anchors on the mouse", () => {
  assert.ok(app.includes('els.zoomSlider.addEventListener("input", () => setZoom(+els.zoomSlider.value));'));
  assert.ok(/setZoom\(state\.pps \* \(e\.deltaY < 0 \? 1\.15 : 1 \/ 1\.15\)\);/.test(app) && !/setZoom\([^)]*e\.clientX\)/.test(app));
  assert.ok(app.includes('setZoom(state.pps * 1.25)') && app.includes('setZoom(state.pps / 1.25)'));
});
