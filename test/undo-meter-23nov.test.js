/* 23 Nov (Steve): "Undo / Redo buttons at the top of the Editor (arrows), plus Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z.
   Every action undoable: cuts, speed, moves, deletes, volume, text"; "The volume meter on the side covers too
   much of the video. Make it a slim bar under the monitor ... never over the picture". The real clicks and key
   presses are checked on a copy of a real clip in speed-test/night_23nov/undo_meter_export_check.py; these keep
   the wiring in place. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");

test("the arrows in the top bar, greyed when there is nothing to undo / redo", () => {
  assert.ok(/id="btnUndo" title="Undo \(Ctrl\+Z\)"[^>]*disabled>↶<\/button>/.test(html));
  assert.ok(/id="btnRedo" title="Redo \(Ctrl\+Y or Ctrl\+Shift\+Z\)"[^>]*disabled>↷<\/button>/.test(html));
  assert.ok(html.indexOf('id="btnUndo"') < html.indexOf('id="projectName"'));     // top left, beside Projects
  assert.ok(js.includes('$("btnUndo")?.addEventListener("click"') && js.includes("setInterval(syncUndoButtons, 250);"));
});

test("the keys: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, also right after a choice in a drop-down menu", () => {
  assert.ok(js.includes("e.shiftKey ? redo() : undo();") && /\(k === "y" \|\| k === "Y"\)\) \{ e\.preventDefault\(\); redo\(\); \}/.test(js));
  const sel = js.indexOf('document.activeElement?.tagName === "SELECT" && /^[zy]$/i.test(k)');
  assert.ok(sel > 0 && sel < js.indexOf("if (isTypingTarget(document.activeElement)) return;", sel));
});

test("volume in the mixer is undoable: the faders, pans, buses and master go into every undo step", () => {
  const src = js.slice(js.indexOf("function undoSnapshot()"), js.indexOf("/** Record an undo step"));
  const TRACKS = [{ id: "A1", kind: "audio", gain: -6 }, { id: "A2", kind: "audio" }, { id: "V1", kind: "video" }];
  const project = { clips: [], markers: [], comps: [], master: { gain: -2 }, buses: [] };
  let rendered = 0;
  const f = new Function("project", "TRACKS", "runtime", "serializeTracks", "mixerState", "renderMixer",
    src + "; return { undoSnapshot, restoreMix };")(project, TRACKS, {}, () => [], { open: true }, () => rendered++);
  const snap = JSON.parse(f.undoSnapshot());
  assert.deepEqual(snap.mix, { tracks: { A1: [-6, 0], A2: [0, 0] }, master: { gain: -2 }, buses: [] });
  TRACKS[0].gain = 3; TRACKS[1].pan = 0.5; project.master = { gain: 0 };
  f.restoreMix(snap.mix);
  assert.equal(TRACKS[0].gain, -6); assert.equal(TRACKS[1].pan, undefined); assert.deepEqual(project.master, { gain: -2 });
  assert.equal(rendered, 1);
  assert.ok(js.includes("if (snap.mix) restoreMix(snap.mix);"));
  const strip = js.slice(js.indexOf("function renderMixer()"), js.indexOf("function renderMixer()") + 5000);
  assert.ok(strip.includes('el.addEventListener("pointerdown", () => pushUndo());') && strip.includes("else { pushUndo(); setDb(v); }"));
});

test("the level meter: a slim bar under the monitor, the old one no longer over the picture", () => {
  const stageEnd = html.indexOf('<div class="slim-meter" id="slimMeter"');
  assert.ok(stageEnd > html.indexOf('id="vuMeter"') && stageEnd < html.indexOf('<div class="transport">'));
  assert.ok(css.includes("#monitorStage > .vu-meter { display: none !important; }"));
  assert.ok(js.includes("  paintSlimMeter();\n}") && js.includes("function paintSlimMeter()"));
  assert.ok(css.includes(".xs-smooth[hidden] { display: none; }"));             // hidden really hides it
});
