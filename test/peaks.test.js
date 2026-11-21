/* Waveform peaks made on the server (Create Summat, 21 Nov 2026): the page draws from these instead of decoding
   whole sound tracks. Needs ffmpeg on PATH (skipped without it). */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { createPeaks, RATE } = require("../peaks");

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { windowsHide: true }).status === 0;

test("peaks: one 0-255 value per 1/50 s per channel, cached per file version", { skip: !hasFfmpeg && "no ffmpeg" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-peaks-"));
  const media = path.join(dir, "media");
  fs.mkdirSync(media);
  const file = path.join(media, "tone.wav");
  // 3 s: left loud tone, right silent for 1.5 s then loud
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=440:d=3", "-f", "lavfi", "-i",
    "sine=f=220:d=3", "-filter_complex", "[1]volume=enable='lt(t,1.5)':volume=0[r];[0][r]join=inputs=2:channel_layout=stereo",
    file], { windowsHide: true });
  assert.equal(r.status, 0, String(r.stderr));
  const resolveSrc = (src) => (src === "/media/tone.wav" ? file : null);
  const probe = async () => ({ audioChannels: 2, duration: 3 });
  const pk = createPeaks({ dir: path.join(dir, "peaks"), resolveSrc, probe });
  const a = await pk.get("/media/tone.wav");
  assert.equal(a.rate, RATE);
  assert.equal(a.channels, 2);
  const L = Buffer.from(a.peaks[0], "base64"), R = Buffer.from(a.peaks[1], "base64");
  assert.ok(Math.abs(L.length - 3 * RATE) <= 1, `length ${L.length}`);
  // ffmpeg's test tone is 1/8 of full scale: 0.125 * 255 ≈ 32
  assert.ok(Math.abs(L[10] - 32) <= 2 && Math.abs(L[140] - 32) <= 2, `left is the tone throughout (${L[10]}, ${L[140]})`);
  assert.ok(R[10] === 0 && Math.abs(R[140] - 32) <= 2, `right is silent first, the tone later (${R[10]}, ${R[140]})`);
  assert.equal(fs.readdirSync(path.join(dir, "peaks")).filter((f) => f.endsWith(".json")).length, 1, "cached once");
  const b = await pk.get("/media/tone.wav");
  assert.deepEqual(b, a, "second call reads the cache");
  assert.equal(await pk.get("/media/missing.wav"), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("peaks: a file with no sound gives no peaks", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-peaks-"));
  const file = path.join(dir, "silent.mp4");
  fs.writeFileSync(file, "x");
  const pk = createPeaks({ dir: path.join(dir, "peaks"), resolveSrc: () => file, probe: async () => ({ audioChannels: 0, duration: 9 }) });
  const r = await pk.get("/media/silent.mp4");
  assert.equal(r.channels, 0);
  assert.deepEqual(r.peaks, []);
  fs.rmSync(dir, { recursive: true, force: true });
});
