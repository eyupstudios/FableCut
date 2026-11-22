/* Export → "Send to Ready to post" (22 Nov 2026, inside Create Summat's window): the box is hidden outside Create
   Summat, every export route hands the finished file over instead of pushing it at Downloads, and the message names
   only the file (Create Summat takes it from the Editor's exports folder). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the Export dialog has the box, hidden until the editor knows it is inside Create Summat", () => {
  assert.ok(/<label class="send-rtp hidden" id="sendRtpRow"/.test(html) && /id="sendRtp" checked/.test(html));
  assert.ok(html.indexOf('id="sendRtpRow"') < html.indexOf('id="btnStartExport"'));
  assert.ok(js.includes("function initSendToReadyToPost()") && js.includes("initSendToReadyToPost();"));
  assert.ok(js.includes("if (!row || !box || !inCreateSummat()) return;"));
});

test("every export route hands the file over (and only then skips the download)", () => {
  assert.equal((js.match(/if \(!sendToReadyToPost\(end\.src\)\)/g) || []).length, 3);   // delivery, plain, WebCodecs
  const fn = js.slice(js.indexOf("function sendToReadyToPost("), js.indexOf("/* The export's audio mix goes to the server in PARTS"));
  assert.ok(fn.includes('source: "fablecut", type: "exported"') && fn.includes("window.parent.postMessage("));
  assert.ok(fn.includes("!box.checked") && fn.includes("return false"));
  // the message: the box unticked or no host -> nothing sent, the download happens as before
  const posted = [];
  const make = (hosted, checked) => new Function("window", "$", "project", "toast", "inCreateSummat",
    fn + "; return sendToReadyToPost;")({ parent: { postMessage: (m) => posted.push(m) } }, () => ({ checked }), { name: "Mission 2 edit" }, () => {}, () => hosted);
  assert.equal(make(true, true)("/exports/Mission%202%20edit.mp4"), true);
  assert.deepEqual(posted, [{ source: "fablecut", type: "exported", project: "Mission 2 edit", file: "Mission 2 edit.mp4" }]);
  assert.equal(make(true, false)("/exports/x.mp4"), false);
  assert.equal(make(false, true)("/exports/x.mp4"), false);
  assert.equal(make(true, true)(""), false);
  assert.equal(posted.length, 1);
});
