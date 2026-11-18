/* Background removal is bundled (18 Nov): MediaPipe Selfie Segmentation is served from /vendor, never a CDN. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, makeDataDir, startServer } = require("./helpers");

test("the MediaPipe files are bundled and served locally", async (t) => {
  const { base } = await startServer(t, makeDataDir(t));
  for (const [f, type] of [["selfie_segmentation.js", /javascript/], ["selfie_segmentation_solution_simd_wasm_bin.wasm", /application\/wasm/],
    ["selfie_segmentation_landscape.tflite", /octet-stream/], ["selfie_segmentation.binarypb", /octet-stream/]]) {
    const r = await fetch(`${base}/vendor/mediapipe/selfie_segmentation/${f}`);
    assert.equal(r.status, 200, f);
    assert.match(r.headers.get("content-type"), type, f);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "vendor/mediapipe/selfie_segmentation/LICENSE")));
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "app.js"), "utf8"), /cdn\.jsdelivr\.net\/npm\/@mediapipe/);
});
