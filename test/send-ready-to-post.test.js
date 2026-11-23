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

test("the Export window: Cancel / Add to queue / Download / Export to Ready to post, no tick box, where the file goes", () => {
  // 23 Nov (Steve): "Remove the 'Send to Ready to post' tick box: every export goes to Library + Ready to post anyway"
  assert.ok(!html.includes('id="sendRtp"') && !js.includes('$("sendRtp")'));
  const order = ["btnCancelSetup", "btnQueueExport", "btnDownloadExport", "btnStartExport"].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), String(order));
  assert.ok(/class="btn primary" id="btnStartExport"/.test(html) && html.indexOf('id="xsWhere"') > order[3]);
  const init = js.slice(js.indexOf("function initSendToReadyToPost()"), js.indexOf("async function downloadExport()"));
  for (const need of ['"Export to Ready to post" : "Export"', '$("btnDownloadExport")?.classList.toggle("hidden", !cs)', "Export to Ready to post:</b>",
    "Download:</b> just the file, saved in", "No Ready to post page", "Create Summat's Library", 'askHost("where"'])   // 23 Nov (2): Download = just the file
    assert.ok(init.includes(need), need);
  const dl = js.slice(js.indexOf("async function downloadExport()"), js.indexOf("function sendToReadyToPost("));
  for (const need of ['askHost("choose-folder", { start: getSetting("downloadFolder")', 'setSetting("downloadFolder", r.path)', "pendingDownload = { folder: r.path }", "startChosenExport()"])
    assert.ok(dl.includes(need), need);
  assert.ok(/downloadFolder: "",/.test(js));                       // kept between sessions (setSetting only keeps listed keys)
  assert.ok(js.includes("send: !copy, download: !!copy, copy_to: copy, thumb_at: thumbAtInExport(fps) }"));   // fast render: a page, or (Download) just the file
});

test("every export route hands the file over (and only then skips the download), with Download's folder", () => {
  assert.equal((js.match(/if \(!sendToReadyToPost\(end\.src\)\)/g) || []).length, 3);   // delivery, plain, WebCodecs
  const fn = js.slice(js.indexOf("function sendToReadyToPost("), js.indexOf("/* The export's audio mix goes to the server in PARTS"));
  assert.ok(fn.includes('source: "fablecut", type: "exported"') && fn.includes("hostWindow().postMessage("));
  const posted = [];
  const make = (hosted, folder) => new Function("hostWindow", "project", "toast", "inCreateSummat", "folder",
    "let pendingDownload = folder ? { folder } : null; const thumbAtInExport = () => null;" + fn + "; return sendToReadyToPost;")(
    () => ({ postMessage: (m) => posted.push(m) }), { name: "Mission 2 edit" }, () => {}, () => hosted, folder);
  assert.equal(make(true)("/exports/Mission%202%20edit.mp4"), true);
  assert.equal(make(true, "D:\\Videos")("/exports/x.mp4"), true);
  assert.deepEqual(posted, [{ source: "fablecut", type: "exported", project: "Mission 2 edit", file: "Mission 2 edit.mp4", copy_to: "", download: false, thumb_at: null },
    { source: "fablecut", type: "exported", project: "Mission 2 edit", file: "x.mp4", copy_to: "D:\\Videos", download: true, thumb_at: null }]);
  assert.equal(make(false)("/exports/x.mp4"), false);              // outside Create Summat: the browser downloads it
  assert.equal(make(true)(""), false);
  assert.equal(posted.length, 2);
});

test("the export window says the time left and where the file goes", async () => {
  assert.ok(html.includes('id="exportEta"'));
  assert.equal((js.match(/exportStatus\(\(f \+ 1\) \/ frames\);/g) || []).length, 2);      // both fast routes
  assert.equal((js.match(/exportStatusBegin\(begin\.file/g) || []).length, 2);
  const src = js.slice(js.indexOf("function exportTimeLeft("), js.indexOf("function exportStatusBegin("));
  const left = new Function(src + "; return exportTimeLeft;")();
  assert.deepEqual([4, 47, 600, 4000, NaN].map(left), ["nearly done", "about 50 s left", "about 10 min left", "about 1 h 7 min left", ""]);
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.ok(server.includes("return { id, mode: m, file: outPath };") && server.includes("summary: profileSummary(profile), file: outPath };"));
});

test("an export in the editor reports itself to its host: start, progress once a second, and how it ended", () => {
  const src = js.slice(js.indexOf("let exportJob = null;"), js.indexOf("/* \"Send to Ready to post\" (22 Nov 2026"));
  const sent = [];
  let now = 0;
  const tell = new Function("hostWindow", "performance", "project", src + "; return exportTell;")(
    () => ({ postMessage: (m) => sent.push(m) }), { now: () => now }, { name: "Part 3" });
  tell("running", 0.5);                                  // nothing started: nothing said
  tell("start", 0, { stage: "mixing the audio" });
  now = 300; tell("running", 0.1);                       // inside the same second: kept back
  now = 1500; tell("running", 0.2);
  now = 9000; tell("done", 1);
  tell("running", 0.9);                                  // over: nothing more
  assert.deepEqual(sent.map((m) => [m.type, m.state, m.frac, Math.round(m.elapsed)]),
    [["export-progress", "running", 0, 0], ["export-progress", "running", 0.2, 2], ["export-progress", "done", 1, 9]]);
  assert.ok(sent.every((m) => m.source === "fablecut" && m.title === "Part 3" && m.id === sent[0].id));
  assert.equal((js.match(/exportTell\("start", 0/g) || []).length, 2);
  assert.equal((js.match(/exportTell\(msg === "cancelled" \? "cancelled" : "failed"/g) || []).length, 2);
  assert.equal((js.match(/exportTell\("done", 1\)/g) || []).length, 2);
  const none = new Function("hostWindow", "performance", "project", src + "; return exportTell;")(() => null, { now: () => 0 }, { name: "x" });
  none("start", 0);                                      // outside Create Summat: nothing is sent, nothing breaks
});

