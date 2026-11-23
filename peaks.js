"use strict";
/* Waveform peaks made by ffmpeg on the server (Create Summat, 21 Nov 2026: a page that decoded whole sound
   tracks with decodeAudioData held 7 GB after a few long videos). One small file per version of a media file:
   the loudest sample in every 1/50 s, per channel, as 0-255 — about 180 KB for 30 minutes of stereo.
   Kept in analysis/peaks/, named after the file's path, size and modification time (like proxies): a replaced
   file simply gets new peaks. Built one at a time so a bin full of long videos doesn't flood the CPU.

   Also: the sound track alone as a WAV stream (/api/audio), so a page that must decode sound (normalize, beats,
   the export mix) never downloads a whole multi-gigabyte video for it. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const RATE = 50;            // peaks per second (matches the editor's WAVE_PEAKS_PER_SEC)
const PCM_RATE = 8000;      // decode rate for measuring: 160 samples per peak
const VERSION = 1;

function createPeaks({ dir, resolveSrc, probe, ffmpeg = "ffmpeg" }) {
  const inflight = new Map();
  let chain = Promise.resolve();

  function keyFor(file, st) {
    return crypto.createHash("sha1").update(`${path.resolve(file).toLowerCase()}|${st.size}|${Math.round(st.mtimeMs)}`)
      .digest("hex").slice(0, 20) + ".json";
  }

  async function build(file, out) {
    const info = (probe ? await probe(file).catch(() => null) : null) || {};
    const channels = Math.max(0, Math.min(8, +info.audioChannels || 0));
    if (info.audioChannels === 0) return { v: VERSION, rate: RATE, channels: 0, duration: +info.duration || 0, peaks: [] };
    const ch = channels || 2;
    const per = PCM_RATE / RATE;
    const bufs = Array.from({ length: ch }, () => []);
    let cur = new Array(ch).fill(0), n = 0, carry = Buffer.alloc(0);
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpeg, ["-v", "error", "-nostdin", "-i", file, "-vn", "-ac", String(ch), "-ar", String(PCM_RATE),
        "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      p.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
      p.stdout.on("data", (chunk) => {
        const b = carry.length ? Buffer.concat([carry, chunk]) : chunk;
        const frame = 2 * ch, whole = b.length - (b.length % frame);
        for (let o = 0; o < whole; o += frame) {
          for (let c = 0; c < ch; c++) {
            const a = Math.abs(b.readInt16LE(o + 2 * c));
            if (a > cur[c]) cur[c] = a;
          }
          if (++n === per) {
            for (let c = 0; c < ch; c++) { bufs[c].push(Math.min(255, Math.round(cur[c] / 128))); cur[c] = 0; }
            n = 0;
          }
        }
        carry = b.subarray(whole);
      });
      p.on("error", reject);
      p.on("close", (code) => {
        if (n) for (let c = 0; c < ch; c++) bufs[c].push(Math.min(255, Math.round(cur[c] / 128)));
        if (code === 0) resolve(); else reject(new Error(`ffmpeg ${code}: ${err.trim().split("\n").pop() || ""}`));
      });
    });
    const res = { v: VERSION, rate: RATE, channels: ch, duration: bufs[0].length / RATE,
                  peaks: bufs.map((a) => Buffer.from(a).toString("base64")) };
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = out + ".part";
    await fs.promises.writeFile(tmp, JSON.stringify(res));
    await fs.promises.rename(tmp, out);
    return res;
  }

  /** {v, rate, channels, duration, peaks:[base64 Uint8 per channel]}; null when the src names no file. */
  async function get(src) {
    const file = resolveSrc(src);
    if (!file) return null;
    const st = await fs.promises.stat(file);
    const out = path.join(dir, keyFor(file, st));
    try { return JSON.parse(await fs.promises.readFile(out, "utf8")); } catch { }
    if (inflight.has(out)) return inflight.get(out);
    const job = chain.then(() => build(file, out));
    chain = job.catch(() => { });
    inflight.set(out, job);
    try { return await job; } finally { inflight.delete(out); }
  }

  /** Pipe the sound track alone (WAV, 16-bit, its own channels and rate) to `res`. */
  function streamAudio(src, res) {
    const file = resolveSrc(src);
    if (!file) { res.writeHead(404); res.end(); return; }
    const p = spawn(ffmpeg, ["-v", "error", "-nostdin", "-i", file, "-vn", "-acodec", "pcm_s16le", "-f", "wav", "pipe:1"],
      { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    res.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "no-store" });
    p.stdout.pipe(res);
    p.on("error", () => { try { res.end(); } catch { } });
    res.on("close", () => { try { p.kill(); } catch { } });
  }

  /* The sound of [from, from+len] of a file played at `speed` with its pitch kept (ffmpeg atempo; one stage takes
     0.5 to 2, so 0.25 is two of 0.5 and 4 two of 2), every channel kept: "Normal pitch" in the export mix (23 Nov). */
  function tempoChain(speed) {
    const parts = []; let left = speed;
    while (left < 0.5 - 1e-9) { parts.push("atempo=0.5"); left /= 0.5; }
    while (left > 2 + 1e-9) { parts.push("atempo=2.0"); left /= 2; }
    parts.push("atempo=" + left.toFixed(6));
    return parts.join(",");
  }
  function streamStretch(src, from, len, speed, res) {
    const file = resolveSrc(src);
    if (!file) { res.writeHead(404); res.end(); return; }
    if (!(from >= 0) || !(len > 0) || !(speed >= 0.25 && speed <= 4)) { res.writeHead(400); res.end(); return; }
    const p = spawn(ffmpeg, ["-v", "error", "-nostdin", "-ss", from.toFixed(4), "-t", len.toFixed(4), "-i", file, "-vn",
      "-af", tempoChain(speed), "-acodec", "pcm_s16le", "-f", "wav", "pipe:1"], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    res.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "no-store" });
    p.stdout.pipe(res);
    p.on("error", () => { try { res.end(); } catch { } });
    res.on("close", () => { try { p.kill(); } catch { } });
  }

  return { get, streamAudio, streamStretch, tempoChain, RATE };
}

module.exports = { createPeaks, RATE };
