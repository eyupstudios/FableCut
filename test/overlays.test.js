// Stickers, animated text and sound effects with the FAST renderer (Steve, 24 Nov): a plain title or picture on top of
// the cuts, and plain extra sound, go to Create Summat's overlay pass; anything it can't do is frame by frame, with why.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const C = require("../cuts-only.js");

const DEFAULTS = { volume: 1, pan: 0, audioChannel: null, speed: 1, speedSound: "normal", x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
function edit() {
  const stem = (track, ch) => ({ id: "a" + track, mediaId: "m", kind: "audio", track, start: 0, in: 0, duration: 20, linkGroup: "lg",
    props: { ...DEFAULTS, audioChannel: ch, pan: ch ? 1 : -1 } });
  return { name: "x", width: 1920, height: 1080, fps: 30, tracks: ["V3", "V2", "V1"].map((id) => ({ id, kind: "video" }))
      .concat(["A1", "A2", "A3"].map((id) => ({ id, kind: "audio" }))),
    media: [{ id: "m", kind: "video", src: "/media/rec.mp4", duration: 60, width: 1920, height: 1080, audioChannels: 2 },
            { id: "s", kind: "image", src: "/library/stickers/fluent-emoji/fire.png" },
            { id: "w", kind: "audio", src: "/library/sfx/createsummat/whoosh.mp3", duration: 0.9 }],
    clips: [{ id: "v", mediaId: "m", kind: "video", track: "V1", start: 0, in: 0, duration: 20, linkGroup: "lg", props: { ...DEFAULTS, volume: 0 } },
      stem("A1", 0), stem("A2", 1)] };
}

test("a sticker, a typewriter title and a sound effect on top: still the fast render, with them on", () => {
  const p = edit();
  p.clips.push({ id: "st", mediaId: "s", kind: "image", track: "V2", start: 2, in: 0, duration: 3, props: { ...DEFAULTS, scale: 0.4, rotation: 12, y: -120 },
    transitionIn: { type: "pop", duration: 0.45 }, transitionOut: { type: "fade", duration: 0.3 } });
  p.clips.push({ id: "t", kind: "text", track: "V3", start: 5, in: 0, duration: 4, props: { ...DEFAULTS, text: "GG", font: "Bebas Neue", color: "#B6F23A",
    textAnim: "typewriter", wordRate: 0.24, uppercase: true } });
  p.clips.push({ id: "sfx", mediaId: "w", kind: "audio", track: "A3", start: 2, in: 0, duration: 0.9, props: { ...DEFAULTS, volume: 0.8 } });
  const r = C.plan(p, DEFAULTS);
  assert.deepEqual(r.why, []);
  assert.ok(r.ok);
  assert.deepEqual(r.overlays.map((o) => [o.id, o.track]), [["st", "V2"], ["t", "V3"]]);      // V2 under V3, as drawn
  assert.deepEqual(r.overlays[0].tin, { type: "pop", duration: 0.45 });
  assert.equal(r.overlays[1].typewriter, 0.06);
  assert.deepEqual(r.sounds, [{ file: "/library/sfx/createsummat/whoosh.mp3", in: 0, at: 2, duration: 0.9, volume: 0.8, gain: 0, fadeIn: 0, fadeOut: 0 }]);
  assert.match(C.describe(r, true).text, /^Fast render\. .*with titles, stickers and sound effects on top/);
});

test("what the overlay pass can't do is frame by frame, with the reason", () => {
  const no = (change, word) => { const p = edit(); change(p); const r = C.plan(p, DEFAULTS);
    assert.equal(r.ok, false, word); assert.ok(r.why.join(" | ").includes(word), `${word}: ${r.why.join(" | ")}`); };
  no((p) => p.clips.push({ id: "t", kind: "text", track: "V2", start: 1, duration: 2, props: { ...DEFAULTS, text: "x" }, keyframes: { x: [{ t: 0, v: 0 }, { t: 1, v: 9 }] } }), "keyframes");
  no((p) => p.clips.push({ id: "t", kind: "text", track: "V2", start: 1, duration: 2, props: { ...DEFAULTS, text: "x", textAnim: "letter-pop" } }), "word by word");
  no((p) => p.clips.push({ id: "t", kind: "text", track: "V2", start: 1, duration: 2, props: { ...DEFAULTS, text: "x" }, transitionIn: { type: "spin", duration: 1 } }), "spin transition");
  no((p) => p.clips.push({ id: "i", mediaId: "s", kind: "image", track: "V2", start: 1, duration: 2, props: { ...DEFAULTS, blur: 5 } }), "blur changed");
  no((p) => p.clips.push({ id: "w2", mediaId: "w", kind: "audio", track: "A3", start: 1, duration: 0.9, props: { ...DEFAULTS }, fx: [{ type: "reverb" }] }), "sound effect on it");
});

test("the editor wires it: Text presets in the Brand kit, Stickers with your own image, Add my own sound, bounce, the PNGs sent", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  for (const t of ['data-tab="text"', 'data-tab="stickers"']) assert.ok(html.includes(t), t);
  for (const s of ["TEXT_PRESETS", "askHost(\"brand-request\"", "function renderStickersTab", "Add my own image", "Add my own sound",
    "case \"bounce\":", "function sfxTrack", "function bounceOut", "function rasterOverlay", "overlays, sounds: choice.plan.sounds"])
    assert.ok(app.includes(s), s);
  for (const id of ["pop", "slide", "typewriter", "bounce", "fade"]) assert.ok(app.includes(`id: "${id}"`), id);
  const paths = fs.readFileSync(path.join(__dirname, "..", "paths.js"), "utf8");
  assert.match(paths, /LIBRARY_SUBDIRS = \[[^\]]*"stickers"/);
  const stickers = fs.readdirSync(path.join(__dirname, "..", "library", "stickers", "fluent-emoji"));
  assert.ok(stickers.filter((f) => f.endsWith(".png")).length >= 120 && stickers.includes("LICENSE.txt"));
  assert.match(fs.readFileSync(path.join(__dirname, "..", "library", "stickers", "fluent-emoji", "LICENSE.txt"), "utf8"), /MIT License/);
  const sfx = fs.readdirSync(path.join(__dirname, "..", "library", "sfx", "createsummat"));
  for (const s of ["whoosh.mp3", "hit.mp3", "ding.mp3", "record-scratch.mp3", "crowd-cheer.mp3", "fail-trombone.mp3", "LICENSE.txt"]) assert.ok(sfx.includes(s), s);
});
