/* Fades and transitions (Steve, 23 Nov 2026, for an edit that night):
   "1) Click the join between two clips -> "Transition" menu: None / Dip to black (fade out then fade in) /
   Cross fade / Dip to white. Length in seconds (default 1 s). Sound fades out and in with it.
   2) On any clip in the Inspector: "Fade in" and "Fade out" with a length in seconds, picture and sound together.
   4) Fades and transitions must use the FAST renderer (ffmpeg fade/xfade/afade), not frame by frame."

   Stored as the clips' own transitionIn / transitionOut, on the picture and on its sound stems alike:
     dip-black / dip-white  the picture goes to the colour and the sound fades, in a straight line. A join's Dip is
                            the clip before fading out over half the length and the clip after fading in over the other
                            half; Fade in / Fade out on one clip are the same thing at its start / end.
     cross                  the clip after starts `length` before the clip before ends (spare footage borrowed from
                            both sides, as Shift+D does, so nothing later moves) and its picture comes in over the other
                            in a straight line; the two sounds cross with equal-power curves.
   Straight lines because that is what ffmpeg's fade / xfade / afade do: the fast export matches the preview.
   Shared by the page (window.FableCutFades) and the tests (require). */
"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FableCutFades = api;
})(typeof self !== "undefined" ? self : this, function () {
  const JOINS = [["none", "None"], ["dip-black", "Dip to black"], ["cross", "Cross fade"], ["dip-white", "Dip to white"]];
  const DIPS = ["dip-black", "dip-white"];
  const DEFAULT_LENGTH = 1;
  const MIN = 0.1;
  const EPS = 1e-3;
  const end = (c) => c.start + c.duration;
  const r3 = (v) => +(+v).toFixed(3);

  /** Fade in / Fade out on a clip and its stems: `seconds` (0 = none), to black (or white). */
  function setFade(group, side, seconds, color = "black") {
    const key = side === "in" ? "transitionIn" : "transitionOut";
    const type = color === "white" ? "dip-white" : "dip-black";
    for (const x of group) {
      const s = Math.min(+seconds || 0, x.duration);
      x[key] = s >= MIN - 1e-9 ? { type, duration: r3(s) } : undefined;
    }
  }

  /** The fade on one side of a clip, as the Inspector shows it: {seconds, color} (seconds 0 = none). */
  function fadeOf(c, side) {
    const tr = side === "in" ? c.transitionIn : c.transitionOut;
    return tr && DIPS.includes(tr.type) ? { seconds: tr.duration, color: tr.type === "dip-white" ? "white" : "black" }
      : { seconds: 0, color: "black" };
  }

  /** The two clips either side of a join on one track at time t (the clip ending there and the one starting
   *  there, or two that overlap around it), or null. */
  function joinAt(clips, track, t, tol) {
    const lane = clips.filter((c) => c.track === track).sort((a, b) => a.start - b.start);
    for (let i = 0; i + 1 < lane.length; i++) {
      const a = lane[i], b = lane[i + 1];
      const lo = Math.min(end(a), b.start) - tol, hi = Math.max(end(a), b.start) + tol;
      if (b.start <= end(a) + tol && t >= lo && t <= hi) return { a, b };
    }
    return null;
  }

  /** What the join between a and b is now: {type, length}. */
  function joinOf(a, b) {
    const overlap = end(a) - b.start;
    if (overlap > EPS && b.transitionIn && ["cross", "fade", "dissolve"].includes(b.transitionIn.type))
      return { type: "cross", length: r3(overlap), ...(b.transitionIn.style ? { style: b.transitionIn.style } : {}) };
    const o = a.transitionOut, i = b.transitionIn;
    if (o && i && DIPS.includes(o.type) && o.type === i.type) return { type: o.type, length: r3(o.duration + i.duration) };
    if (i && DIPS.includes(i.type)) return { type: i.type, length: r3(i.duration * 2) };
    if (o && DIPS.includes(o.type)) return { type: o.type, length: r3(o.duration * 2) };
    return { type: "none", length: DEFAULT_LENGTH };
  }

  /** Set the join between a and b (the clips either side, on one track). h: the editor's own helpers —
   *  {withLinked(clips), crossfadeCut(a, b, seconds) -> null | why not, trimHead(clip, seconds), clipSpeed(clip)}.
   *  Returns null, or why it could not be done (then nothing is left half done: the join is plain). */
  function setJoin(a, b, type, length, h, style) {
    const ga = h.withLinked([a]), gb = h.withLinked([b]);
    // undo what is there: a cross fade's overlap goes back to a plain cut where it was made
    const overlap = end(a) - b.start;
    if (overlap > EPS) {
      const was = b.transitionIn && b.transitionIn.cut;
      const at = was != null && was > b.start - EPS && was < end(a) + EPS ? +was : b.start + overlap / 2;
      for (const x of ga) x.duration = r3(Math.max(0.05, at - x.start));
      for (const x of gb) if (at - x.start > EPS) h.trimHead(x, r3(at - x.start));
    }
    for (const x of ga) x.transitionOut = undefined;
    for (const x of gb) x.transitionIn = undefined;
    const L = Math.max(MIN, +length || DEFAULT_LENGTH);
    if (type === "none") return null;
    if (DIPS.includes(type)) {
      for (const x of ga) x.transitionOut = { type, duration: r3(Math.min(L / 2, x.duration)) };
      for (const x of gb) x.transitionIn = { type, duration: r3(Math.min(L / 2, x.duration)) };
      return null;
    }
    if (type !== "cross") return "unknown transition";
    const cut = end(a);
    const why = h.crossfadeCut(a, b, L);
    if (why) return why === "no spare media beyond the cut" ? "there is no spare footage either side of the cut to blend" : why;
    const d = r3(end(a) - b.start);
    for (const x of ga) x.transitionOut = x.kind === "audio" ? { type: "cross", duration: d, curve: "power" } : undefined;
    // 24 Nov: a transition from the Transitions panel is a cross fade with a style (ffmpeg's xfade name)
    const st = style && style !== "fade" ? { style: String(style) } : {};
    for (const x of gb) x.transitionIn = x.kind === "audio" ? { type: "cross", duration: d, curve: "power", cut: r3(cut) }
      : { type: "cross", duration: d, cut: r3(cut), ...st };
    return null;
  }

  return { JOINS, DIPS, DEFAULT_LENGTH, MIN, setFade, fadeOf, joinAt, joinOf, setJoin };
});
