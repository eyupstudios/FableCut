// Short boxes (Steve, 23 Nov 2026): "Add Short" (30 s), drag the ends (15 s to 3 min), "Create Short" sends the footage
// under the box to Create Summat; the edit is never changed.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SB = require("../short-boxes.js");

test("a box stays between 15 s and 3 min and never before the start", () => {
  assert.deepStrictEqual(SB.clamp({ start: -4, dur: 5 }, 600), { start: 0, dur: 15 });
  assert.deepStrictEqual(SB.clamp({ start: 10, dur: 400 }, 600), { start: 10, dur: 180 });
  assert.deepStrictEqual(SB.clamp({ start: 590, dur: 30 }, 600), { start: 570, dur: 30 });   // kept inside the edit
  assert.strictEqual(SB.clamp({ start: 5 }, 0).dur, 30);                                       // the default: 30 s
  const n = SB.normalize([{ start: 1, dur: 20 }, null, { start: "x" }, { id: "a", start: 3, dur: 3, name: "Busted" }]);
  assert.deepStrictEqual(n.map((b) => [b.id, b.start, b.dur, b.name]), [["sb1", 1, 20, ""], ["a", 3, 15, "Busted"]]);
});

test("the footage under a box: the lowest video lane, cut to the box; titles are counted, not included", () => {
  const project = { media: [{ id: "m1", src: "/media/rec.mp4" }, { id: "m2", src: "/media/b.mp4" }],
    clips: [{ id: "a", kind: "video", track: "V1", mediaId: "m1", start: 0, in: 100, duration: 20 },
            { id: "b", kind: "video", track: "V1", mediaId: "m2", start: 20, in: 5, duration: 30 },
            { id: "c", kind: "audio", track: "A1", mediaId: "m1", start: 0, in: 100, duration: 20 },
            { id: "t", kind: "text", track: "V2", start: 18, duration: 4, props: { text: "Title" } },
            { id: "d", kind: "video", track: "V1", mediaId: "m1", start: 60, in: 0, duration: 10, disabled: true }] };
  const f = SB.footage(project, { start: 10, dur: 30 });
  assert.deepStrictEqual(f.pieces, [{ file: "rec.mp4", in: 110, out: 120, at: 0 }, { file: "b.mp4", in: 5, out: 25, at: 10 }]);
  assert.strictEqual(f.extra, 1);                                   // the title under it
  assert.strictEqual(SB.footage(project, { start: 200, dur: 30 }).pieces.length, 0);
});

test("the editor draws, saves and sends the boxes without touching the edit", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const src = fs.readFileSync(path.join(__dirname, "..", "short-boxes.js"), "utf8");
  assert.ok(html.includes('id="btnAddShort"') && html.includes('src="short-boxes.js"'));
  assert.ok(app.includes("paintShortBoxes()") && app.includes("ShortBoxes.normalize(data.shortBoxes)") && app.includes("shortBoxes: project.shortBoxes"));
  assert.ok(src.includes('type: "make-short"') && src.includes("Create Short") && !/project\.clips\s*=/.test(src));   // never edits clips
});

test("clips under a box can still be clicked: only its bar and handles take the mouse", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
  assert.ok(/\.short-box \{[^}]*pointer-events: none/.test(css) && /\.short-box \.sb-bar, \.short-box \.sb-h \{ pointer-events: auto/.test(css));
});
