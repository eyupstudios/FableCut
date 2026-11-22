/* Export, simple by default (22 Nov 2026): "Where's it going?" and "Quality" set the same settings the full
   controls hold; everything else is under Advanced; the simple view has one export method. The real clicks are
   tried in a hidden browser (speed-test/e2e_21nov/ed_export_click.py); here: the rules. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Delivery = require("../delivery");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const cut = (from, to) => js.slice(js.indexOf(from), js.indexOf(to, js.indexOf(from)));

test("the dialog: the two simple rows first, everything technical inside Advanced (closed)", () => {
  const dlg = html.slice(html.indexOf('id="exportSetup"'), html.indexOf('id="btnStartExport"'));
  const at = (x) => { const i = dlg.indexOf(x); assert.ok(i >= 0, x); return i; };
  assert.ok(at('id="xsDest"') < at('id="xsQual"') && at('id="xsQual"') < at('id="exportAdvanced"'));
  const adv = dlg.slice(at('<details class="xs-adv" id="exportAdvanced">'), at('</details>\n    <div class="export-track-warn hidden" id="dlvWarn"'));
  for (const id of ["engineFast", "engineRealtime", "exportProfileSel", "dlvBody", "exportWcOpts"]) assert.ok(adv.includes(`id="${id}"`), id);
  assert.ok(!/id="exportAdvanced" open/.test(html));
  assert.ok(!html.includes("<b>Fast (ffmpeg)</b>") && !html.includes("<b>WebCodecs (HW encode)</b>"));   // the confusing pair of names is gone
});

test("each destination is a platform preset and each quality a real size for its shape", () => {
  const src = cut("const XS_DEST =", "/** What the simple rows show");
  const { XS_DEST, XS_QUAL, xsSize } = new Function("Delivery", src + "; return { XS_DEST, XS_QUAL, xsSize };")(Delivery);
  assert.deepEqual(XS_DEST.map((d) => d[1]), ["YouTube", "Shorts", "TikTok", "Reels", "X"]);
  assert.deepEqual(XS_QUAL.map((q) => q[1]), ["Standard 1080p", "High 1440p", "Max 4K"]);
  for (const [id] of XS_DEST) assert.ok(Delivery.PRESETS[id], id);
  assert.deepEqual(xsSize("youtube", 1080), { width: 1920, height: 1080 });
  assert.deepEqual(xsSize("youtube", 1440), { width: 2560, height: 1440 });
  assert.deepEqual(xsSize("x", 2160), { width: 3840, height: 2160 });
  assert.deepEqual(xsSize("youtube-shorts", 1080), { width: 1080, height: 1920 });
  assert.deepEqual(xsSize("tiktok", 2160), { width: 2160, height: 3840 });
  // the size goes through the same normalizer as the full controls and keeps the platform's own encoding
  const n = Delivery.normalize({ ...Delivery.normalize("youtube").spec, ...xsSize("youtube", 2160) });
  assert.equal(n.spec.preset, "youtube");
  assert.deepEqual([n.spec.width, n.spec.height, n.spec.video.codec, n.spec.video.crf], [3840, 2160, "h264", 18]);
});

test("the estimates: time from this PC's own finished exports, a rough size, a length in plain words", () => {
  const guess = new Function("getSetting", cut("function exportTimeGuess(", "/** A rough file size") + "; return exportTimeGuess;")(() => ({}));
  assert.equal(guess(1000, 1080, {}), null);                                   // nothing finished yet: no made-up time
  assert.equal(guess(1000, 1080, { 1080: 0.05 }), 50);
  assert.ok(guess(1000, 2160, { 1080: 0.05 }) > 100);                          // a bigger size from a smaller one's pace: longer
  const rough = new Function(cut("function xsRoughSize(", "function xsRender(") + "; return xsRoughSize;")();
  const gb = rough(1080, 60, 4348.76, { audio: { codec: "aac", bitrate: 384 } }) / 1024 ** 3;
  assert.ok(gb > 6 && gb < 7, String(gb));                                     // 72 min of 1080p60: about 6.3 GB
  assert.equal(rough(1080, 30, 0, null), 0);
  const plain = new Function(cut("function plainDuration(", "function exportRangeNoteText(") + "; return plainDuration;")();
  assert.deepEqual([4348.76, 59.6, 3600, 61].map(plain), ["1 h 12 min 29 s", "1 min 0 s", "1 h 0 min 0 s", "1 min 1 s"]);
  assert.ok(js.includes("const span = `${plainDuration(dur)} (${fmt(start)} → ${fmt(end)})`;"));
});

test("the simple choice always uses the standard export and the full controls follow it", () => {
  const fn = cut("function xsApply(", "/** Seconds one frame took");
  assert.ok(fn.includes("els.engineFast.checked = true") && fn.includes('els.exportProfileSel.value = "d:" + dest'));
  assert.ok(fn.includes('syncExportChoiceUi("preset")'));
  assert.ok(js.includes('xsApply((project.height | 0) > (project.width | 0) ? "youtube-shorts" : "youtube", 1080);'));
  assert.ok(js.includes("exportPaceRecord(frames, paceQ);"));
});
