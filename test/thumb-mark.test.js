// "Mark thumbnail frame" (Steve, 23 Nov 2026): a marker on the timeline; that exact frame becomes the thumbnail.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the button, the marker, kept with the project", () => {
  assert.ok(html.includes('id="btnThumbFrame"') && html.includes("Mark thumbnail frame"));
  assert.ok(app.includes("thumbFrame: data.thumbFrame != null") && app.includes("{ thumbFrame: project.thumbFrame }"));
  assert.ok(app.includes("paintThumbMark();") && app.includes('addEventListener("click", () => markThumbFrame())'));
});

test("the marked frame goes with every export, in the exported file's own time", () => {
  const fn = app.slice(app.indexOf("function thumbAtInExport("), app.indexOf("function sendToReadyToPost("));
  const make = (thumbFrame, start, dur) => new Function("project", "exportRange", "projDur", fn + "; return thumbAtInExport;")(
    { thumbFrame }, () => ({ start, dur }), () => dur);
  assert.equal(make(null, 0, 100)(), null);
  assert.equal(make(42.5, 0, 100)(), 42.5);
  assert.equal(make(42.5, 40, 30)(), 2.5);          // an IN-OUT export from 0:40: the frame is 2.5 s into the file
  assert.equal(make(10, 40, 30)(), null);           // marked outside what is exported: the automatic picks
  assert.ok(app.includes("thumb_at: thumbAtInExport(fps)") && app.includes("thumb_at: thumbAtInExport()"));
});
