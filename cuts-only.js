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

    const videos = [], sounds = [];
    for (const c of project.clips) {
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
      if (cross) piece.cross = cross;
      out.pieces.push(piece);
    }
    if (sounds.some((s) => !used.has(s))) no("there is other sound on the timeline (music, a voice-over, or sound moved off its picture)");
    out.duration = at;

    if (opts.range && !why.length && out.pieces.some((p) => p.fadeIn || p.fadeOut || p.cross))
      no("an IN–OUT range with fades in it");
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
    if (!out.ok) out.pieces = [];
    return out;
  }

  /** The line the Export window shows. */
  function describe(p, hosted) {
    const fades = (p.pieces || []).some((x) => x.fadeIn || x.fadeOut || x.cross);
    if (p.ok && hosted) return { fast: true, text: `Fast render. This edit is only cuts${fades ? " and fades" : ""}, so Create Summat renders it straight from the recording.` };
    if (p.ok) return { fast: false, text: `Method: frame by frame. (Only cuts${fades ? " and fades" : ""}: inside Create Summat this would use its fast renderer.)` };
    return { fast: false, text: `Method: frame by frame, needed because ${p.why[0]}${p.why.length > 1 ? ` (and ${p.why.length - 1} more)` : ""}.` };
  }

  /** Smooth slow-mo: the extra seconds of work it adds (Create Summat's cutsrender.SMOOTH_X model, 23 Nov). */
  const SMOOTH_X = 20.3;
  function slowedSeconds(p) { return (p.pieces || []).filter((x) => x.speed < 1 - 1e-9).reduce((n, x) => n + (x.out - x.in) / x.speed, 0); }
  function smoothExtraSeconds(p, fps, height) { return slowedSeconds(p) * SMOOTH_X * Math.pow(height / 1080, 1.6) * (fps / 60); }

  return { plan, describe, slowedSeconds, smoothExtraSeconds, SMOOTH_X, SOUNDS, CLIP_KEYS, PROJECT_KEYS };
});
