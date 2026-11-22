/* The export's audio mix arrives in parts (22 Nov 2026: one 0.8 GB upload of a 72-minute timeline's mix took the
   whole window down). POST /api/export/audio?id=&part=N&last=0|1 appends each part on disk; the export has its
   audio only when the last part is in; a part out of order is refused; a whole upload (no `part`) still works. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeDataDir, seedProject, startServer } = require("./helpers");

const post = (base, p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const audio = (base, id, q, body) => fetch(`${base}/api/export/audio?id=${id}${q}`, { method: "POST", body });

async function boot(t) {
  const dir = makeDataDir(t, seedProject());
  const { base } = await startServer(t, dir);
  return { dir, base };
}
const wavOf = (dir) => {
  const d = fs.readdirSync(path.join(dir, "exports")).find((n) => n.startsWith("fablecut-"));
  return path.join(dir, "exports", d, "audio.wav");
};

test("the audio mix is appended part by part and only counts once the last part is in", async (t) => {
  const { dir, base } = await boot(t);
  if (!(await (await fetch(base + "/api/export/ffmpeg")).json()).available) return;
  const sess = await (await post(base, "/api/export/begin", { fps: 30, name: "long", mode: "annexb", hasAudio: true })).json();
  assert.ok(sess.id, JSON.stringify(sess));
  const parts = [Buffer.alloc(300000, 1), Buffer.alloc(300000, 2), Buffer.alloc(1234, 3)];
  assert.equal((await audio(base, sess.id, "&part=1&last=0", parts[1])).status, 409);           // out of order: refused
  assert.equal((await audio(base, sess.id, "&part=0&last=0", parts[0])).status, 200);
  assert.equal((await audio(base, sess.id, "&part=0&last=0", parts[0])).status, 409);           // the same part twice: refused
  // not complete yet: a frame is still told the audio has not been uploaded
  const early = await fetch(`${base}/api/export/frame?id=${sess.id}`, { method: "POST", body: Buffer.from([0, 0, 0, 1]) });
  assert.equal(early.status, 409);
  assert.equal((await audio(base, sess.id, "&part=1&last=0", parts[1])).status, 200);
  assert.equal((await audio(base, sess.id, "&part=2&last=1", parts[2])).status, 200);
  assert.deepEqual(fs.readFileSync(wavOf(dir)), Buffer.concat(parts));                           // exactly the parts, in order
  await fetch(`${base}/api/export/cancel?id=${sess.id}`, { method: "POST" }).catch(() => {});
});

test("a whole upload (no part) still works and replaces what was there", async (t) => {
  const { dir, base } = await boot(t);
  if (!(await (await fetch(base + "/api/export/ffmpeg")).json()).available) return;
  const sess = await (await post(base, "/api/export/begin", { fps: 30, name: "short", mode: "annexb", hasAudio: true })).json();
  const whole = Buffer.alloc(70000, 7);
  assert.equal((await audio(base, sess.id, "", whole)).status, 200);
  assert.deepEqual(fs.readFileSync(wavOf(dir)), whole);
  assert.equal((await audio(base, "nope", "&part=0&last=1", whole)).status, 404);
  await fetch(`${base}/api/export/cancel?id=${sess.id}`, { method: "POST" }).catch(() => {});
});

test("the page packs the mix in parts and never as one block", () => {
  const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(js.includes("async function uploadExportAudio(") && js.includes("&part=${k}&last=${k === parts - 1 ? 1 : 0}"));
  assert.equal((js.match(/await uploadExportAudio\(sessId, wav, signal/g) || []).length, 2);   // both export routes
  assert.ok(!/api\/export\/audio\?id=" \+ sessId, \{ method: "POST", body: wav/.test(js));     // no single-body upload left
  assert.ok(!js.includes("return encodeWAV(await off.startRendering())"));
  // the WAV part encoder: header only on the first part, 16-bit little-endian, interleaved
  const src = js.slice(js.indexOf("function wavHeader("), js.indexOf("async function uploadExportAudio("));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const { wavPart } = new Function("clamp", src + "; return { wavPart, wavHeader };")(clamp);
  const buf = { numberOfChannels: 2, sampleRate: 48000, length: 5,
    getChannelData: (c) => (c === 0 ? Float32Array.from([0, 0.5, -0.5, 1, -1]) : Float32Array.from([1, 0, 0, 0, 0])) };
  const a = wavPart(buf, 0, 3), b = wavPart(buf, 3, 5);
  assert.equal(a.length, 44 + 3 * 4);
  assert.equal(b.length, 2 * 4);
  const whole = Buffer.concat([Buffer.from(a), Buffer.from(b)]);
  assert.equal(whole.toString("ascii", 0, 4), "RIFF");
  assert.equal(whole.readUInt32LE(40), 5 * 4);                 // the header describes the WHOLE mix, not the part
  assert.equal(whole.readUInt32LE(4), 36 + 5 * 4);
  assert.equal(whole.readInt16LE(44), 0);
  assert.equal(whole.readInt16LE(46), 0x7fff);                 // right channel, first frame
  assert.equal(whole.readInt16LE(48), Math.trunc(0.5 * 0x7fff));
  assert.equal(whole.readInt16LE(44 + 3 * 4), 0x7fff);         // frame 3, left: +1
  assert.equal(whole.readInt16LE(44 + 4 * 4), -0x8000);        // frame 4, left: -1
});
