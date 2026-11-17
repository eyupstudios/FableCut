/* Create Summat's export gate (18 Nov): with FABLECUT_EXPORT_HOOK set, a finished export is handed to that command
   (`<part> <final>`) and only its output lands in the exports folder; with FABLECUT_EXPORT_PRIVATE set the part
   file is never in the exports folder. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { makeDataDir, startServer } = require("./helpers");

test("an export is finished by the gate command, never left un-gated in exports/", async (t) => {
  const dir = makeDataDir(t);
  const priv = fs.mkdtempSync(path.join(os.tmpdir(), "fc-private-"));
  t.after(() => fs.rmSync(priv, { recursive: true, force: true }));
  // the "gate": copies the part to the final path and writes a marker next to it
  const gate = path.join(priv, "gate.js");
  fs.writeFileSync(gate, `const fs=require("fs");const [part,out]=process.argv.slice(2);
if(!part.startsWith(${JSON.stringify(priv)}))process.exit(3);
fs.copyFileSync(part,out);fs.writeFileSync(out+".gated","yes");`);
  const { base } = await startServer(t, dir, {
    FABLECUT_EXPORT_HOOK: JSON.stringify([process.execPath, gate]),
    FABLECUT_EXPORT_PRIVATE: path.join(priv, "parts"),
  });
  const ffmpeg = await (await fetch(base + "/api/export/ffmpeg")).json();
  if (!ffmpeg.available) return;
  const w = 64, h = 64;
  const frame = Buffer.alloc(w * h * 4, 0);
  for (let i = 3; i < frame.length; i += 4) frame[i] = 255;
  const begin = await fetch(base + "/api/export/begin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fps: 30, name: "gated", profile: "draft", hasAudio: false, pixelFormat: "rgba", width: w, height: h }),
  });
  const sess = await begin.json();
  assert.equal(begin.status, 200, sess.error);
  const exportsDir = path.join(dir, "exports");
  const parts = () => (fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir) : []).filter((f) => f.includes(".part"));
  assert.deepEqual(parts(), [], "no part file in exports/ while encoding");
  await fetch(base + "/api/export/frame?id=" + encodeURIComponent(sess.id), { method: "POST", body: Buffer.concat([frame, frame]) });
  const end = await fetch(base + "/api/export/end?id=" + encodeURIComponent(sess.id), { method: "POST" });
  const out = await end.json();
  assert.equal(end.status, 200, out.error);
  const file = path.join(exportsDir, decodeURIComponent(out.src.split("/").pop()));
  assert.ok(fs.existsSync(file) && fs.existsSync(file + ".gated"), "the gate wrote the finished file");
  assert.deepEqual(parts(), [], "no part file left in exports/");
});

test("a gate that fails means no export, not an un-gated one", async (t) => {
  const dir = makeDataDir(t);
  const priv = fs.mkdtempSync(path.join(os.tmpdir(), "fc-private-"));
  t.after(() => fs.rmSync(priv, { recursive: true, force: true }));
  const gate = path.join(priv, "gate.js");
  fs.writeFileSync(gate, "process.exit(1);");
  const { base } = await startServer(t, dir, {
    FABLECUT_EXPORT_HOOK: JSON.stringify([process.execPath, gate]),
    FABLECUT_EXPORT_PRIVATE: path.join(priv, "parts"),
  });
  const ffmpeg = await (await fetch(base + "/api/export/ffmpeg")).json();
  if (!ffmpeg.available) return;
  const w = 64, h = 64;
  const frame = Buffer.alloc(w * h * 4, 255);
  const begin = await fetch(base + "/api/export/begin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fps: 30, name: "refused", profile: "draft", hasAudio: false, pixelFormat: "rgba", width: w, height: h }),
  });
  const sess = await begin.json();
  await fetch(base + "/api/export/frame?id=" + encodeURIComponent(sess.id), { method: "POST", body: frame });
  const end = await fetch(base + "/api/export/end?id=" + encodeURIComponent(sess.id), { method: "POST" });
  assert.equal(end.status, 500);
  const exportsDir = path.join(dir, "exports");
  const files = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir).filter((f) => /\.(mp4|mov|webm)$/.test(f)) : [];
  assert.deepEqual(files, [], "nothing un-gated in exports/");
});
