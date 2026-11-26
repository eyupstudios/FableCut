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
  assert.deepStrictEqual(n.map((b) => [b.cropX, b.accepted]), [[0.5, false], [0.5, false]]);           // 26 Nov: frame centred, not accepted
  const k = SB.normalize([{ start: 1, dur: 20, cropX: 1.7, accepted: true }, { start: 1, dur: 20, cropX: 0.2, accepted: "yes" }]);
  assert.deepStrictEqual(k.map((b) => [b.cropX, b.accepted]), [[1, true], [0.2, false]]);
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
  assert.ok(src.includes('type: "make-short"') && src.includes(">Export to Ready to post</button>") && src.includes(">Download</button>") && !/project\.clips\s*=/.test(src));   // never edits clips
  // 23 Nov (2): Export Shorts (N) for all of them; a box goes once its Short is made (Create Summat says so)
  // 26 Nov: the top-bar button is the list of accepted Shorts, with Export all in it
  // 26 Nov (evening): the Shorts tab beside Inspector / Mixer / Color / Transcript; the top-bar button opens it
  assert.ok(html.includes('id="btnExportShorts"') && app.includes("toggleShortsList()") && src.includes("Export all ticked (") && src.includes("Shorts (${boxes.length})"));
  assert.ok(html.includes('data-side="shorts"') && html.includes('id="shortsPage"') && app.includes('shorts = tab === "shorts"'));
  assert.ok(html.includes('id="sbModeSwitch"') && html.includes('data-sbmode="short"') && app.includes("setShortMode(b.dataset.sbmode)"));
  assert.ok(src.includes('d.type === "short-done"') && src.includes("project.shortBoxes = boxes.filter((x) => x.id !== d.box)") && src.includes("box: { id: b.id"));
});

test("clips under a box can still be clicked: only its bar and handles take the mouse", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
  assert.ok(/\.short-box \{[^}]*pointer-events: none/.test(css) && /\.short-box \.sb-bar, \.short-box \.sb-h \{ pointer-events: auto/.test(css));
});

test("26 Nov: + Short ENDS at the playhead (the 30 s before it), or covers In to Out", () => {
  assert.deepStrictEqual(SB.forPlayhead(100, null, null, 600), { start: 70, dur: 30, from: "playhead" });
  assert.deepStrictEqual(SB.forPlayhead(20, null, null, 600), { start: 0, dur: 20, from: "playhead" });      // near the start
  assert.deepStrictEqual(SB.forPlayhead(5, null, null, 600), { start: 0, dur: 15, from: "playhead" });       // 15 s at least
  assert.deepStrictEqual(SB.forPlayhead(100, 40, 95, 600), { start: 40, dur: 55, from: "io" });              // In and Out win
  assert.deepStrictEqual(SB.forPlayhead(100, 0, 300, 600), { start: 120, dur: 180, from: "io" });            // 3 min: the last 3 before Out
  assert.deepStrictEqual(SB.forPlayhead(100, 40, null, 600).from, "playhead");                              // only In: the playhead
});

test("26 Nov: Short mode - the 9:16 frame, its length, and the delete words", () => {
  assert.deepStrictEqual(SB.window916(1920, 1080, 0.5), { x: 656, w: 608 });
  assert.deepStrictEqual(SB.window916(1920, 1080, 0), { x: 0, w: 608 });
  assert.deepStrictEqual(SB.window916(1920, 1080, 1), { x: 1312, w: 608 });
  assert.strictEqual(SB.length(30), "0:30"); assert.strictEqual(SB.length(125), "2:05");
  assert.strictEqual(SB.deleteText(1, ""), "Delete Short 1 (the marker only, your video and edit stay)");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const src = fs.readFileSync(path.join(__dirname, "..", "short-boxes.js"), "utf8");
  // the main Delete / Ripple delete (button and keys) go to the selected Short first, never the edit
  for (const fn of ["deleteSelected", "rippleDeleteSelected"]) {
    const at = app.indexOf("function " + fn + "() {");
    assert.ok(at > 0 && app.slice(at, at + 200).includes("if (typeof shortDeleteSelected === \"function\" && shortDeleteSelected()) return;"), fn);
  }
  assert.ok(src.includes('window.addEventListener("keydown"') && src.includes("stopImmediatePropagation(); askDelete(selId)") && src.includes('e.key === "Escape"'));
  assert.ok(src.includes("crop_x: SBX.cropOf(b)") && src.includes('type: "shorts-list"') && src.includes('d.type === "short-removed"'));
  assert.ok(!/project.clipss*=/.test(src));                                                       // the edit is never changed
});


test("26 Nov (evening): the frame moves WITH the mouse, the Short's own settings, the start / end fields", () => {
  // the viewing box over a 1920x1080 picture: 1 screen px = 1 picture px; the box can travel 1920 - 608 = 1312 px
  assert.ok(SB.dragCrop(0.5, 131.2, 1, 1920, 1080) > 0.5);                  // mouse right -> the box goes right
  assert.ok(SB.dragCrop(0.5, -131.2, 1, 1920, 1080) < 0.5);                 // mouse left -> the box goes left
  assert.strictEqual(SB.dragCrop(0.5, 131.2, 1, 1920, 1080), 0.6);
  assert.strictEqual(SB.dragCrop(0.9, 5000, 1, 1920, 1080), 1);             // never past the edge
  const n = SB.normalize([{ start: 1, dur: 20, text: "Busted", speed: 1.5, look: "bw" }, { start: 1, dur: 20, speed: 7, look: "x" }]);
  assert.deepStrictEqual(n.map((b) => [b.text, b.speed, b.look]), [["Busted", 1.5, "bw"], ["", 1, "none"]]);
  assert.strictEqual(SB.clock(65.2), "1:05.2"); assert.strictEqual(SB.parseClock("1:05.2"), 65.2); assert.ok(isNaN(SB.parseClock("abc")));
  const src = fs.readFileSync(path.join(__dirname, "..", "short-boxes.js"), "utf8");
  assert.ok(src.includes("Editing: ${labelOf(b, i)}") && src.includes("switch to Main to change your video"));
  assert.ok(src.includes("...extras(b)") && !/project.clipss*=/.test(src));   // its own settings go to Create Summat; the edit untouched
});
