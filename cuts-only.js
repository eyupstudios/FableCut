/* Is this project only cuts of recordings? (22 Nov 2026)

   Steve: "when an Editor project is only cuts of recordings (no titles/effects/transitions), Export uses Create
   Summat's fast renderer automatically; the Editor's frame-by-frame render only when it's needed. Show which one
   it's using." A 72-minute timeline is about 261,000 frames to draw one by one in the browser; the same two cuts
   straight from the recording take about a quarter of an hour.

   plan(project, defaults, opts) -> { ok, why: [plain words], pieces: [{file, in, out, at}], duration, fps }
   It says yes ONLY when it can see that the picture and the sound of the export would be the recording's own,
   cut: every doubt is a "no" with its reason, and the normal frame-by-frame export is used.
     - only video clips of recordings, on one track, one after the other from the start, no gaps, no overlaps;
     - nothing changed on them (every property as the editor sets it), no keyframes, no transitions; a constant
       speed (0.25x to 4x, 23 Nov) is fine: the picture and its sound share it, and the piece carries it with the
       sound choice (props.speedSound: normal / deep / mute);
     - each one's sound is its own untouched stereo pair (channel 1 left, channel 2 right, full level), nothing else
       on any sound track, no track / bus / master level or effect;
     - the recording has the project's shape (no bars, no crop).
   Shared by the page (window.CutsOnly) and the tests (require). */
"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CutsOnly = api;
})(typeof self !== "undefined" ? self : this, function () {
  const CLIP_KEYS = new Set(["id", "mediaId", "kind", "track", "start", "in", "duration", "name", "props", "linkGroup", "linkedId"]);
  const TRACK_KEYS = new Set(["id", "kind", "name", "height", "collapsed", "locked"]);
  const PROJECT_KEYS = new Set(["name", "width", "height", "fps", "background", "revision", "panSchema", "folders", "tracks",
    "media", "clips", "markers", "inPoint", "outPoint", "disabledTracks", "delivery", "encodeProfile", "notes", "tags", "id"]);
  const empty = (v) => v == null || v === false || v === "" || (Array.isArray(v) && !v.length) ||
    (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
  const clock = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };
  const fileOf = (src) => { try { return decodeURIComponent(String(src || "").split(/[\\/]/).pop()); } catch { return String(src || "").split(/[\\/]/).pop(); } };

  const SPEED_MIN = 0.25, SPEED_MAX = 4, SOUNDS = ["normal", "deep", "mute"];
  /* 23 Nov: fades and transitions the fast renderer makes itself (ffmpeg fade / xfade, the sound faded with it) -
     Fade in / out and Dip to black / white (dip-*), Cross fade (cross). See fades.js. */
  const FAST_FADES = ["dip-black", "dip-white", "cross"];
  /* 24 Nov (Steve: stickers, animated text and sound effects with the FAST renderer): on top of the cuts, titles and
     pictures (stickers, your own PNGs) on other video tracks, and sound effects / music on the sound tracks, are laid
     on by ffmpeg in one more pass (Create Summat's overlays.py). The Editor draws each title / picture once as a PNG
     (its rotation and size in it); ffmpeg places it, fades / pops / slides / bounces it in and out, and a typewriter
     title is one PNG per letter. Anything else (keyframes, masks, effects, word-by-word animations) is frame by frame. */
  const OVERLAY_KINDS = ["image", "text"];
  const OVERLAY_ANIMS = ["fade", "pop", "slide-left", "slide-right", "slide-up", "slide-down", "bounce"];
  const OVERLAY_PROPS = ["x", "y", "scale", "rotation", "opacity"];
  const TEXT_ANIMS_FAST = ["none", "typewriter"];
  const isTextStyle = (k) => !["x", "y", "scale", "rotation", "opacity", "blend", "matte", "matteTrack", "masks", "grade", "motionBlur",
    "brightness", "contrast", "saturation", "hue", "blur", "grayscale", "sepia", "invert", "temperature", "tint", "vignette", "shake",
    "rgbSplit", "grain", "filterPreset", "chromaKey", "bgRemove", "textPath", "pathOffset", "parent", "anchorX", "anchorY",
    "autoOrient", "cropL", "cropR", "cropT", "cropB", "flipH", "flipV", "cornerRadius"].includes(k);
  const near = (x, y, tol) => Math.abs(x - y) <= tol;
  /** The transition a sound stem must have for its picture's: the same kind and length (equal-power for a cross). */
  const sameFade = (s, want, tol) => (!s && !want) || (!!s && !!want && s.type === want.type && near(s.duration, want.duration, tol) &&
    (want.type === "cross" ? s.curve === "power" : !s.curve || s.curve === "linear"));
  const speedOf = (c, d) => { const v = Number((c.props || {}).speed != null ? c.props.speed : d.speed); return v > 0 ? v : 1; };
  const soundOf = (c, d) => { const v = (c.props || {}).speedSound != null ? c.props.speedSound : d.speedSound; return SOUNDS.includes(v) ? v : "normal"; };

  function plan(project, defaults, opts = {}) {
    const why = [];
    const no = (text) => { if (!why.includes(text)) why.push(text); };
    const fps = Number(project && project.fps) || 30, tol = 1.5 / fps;
    const out = { ok: false, why, pieces: [], duration: 0, fps };
    if (!project || !Array.isArray(project.clips) || !project.clips.length) { no("there is nothing on the timeline"); return out; }
    if (!defaults || typeof defaults !== "object") { no("the editor's default settings are not known here"); return out; }

    for (const k of Object.keys(project)) if (!PROJECT_KEYS.has(k) && !empty(project[k])) no(`the project has ${k} set`);
    if (!empty(project.disabledTracks)) no("a track is switched off");
    for (const t of project.tracks || []) for (const k of Object.keys(t)) if (!TRACK_KEYS.has(k) && !empty(t[k])) no(`track ${t.id} has ${k} set`);
    const media = new Map((project.media || []).map((m) => [m.id, m]));
    const shape = (project.width || 16) / (project.height || 9);

    const videos = [], sounds = [], overlays = [];
    for (const c of project.clips) {
      if (OVERLAY_KINDS.includes(c.kind)) { overlays.push(c); continue; }        // checked below, once the main track is known
      for (const k of Object.keys(c)) if (!CLIP_KEYS.has(k) && !empty(c[k])) {
        if ((k === "transitionIn" || k === "transitionOut") && FAST_FADES.includes(c[k].type)) continue;   // checked below
        no(k === "keyframes" ? `a clip at ${clock(c.start)} is animated (keyframes)`
          : k.startsWith("transition") ? `a clip at ${clock(c.start)} has a transition`
          : k === "fx" ? `a clip at ${clock(c.start)} has a sound effect` : `a clip at ${clock(c.start)} has ${k} set`);
      }
      if (c.kind === "video") videos.push(c);
      else if (c.kind === "audio") sounds.push(c);
      else no(`there is a ${c.kind === "text" ? "title" : c.kind || "clip of another kind"} at ${clock(c.start)}`);
    }
    if (!videos.length) { no("there is no video on the timeline"); return out; }
    if (new Set(videos.map((c) => c.track)).size > 1) no("video is on more than one track (something is layered)");

    // nothing changed on a clip: every property as the editor sets it (its sound's own three are checked below)
    const changed = (c, allow) => {
      const p = c.props || {};
      for (const k of new Set([...Object.keys(defaults), ...Object.keys(p)])) {
        if (allow.includes(k)) continue;
        const have = k in p ? p[k] : defaults[k], want = defaults[k];
        if (!(k in defaults)) { if (!empty(have)) return k; continue; }
        if (have !== want && !(typeof want === "number" && Math.abs(Number(have) - want) < 1e-9)) return k;
      }
      return "";
    };
    videos.sort((a, b) => a.start - b.start);
    let at = 0;                                            // the timeline starts with the first clip, at 0
    const used = new Set();
    for (let vi = 0; vi < videos.length; vi++) {
      const c = videos[vi], next = videos[vi + 1];
      const m = media.get(c.mediaId), where = clock(c.start);
      const tin = FAST_FADES.includes(c.transitionIn?.type) ? c.transitionIn : null;
      const tout = FAST_FADES.includes(c.transitionOut?.type) ? c.transitionOut : null;
      const cross = tin && tin.type === "cross" ? +tin.duration || 0 : 0;
      if (cross && !vi) no(`the clip at ${where} cross fades with nothing before it`);
      if (tout && tout.type === "cross") no(`the clip at ${where} has a cross fade on its end`);
      const nextCross = next && next.transitionIn?.type === "cross" ? +next.transitionIn.duration || 0 : 0;
      if (!m || m.kind !== "video") { no(`the clip at ${where} is not a recording`); continue; }
      if (m.width && m.height && Math.abs(m.width / m.height - shape) > 0.01) no(`the recording at ${where} is a different shape from the project`);
      const ch = changed(c, ["volume", "pan", "audioChannel", "speed", "speedSound"]);
      if (ch) no(`the clip at ${where} has ${ch} changed`);
      const sp = speedOf(c, defaults);
      if (!(sp >= SPEED_MIN - 1e-9 && sp <= SPEED_MAX + 1e-9)) no(`the clip at ${where} plays at ${sp}x (the fast render takes 0.25x to 4x)`);
      if (Math.abs(c.start - (at - cross)) > tol) no(c.start > at - cross ? `there is a gap before ${where}` : `clips overlap at ${where}`);
      at = c.start + c.duration;
      const wantIn = tin, wantOut = nextCross ? { type: "cross", duration: nextCross } : tout;
      // its sound: its own untouched stereo pair (or the one clip of a mono recording), and the picture clip itself silent
      const mine = sounds.filter((s) => s.mediaId === c.mediaId && Math.abs(s.start - c.start) <= tol &&
        Math.abs(s.in - c.in) <= tol && Math.abs(s.duration - c.duration) <= tol);
      mine.forEach((s) => used.add(s));
      const chans = Number(m.audioChannels) || 2;
      const pv = (c.props && c.props.volume) != null ? c.props.volume : defaults.volume;
      const good = pv === 0 && mine.length === Math.min(chans, 2) && mine.every((s) => {
        const p = s.props || {}, n = p.audioChannel == null ? 0 : p.audioChannel;
        const pan = chans >= 2 ? (n === 0 ? -1 : 1) : 0;
        return (p.volume == null ? 1 : p.volume) === 1 && (p.pan == null ? 0 : p.pan) === pan &&
          !changed(s, ["volume", "pan", "audioChannel", "speed", "speedSound"]) && Math.abs(speedOf(s, defaults) - sp) < 1e-9 &&
          soundOf(s, defaults) === soundOf(mine[0], defaults);
      }) && (chans < 2 || new Set(mine.map((s) => (s.props || {}).audioChannel || 0)).size === 2);
      if (!good) no(`the sound of the clip at ${where} was changed, moved or removed`);
      // its sound fades as its picture does (a fade or dip on the picture is on its stems too; a cross fade's sounds cross)
      if (mine.length && !mine.every((s) => sameFade(FAST_FADES.includes(s.transitionIn?.type) ? s.transitionIn : null, wantIn, tol) &&
        sameFade(FAST_FADES.includes(s.transitionOut?.type) ? s.transitionOut : null, wantOut, tol)))
        no(`the sound of the clip at ${where} fades differently from its picture`);
      if (tout && nextCross) no(`the clip at ${where} has a fade on its end and a cross fade after it`);
      const sound = mine.length ? soundOf(mine[0], defaults) : soundOf(c, defaults);
      const piece = { file: fileOf(m.src || m.name), in: c.in, out: c.in + c.duration * sp, at: c.start, speed: sp, sound };
      if (tin && tin.type !== "cross") { piece.fadeIn = +tin.duration; piece.fadeInColor = tin.type === "dip-white" ? "white" : "black"; }
      if (tout) { piece.fadeOut = +tout.duration; piece.fadeOutColor = tout.type === "dip-white" ? "white" : "black"; }
      if (cross) { piece.cross = cross; if (tin.style && tin.style !== "fade") piece.crossStyle = tin.style; }
      out.pieces.push(piece);
    }
    // 24 Nov: other sound (a sound effect, music) is mixed in by the overlay pass when it is plain: its own file, a level
    out.sounds = [];
    for (const s of sounds.filter((x) => !used.has(x))) {
      const m = media.get(s.mediaId), where = clock(s.start);
      const linked = s.linkGroup && project.clips.some((x) => x !== s && x.linkGroup === s.linkGroup && x.kind === "video");
      if (linked) { no("there is sound moved off its picture"); continue; }
      const extra = Object.keys(s).filter((k) => !CLIP_KEYS.has(k) && !empty(s[k]) && !(["transitionIn", "transitionOut"].includes(k) && s[k].type === "fade"));
      if (extra.length) { no(`the sound at ${where} has ${extra[0] === "fx" ? "a sound effect on it" : extra[0] === "keyframes" ? "level changes (keyframes)" : extra[0] + " set"}`); continue; }
      const sp = speedOf(s, defaults), bad = changed(s, ["volume", "gain", "audioChannel", "pan", "channelMode"]);
      if (bad || Math.abs(sp - 1) > 1e-9) { no(`the sound at ${where} has ${bad || "speed"} changed`); continue; }
      if (!m) { no(`the sound at ${where} has no file`); continue; }
      const p = s.props || {};
      out.sounds.push({ file: m.src || m.name, in: +s.in || 0, at: s.start, duration: s.duration,
        volume: p.volume != null ? +p.volume : 1, gain: +p.gain || 0,
        fadeIn: s.transitionIn ? +s.transitionIn.duration || 0 : 0, fadeOut: s.transitionOut ? +s.transitionOut.duration || 0 : 0 });
    }
    // titles and pictures over the picture
    out.overlays = [];
    const mainTrack = videos.length ? videos[0].track : null;
    for (const c of overlays) {
      const where = clock(c.start), p = c.props || {};
      if (c.track === mainTrack) { no(`there is a ${c.kind === "text" ? "title" : "picture"} between the cuts at ${where}`); continue; }
      const extra = Object.keys(c).filter((k) => !CLIP_KEYS.has(k) && !empty(c[k]) &&
        !(["transitionIn", "transitionOut"].includes(k) && OVERLAY_ANIMS.includes(c[k].type)));
      if (extra.length) { no(extra[0] === "keyframes" ? `the ${c.kind === "text" ? "title" : "picture"} at ${where} is animated with keyframes`
        : extra[0].startsWith("transition") ? `the ${c.kind === "text" ? "title" : "picture"} at ${where} has a ${c[extra[0]].type} transition`
        : `the ${c.kind === "text" ? "title" : "picture"} at ${where} has ${extra[0]} set`); continue; }
      const bad = Object.keys(p).find((k) => !OVERLAY_PROPS.includes(k) && !(c.kind === "text" && isTextStyle(k)) &&
        !(k === "fit" && p.fit === "contain") && !empty(p[k]) && !(k in defaults && (p[k] === defaults[k] || (typeof defaults[k] === "number" && Math.abs(+p[k] - defaults[k]) < 1e-9))));
      if (bad) { no(`the ${c.kind === "text" ? "title" : "picture"} at ${where} has ${bad} changed`); continue; }
      if (c.kind === "text" && !TEXT_ANIMS_FAST.includes(p.textAnim || "none")) { no(`the title at ${where} is animated word by word (${p.textAnim})`); continue; }
      if (c.kind === "image" && !media.get(c.mediaId)) { no(`the picture at ${where} has no file`); continue; }
      const tin = c.transitionIn && c.transitionIn.duration > 0 ? { type: c.transitionIn.type, duration: Math.min(+c.transitionIn.duration, c.duration) } : null;
      const tout = c.transitionOut && c.transitionOut.duration > 0 ? { type: c.transitionOut.type, duration: Math.min(+c.transitionOut.duration, c.duration) } : null;
      out.overlays.push({ id: c.id, kind: c.kind, track: c.track, start: c.start, end: c.start + c.duration, x: +p.x || 0, y: +p.y || 0,
        opacity: p.opacity != null ? +p.opacity : 1, tin, tout,
        typewriter: c.kind === "text" && p.textAnim === "typewriter" ? +(p.wordRate || 0.15) / 4 : 0 });
    }
    // lower tracks first (V2 under V3), as the editor draws them
    const order = (project.tracks || []).filter((t) => t.kind === "video").map((t) => t.id).reverse();
    out.overlays.sort((a, b) => (order.indexOf(a.track) - order.indexOf(b.track)) || (a.start - b.start));
    out.duration = at;

    if (opts.range && !why.length && out.pieces.some((p) => p.fadeIn || p.fadeOut || p.cross))
      no("an IN–OUT range with fades in it");
    if (opts.range && !why.length && (out.overlays.length || out.sounds.length))
      no("an IN–OUT range with titles, stickers or sound effects in it");
    if (opts.range && !why.length) {                       // IN–OUT: the same pieces, trimmed to the range
      const a = Number(opts.range.start) || 0, b = Number(opts.range.end);
      out.pieces = out.pieces.map((p) => {                 // timeline seconds x speed = recording seconds
        const s = Math.max(p.at, a), e = Math.min(p.at + (p.out - p.in) / p.speed, b);
        return e - s > tol ? { ...p, in: p.in + (s - p.at) * p.speed, out: p.in + (e - p.at) * p.speed, at: s } : null;
      }).filter(Boolean);
      out.duration = out.pieces.reduce((n, p) => n + (p.out - p.in) / p.speed, 0);
      if (!out.pieces.length) no("the IN–OUT range is empty");
    }
    out.ok = !why.length;
    if (!out.ok) { out.pieces = []; out.overlays = []; out.sounds = []; }
    return out;
  }

  /** The line the Export window shows. */
  function describe(p, hosted) {
    const fades = (p.pieces || []).some((x) => x.fadeIn || x.fadeOut || x.cross);
    const on = [(p.overlays || []).some((x) => x.kind === "text") && "titles", (p.overlays || []).some((x) => x.kind === "image") && "stickers",
      (p.sounds || []).length && "sound effects"].filter(Boolean);
    const what = `cuts${fades ? " and fades" : ""}${on.length ? ", with " + on.join(", ").replace(/, ([^,]*)$/, " and $1") + " on top" : ""}`;
    if (p.ok && hosted) return { fast: true, text: `Fast render. This edit is only ${what}, so Create Summat renders it straight from the recording.` };
    if (p.ok) return { fast: false, text: `Method: frame by frame. (Only cuts${fades ? " and fades" : ""}: inside Create Summat this would use its fast renderer.)` };
    return { fast: false, text: `Method: frame by frame, needed because ${p.why[0]}${p.why.length > 1 ? ` (and ${p.why.length - 1} more)` : ""}.` };
  }

  /** Smooth slow-mo: the extra seconds of work it adds (Create Summat's cutsrender.SMOOTH_X model, 23 Nov). */
  const SMOOTH_X = 20.3;
  function slowedSeconds(p) { return (p.pieces || []).filter((x) => x.speed < 1 - 1e-9).reduce((n, x) => n + (x.out - x.in) / x.speed, 0); }
  function smoothExtraSeconds(p, fps, height) { return slowedSeconds(p) * SMOOTH_X * Math.pow(height / 1080, 1.6) * (fps / 60); }

  return { plan, describe, slowedSeconds, smoothExtraSeconds, SMOOTH_X, SOUNDS, CLIP_KEYS, PROJECT_KEYS, OVERLAY_ANIMS };
});
