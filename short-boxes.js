/* Short boxes (Steve, 23 Nov 2026; Short mode 26 Nov 2026; Shorts tab + Main/Short switch 26 Nov evening).

   "+ Short" marks a Short on the timeline. It ENDS at the playhead and covers the 30 s before it ("I find the end of
   the moment, then press Short"); with In and Out set (I / O) it covers In to Out (3 min at most: the last 3 min).

   THE SHORTS TAB (beside Inspector / Mixer / Color / Transcript): every Short of the project with Preview, Export to
   Ready to post, Download, Delete and its own settings - start, end, length, frame position, its on-screen text, its
   speed and its look. Selecting one there selects it on the timeline (and the other way round).

   MAIN / SHORT (the switch beside "Preview speed"): in Short mode the monitor shows the selected Short at 9:16, fitted
   inside the monitor (the main picture small in a corner, switchable), with "Editing: Short 1" in big plain words.
   Everything done then - its trim, frame, text, speed, look - changes that Short only; edits to the main timeline
   (cut, delete, move clips, insert...) are stopped with a message. Main goes back. Esc too.

   THE FRAME: the 9:16 viewing box is moved WITH the mouse - drag it on the small main picture, or drag the big Short
   preview (the box moves the way the mouse goes, so the picture inside it slides the other way, like a camera).

   DELETE: Delete / Backspace, the right-click menu or the bin: always "Delete Short 1 (the marker only, your video
   and edit stay)". With a Short selected the main Delete never touches the edit.

   Export hands the footage under the Short (and its frame, text, speed and look) to Create Summat, which makes it
   vertical in the background. The main edit is never changed.

   PRECISE (27 Nov, Steve + two creators): the selected Short's start and end show as h:mm:ss.ff (ff = the frame) and
   can be typed; each steps by a frame, 1 s or 1 min (buttons; ← → a frame and Shift+← → 1 s for the edge last
   grabbed); grabbing an edge shows a close-up of that spot (pictures + the sound's waveform, zoomable; click it to
   put the edge on the exact frame); Play the cut loops just the Short, with an in/out preview (1 s before and after,
   shown as CUT OUT); Play around plays 1 s either side of one edge.

   Kept in the project as `shortBoxes: [{id, start, dur, name?, cropX?, accepted?, text?, speed?, look?}]`. The pure
   part is ShortBoxes.* and is tested on its own. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShortBoxes = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MIN = 15, MAX = 180, DEFAULT = 30;
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  // the looks a Short can have (its own, never the main edit's): canvas filter for the preview, the name Create
  // Summat renders with
  const LOOKS = { none: ["As it is", "none"], vivid: ["Vivid", "saturate(1.45) contrast(1.08)"],
                  bw: ["Black & white", "grayscale(1) contrast(1.1)"], warm: ["Warm", "sepia(0.25) saturate(1.2)"],
                  cool: ["Cool", "hue-rotate(-12deg) saturate(1.1)"] };

  /** A box kept inside the limits: 15 s to 3 min, never before 0. */
  function clamp(box, timelineEnd) {
    let start = Math.max(0, +box.start || 0);
    let dur = Math.min(MAX, Math.max(MIN, +box.dur || DEFAULT));
    if (timelineEnd > 0 && start + dur > timelineEnd && timelineEnd >= MIN) start = Math.max(0, Math.min(start, timelineEnd - dur));
    return { ...box, start: Math.round(start * 1000) / 1000, dur: Math.round(dur * 1000) / 1000 };
  }

  function cropOf(b) {
    const x = +b.cropX;
    return isFinite(x) && b.cropX !== null && b.cropX !== "" ? Math.min(1, Math.max(0, x)) : 0.5;
  }

  function normalize(list) {
    return (Array.isArray(list) ? list : []).filter((b) => b && typeof b === "object" && isFinite(+b.start)).slice(0, 50)
      .map((b, i) => ({ ...clamp(b, 0), id: String(b.id || "sb" + (i + 1)), name: String(b.name || "").slice(0, 80),
        cropX: Math.round(cropOf(b) * 1000) / 1000, accepted: b.accepted === true,
        text: String(b.text || "").slice(0, 80), speed: SPEEDS.includes(+b.speed) ? +b.speed : 1,
        look: Object.prototype.hasOwnProperty.call(LOOKS, b.look) ? b.look : "none",
        ...(b.frame ? { frame: normFrame(b.frame) } : {}) }))
      .map((b, i, all) => all.findIndex((x) => x.id === b.id) < i ? { ...b, id: b.id + "_" + (i + 1) } : b);   // ids are unique
  }

  /** Where "+ Short" puts a new box: In-Out when both are set (over 3 min: the last 3 min, ending at Out); else the box
   *  ENDS at the playhead and covers the 30 s before it (from 0 when nearer the start; 15 s at least). */
  function forPlayhead(time, inPoint, outPoint, timelineEnd) {
    if (inPoint != null && outPoint != null && isFinite(+inPoint) && isFinite(+outPoint) && +outPoint > +inPoint) {
      let start = +inPoint, dur = +outPoint - +inPoint;
      if (dur > MAX) { start = +outPoint - MAX; dur = MAX; }
      return { ...clamp({ start, dur: Math.max(MIN, dur) }, timelineEnd), from: "io" };
    }
    const end = Math.max(0, +time || 0);
    let start = end - DEFAULT, dur = DEFAULT;
    if (start < 0) { start = 0; dur = Math.max(MIN, end); }
    return { ...clamp({ start, dur }, timelineEnd), from: "playhead" };
  }

  /** "0:30", "2:05" */
  function length(sec) {
    const s = Math.max(0, Math.round(+sec || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /** "1:05.2" <-> 65.2 (the Shorts tab's start / end fields) */
  function clock(t) { t = Math.max(0, +t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + s.toFixed(1).padStart(4, "0"); }
  function parseClock(s) {
    const m = String(s || "").trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    return m ? (+(m[1] || 0)) * 60 + +m[2] : NaN;
  }

  /** 27 Nov: h:mm:ss.ff (ff = the frame within the second) <-> seconds. Typing: "1:02:03.15", "2:03.15", "2:03",
   *  "75", "75.12" (after the dot = frames). */
  function tc(t, fps) {
    fps = +fps > 0 ? +fps : 30;
    const n = Math.max(0, Math.round((+t || 0) * fps)), s = Math.floor(n / fps + 1e-9), ff = Math.max(0, n - Math.round(s * fps));
    return Math.floor(s / 3600) + ":" + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0") + "." + String(ff).padStart(2, "0");
  }
  function parseTc(str, fps) {
    fps = +fps > 0 ? +fps : 30;
    const m = String(str || "").trim().match(/^(?:(\d+):)?(?:(\d+):)?(\d+)(?:[.,](\d+))?$/);
    if (!m) return NaN;
    let s = 0;
    for (const x of [m[1], m[2], m[3]].filter((x) => x != null)) s = s * 60 + +x;
    return s + (m[4] ? Math.min(+m[4], Math.ceil(fps) - 1) / fps : 0);
  }
  function snapTo(t, fps) { fps = +fps > 0 ? +fps : 30; return Math.round((+t || 0) * fps) / fps; }

  /** One edge of a box put at time `to` (on a frame); the other edge stays. 15 s to 3 min, never before 0, never past
   *  the end of the edit. */
  function moveEdge(box, edge, to, timelineEnd, fps) {
    const s0 = +box.start, e0 = +box.start + +box.dur;
    let s = s0, e = e0;
    if (edge === "start") s = Math.max(0, e0 - MAX, Math.min(snapTo(to, fps), e0 - MIN));
    else {
      e = Math.min(Math.max(snapTo(to, fps), s0 + MIN), s0 + MAX);
      if (timelineEnd > 0) e = Math.min(e, Math.max(s0 + MIN, timelineEnd));
    }
    return { ...box, start: Math.round(s * 1000) / 1000, dur: Math.round((e - s) * 1000) / 1000 };
  }

  /** What is under timeline time `t` on the lowest video lane: {src, at (the time in that file), speed, from, to (the
   *  clip on the timeline)} - the close-up's pictures and waveform come from it. null: no footage there. */
  function sourceAt(project, t) {
    const media = new Map((project.media || []).map((m) => [m.id, m]));
    const c = (project.clips || []).filter((c) => !c.disabled && c.kind === "video" && /^V\d+$/.test(c.track || "")
      && c.start <= t && t < c.start + c.duration).sort((x, y) => +x.track.slice(1) - +y.track.slice(1))[0];
    const m = c && media.get(c.mediaId);
    if (!m || !m.src) return null;
    const sp = (c.props && +c.props.speed) || 1;
    return { clip: c, mediaId: m.id, src: m.src, at: +(c.in + (t - c.start) * sp).toFixed(4), speed: sp, from: c.start, to: c.start + c.duration };
  }

  /** 27 Nov (Steve): Action shot / Follow / keyframes. A Short's `frame`: {mode: "still" | "action" | "follow",
   *  path: [[t, crop], ...] (t = seconds of the Short, crop 0..1 left..right, worked out by Create Summat),
   *  keys: [{t, x, back}] (x = crop 0..1; back = glide back to the path from here)}. */
  const FRAME_MODES = ["still", "action", "follow"];
  const GLIDE = 0.8;                       // s: a keyframe's glide (reframe.py's "medium")
  function normFrame(f) {
    if (!f || typeof f !== "object") return null;
    const mode = FRAME_MODES.includes(f.mode) ? f.mode : "still";
    const path = (Array.isArray(f.path) ? f.path : []).filter((p) => Array.isArray(p) && isFinite(+p[0]) && isFinite(+p[1]))
      .slice(0, 6000).map((p) => [+(+p[0]).toFixed(3), Math.min(1, Math.max(0, +p[1]))]);
    const keys = (Array.isArray(f.keys) ? f.keys : []).filter((k) => k && isFinite(+k.t)).slice(0, 80)
      .map((k) => ({ t: +(+k.t).toFixed(3), x: Math.min(1, Math.max(0, isFinite(+k.x) ? +k.x : 0.5)), back: k.back === true }))
      .sort((a, b) => a.t - b.t);
    return { mode, path, keys, kind: String(f.kind || "").slice(0, 20) };
  }
  const easeS = (s) => { s = Math.min(1, Math.max(0, s)); return s * s * (3 - 2 * s); };
  function interpPath(path, t) {
    if (!path.length) return null;
    if (t <= path[0][0]) return path[0][1];
    if (t >= path[path.length - 1][0]) return path[path.length - 1][1];
    let lo = 0, hi = path.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][0] <= t) lo = m; else hi = m; }
    const [t0, c0] = path[lo], [t1, c1] = path[hi];
    return c0 + (c1 - c0) * (t - t0) / Math.max(1e-9, t1 - t0);
  }
  /** Where the 9:16 window is (crop 0..1) at second `t` of the Short - the path (Action shot / Follow) or the fixed
   *  position, with the keyframes gliding in: each glides (eased, 0.8 s) from wherever the window is to its
   *  position, arriving at its time, then holds until the next key's glide; a "back" key glides back to the path
   *  and follows it. EXACTLY reframe.path in Create Summat, so the export is what the preview shows. */
  function frameAt(b, t) {
    const f = normFrame(b && b.frame);
    const fixed = cropOf(b || {});
    const auto = (x) => (f && f.mode !== "still" && f.path.length ? interpPath(f.path, x) : fixed);
    const keys = f ? f.keys : [];
    const val = (n, x) => {                // the window at x, counting the first n keys only
      let i = -1, g0 = 0;
      for (let k = n - 1; k >= 0; k--) {
        const g = Math.max(keys[k].t - GLIDE, k ? keys[k - 1].t : -1e18);
        if (g <= x) { i = k; g0 = g; break; }
      }
      if (i < 0) return auto(x);
      const k = keys[i], start = val(i, g0);
      const s = easeS((x - g0) / Math.max(keys[i].t - g0, 1e-6));
      const target = k.back ? auto(x) : k.x;
      return Math.min(1, Math.max(0, start + s * (target - start)));
    };
    return val(keys.length, t);
  }

  /** The 9:16 window over a picture `w` x `h` at frame position `cropX`: {x, w} in the picture's pixels. */
  function window916(w, h, cropX) {
    const fw = Math.min(w, Math.round(h * 9 / 16));
    return { x: Math.round((w - fw) * (isFinite(+cropX) ? Math.min(1, Math.max(0, +cropX)) : 0.5)), w: fw };
  }

  /** Dragging the 9:16 viewing box (26 Nov: "dragging must move the frame box with the mouse"): the new frame
   *  position after the mouse moved `dxScreen` px over a view where `pxPerSource` screen px show one picture px. The
   *  box always moves the way the mouse goes (right = towards the picture's right edge). */
  function dragCrop(cropX0, dxScreen, pxPerSource, picW, picH) {
    const room = picW - Math.min(picW, Math.round(picH * 9 / 16));
    if (room <= 0 || !(pxPerSource > 0)) return cropOf({ cropX: cropX0 });
    return Math.round(Math.min(1, Math.max(0, cropOf({ cropX: cropX0 }) + dxScreen / pxPerSource / room)) * 1000) / 1000;
  }

  /** What the delete asks, always the same words (Steve, 26 Nov). */
  function deleteText(n, name) {
    return `Delete Short ${n}${name ? ` "${name}"` : ""} (the marker only, your video and edit stay)`;
  }

  /** The footage under a box: the video clips on the lowest video lane that has any, each cut to the box, as
   *  [{file, in, out, at}] (file = the media's file name). Titles, effects and the other lanes are not footage:
   *  `extra` counts the clips under the box that are not in it (they are left out of the Short, and the editor says so). */
  function footage(project, box) {
    const a = box.start, b = box.start + box.dur;
    const media = new Map((project.media || []).map((m) => [m.id, m]));
    const vids = (project.clips || []).filter((c) => !c.disabled && c.kind === "video" && /^V\d+$/.test(c.track || "")
      && c.start < b && c.start + c.duration > a);
    const lanes = [...new Set(vids.map((c) => +c.track.slice(1)))].sort((x, y) => x - y);
    const lane = lanes.length ? "V" + lanes[0] : null;
    const pieces = [];
    let slowed = 0;
    for (const c of vids.filter((c) => c.track === lane).sort((x, y) => x.start - y.start)) {
      const m = media.get(c.mediaId);
      if (!m) continue;
      const sp = (c.props && +c.props.speed) || 1;
      if (sp !== 1 || (c.keyframes && c.keyframes.speed)) slowed++;
      const s = Math.max(a, c.start), e = Math.min(b, c.start + c.duration);
      const file = String(m.src || "").replace(/^\/media\//, "") || m.name;
      pieces.push({ file, in: +(c.in + (s - c.start) * sp).toFixed(4), out: +(c.in + (e - c.start) * sp).toFixed(4), at: +(s - a).toFixed(4) });
    }
    const others = (project.clips || []).filter((c) => !c.disabled && c.start < b && c.start + c.duration > a
      && !(c.kind === "video" && c.track === lane) && c.kind !== "audio");
    return { pieces, extra: others.length, slowed, gaps: pieces.length ? Math.max(0, box.dur - pieces.reduce((n, p) => n + (p.out - p.in), 0)) : box.dur };
  }

  return { MIN, MAX, DEFAULT, SPEEDS, LOOKS, clamp, normalize, forPlayhead, length, clock, parseClock, window916, dragCrop,
           deleteText, footage, cropOf, tc, parseTc, snapTo, moveEdge, sourceAt, normFrame, frameAt, interpPath, GLIDE };
});

/* -- the editor side (only in a browser with the editor loaded) ------------------------------------------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const SBX = ShortBoxes;
  const normFrame = SBX.normFrame;
  const boxesNow = () => SBX.normalize(project.shortBoxes);
  const labelOf = (b, i) => b.name || `Short ${i + 1}`;
  let selId = null;          // the Short in Short mode
  let playEnd = null;        // its Play: stop here
  let playRate0 = null;      // the preview speed before a Short's own speed played
  let raf = 0;
  let showMain = true;       // the small main picture in Short mode
  let edge = null;           // 27 Nov: "start" / "end" - the edge last grabbed (← → move it)
  let barView = null;        // 27 Nov: the one bar's view {id, lo, hi} (timeline seconds)
  let followPick = false;    // Follow this person: the next click on the main picture picks them
  let frameBusy = "";        // "Working out the Action shot..."
  const AROUND = 60;         // s shown either side of the Short when the bar fits
  let ioPreview = false;     // Play the cut: 1 s before and after too
  let playFrom = null, playLoop = false;   // the range playing loops (Loop ticked); Play around plays once
  let shortLoop = false;     // 28 Nov (Steve): Play plays the Short ONCE (start to end) - Loop is off by default
  const fpsNow = () => (typeof projectFps === "function" ? projectFps() : +project.fps || 30) || 30;
  const STEPS = [["-60", "−1 min"], ["-1", "−1 s"], ["-f", "◀ frame"], ["f", "frame ▶"], ["1", "+1 s"], ["60", "+1 min"]];
  try { showMain = localStorage.getItem("fc.shortShowMain") !== "0"; } catch { /* only a remembered choice */ }

  const making = new Map();  // Shorts being made right now (box id -> "making"): runtime only
  window.shortBoxesMaking = making;

  window.addShortBox = function addShortBox() {
    const boxes = boxesNow();
    const end = typeof projDur === "function" ? projDur() : 0;
    const p = SBX.forPlayhead(state.time, project.inPoint, project.outPoint, end);
    const b = { id: "sb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: p.start, dur: p.dur, name: "",
                cropX: 0.5, accepted: false, text: "", speed: 1, look: "none" };
    if (typeof pushUndo === "function") pushUndo();
    project.shortBoxes = boxes.concat([b]);
    scheduleSave();
    toast(p.from === "io" ? `Short added from In to Out (${SBX.length(b.dur)}).` : `Short added: the ${SBX.length(b.dur)} before the playhead.`);
    selectShort(b.id);
  };

  /* -- the top bar button: the Shorts tab --------------------------------------------------------------------------- */
  function syncExportShortsButton() {
    const btn = document.getElementById("btnExportShorts");
    if (!btn) return;
    const boxes = boxesNow();
    btn.textContent = `Shorts (${boxes.length})`;
    btn.disabled = false;
    btn.classList.add("hidden");                          // 26 Nov: the Shorts tab is the place (the toolbar stays narrow)
    btn.title = "Your Shorts: the Shorts tab (preview, export, download, delete, settings)";
  }
  window.syncExportShortsButton = syncExportShortsButton;
  window.toggleShortsList = function toggleShortsList() { if (typeof setSideTab === "function") setSideTab("shorts"); };
  window.exportAllShorts = function exportAllShorts() {
    const all = boxesNow();
    const boxes = all.filter((b) => b.accepted && !making.has(b.id));
    if (!boxes.length) return toast(all.length ? "Accept a Short first (its tick in the Shorts tab)" : "Add a Short first (+ Short)");
    let sent = 0;
    boxes.forEach((b) => { if (createShortFromBox(b, labelOf(b, all.findIndex((x) => x.id === b.id)), { quiet: true })) sent++; });
    if (sent) toast(`Making ${sent} Short${sent > 1 ? "s" : ""} in the background (Create Summat's jobs list). Each one is in Library > Shorts when it is done. Keep editing.`);
  };

  /* -- the Shorts tab (beside Inspector / Mixer / Color / Transcript) ----------------------------------------------- */
  window.renderShortsPage = function renderShortsPage() {
    const page = document.getElementById("shortsPage");
    if (!page || page.classList.contains("hidden")) return;
    if (page.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;   // not while typing
    const boxes = boxesNow(), acc = boxes.filter((b) => b.accepted && !making.has(b.id)).length;
    page.innerHTML = `<div class="sbt-head"><button type="button" class="btn tiny accent" data-sbt="add" title="A Short ending at the playhead (or In to Out)">+ Short</button>` +
      `<button type="button" class="btn tiny" data-sbt="all" ${acc ? "" : "disabled"} title="Make every ticked Short (each in the background)">Export all ticked (${acc})</button></div>` +
      (boxes.length ? boxes.map((b, i) => {
        const on = b.id === selId, busy = making.has(b.id), name = labelOf(b, i);
        return `<div class="sbt${on ? " on" : ""}" data-id="${b.id}">` +
          `<div class="sbt-top"><label class="sbt-acc" title="Ticked Shorts go with Export all"><input type="checkbox" data-f="accepted" ${b.accepted ? "checked" : ""}></label>` +
          `<input class="sbt-name" data-f="name" value="${escapeHtmlSb(b.name)}" placeholder="${escapeHtmlSb(name)}" maxlength="80">` +
          `<span class="sbt-len">${SBX.length(b.dur)}</span></div>` +
          (on ? `<div class="sbt-grid">` +
            preciseHtml(b) +
            frameHtml(b) +
            `<label class="wide">On-screen text <span class="dim">(this Short only)</span><input data-f="text" value="${escapeHtmlSb(b.text)}" maxlength="80" placeholder="e.g. BUSTED"></label>` +
            `<label>Speed<select data-f="speed">${SBX.SPEEDS.map((s) => `<option value="${s}" ${s === b.speed ? "selected" : ""}>${s}×</option>`).join("")}</select></label>` +
            `<label>Look<select data-f="look">${Object.entries(SBX.LOOKS).map(([k, [n]]) => `<option value="${k}" ${k === b.look ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>` : "") +
          `<div class="sbt-acts">` + (busy ? `<span class="sb-busy">Making…</span>` :
            `<button type="button" class="btn tiny accent" data-sbt="preview" title="Plays just this Short, from its start to its end - Pause / Resume (or the space bar)${on && ioPreview ? " (with 1 s before and after: In/out preview)" : ""}">${playLabel(on)}</button>` +
            (on && playEnd != null ? `<button type="button" class="btn tiny" data-sbt="stop" title="Stop: back to the start">■ Stop</button>` : "") +
            `<button type="button" class="btn tiny accent" data-sbt="export" title="Make it vertical and open its Ready to post page (in the background)">Export to Ready to post</button>` +
            `<button type="button" class="btn tiny" data-sbt="download">Download</button>`) +
            `<button type="button" class="btn tiny sb-bin" data-sbt="delete" title="${escapeHtmlSb(SBX.deleteText(i + 1, b.name))}">🗑 Delete</button></div></div>`;
      }).join("") : `<p class="dim sbt-empty">No Shorts yet. Put the playhead at the END of a moment and press <b>+ Short</b> (the 30 s before it), or set In and Out first.</p>`);
    page.querySelectorAll("[data-sbt]").forEach((x) => x.onclick = (e) => {
      e.stopPropagation();
      const act = x.dataset.sbt, row = x.closest(".sbt");
      if (act === "add") return addShortBox();
      if (act === "all") return exportAllShorts();
      const all = boxesNow(), i = all.findIndex((y) => y.id === row.dataset.id), b = all[i];
      if (!b) return;
      if (act === "preview") { selectShort(b.id); playShort(); }
      else if (act === "stop") { stopShortPlay(true); renderShortsPage(); }
      else if (act === "bzin" || act === "bzout") zoomBar(b, act === "bzin" ? 0.5 : 2);
      else if (act === "bfit") { barView = null; paintBar(); }
      else if (act === "fmode") setFrameMode(b.id, x.dataset.v);
      else if (act === "fkey") addKey(b.id, false);
      else if (act === "fback") addKey(b.id, true);
      else if (act === "fclear") update((y) => { y.frame = { ...(normFrame(y.frame) || { mode: "still", path: [] }), keys: [] }; renderShortsPage(); sendList(); });
      else if (act === "fdel") update((y) => { const f = normFrame(y.frame); f.keys.splice(+x.dataset.v, 1); y.frame = f; renderShortsPage(); sendList(); });
      else if (act === "step") { const [w, d] = x.dataset.v.split(":"); stepEdge(b.id, w, d); }
      else if (act === "around") playAround(b.id, x.dataset.v);
      else if (act === "export") createShortFromBox(b, labelOf(b, i));
      else if (act === "download") downloadShort(b, labelOf(b, i));
      else if (act === "delete") askDelete(b.id);
    });
    page.querySelectorAll(".sbt").forEach((row) => row.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, input[type=checkbox]")) return;
      if (row.dataset.id !== selId) selectShort(row.dataset.id);
    }));
    const io = page.querySelector("[data-io]");
    if (io) io.onchange = () => { ioPreview = io.checked; };
    const lp = page.querySelector(".sbt.on [data-loop]");
    if (lp) lp.onchange = () => { shortLoop = lp.checked; if (playEnd != null && playFrom != null) playLoop = shortLoop; };
    page.querySelectorAll("[data-edge]").forEach((r) => r.addEventListener("pointerdown", () => { if (edge !== r.dataset.edge) { edge = r.dataset.edge; paintBar(); markEdgeRows(); } }));
    wireBar(page.querySelector(".sbt-bar"));
    paintBar();
    page.querySelectorAll("[data-f]").forEach((inp) => {
      const id = inp.closest(".sbt").dataset.id, f = inp.dataset.f;
      const commit = () => setField(id, f, inp.type === "checkbox" ? inp.checked : inp.value);
      inp.addEventListener(inp.type === "range" ? "input" : "change", commit);
      if (inp.tagName === "INPUT" && inp.type !== "range" && inp.type !== "checkbox") inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    });
  };

  /** A Short's own setting changed (never the main edit). */
  function setField(id, f, v) {
    const all = boxesNow(), b = all.find((x) => x.id === id);
    if (!b) return;
    const end = typeof projDur === "function" ? projDur() : 0;
    if (f === "start" || f === "end") {
      const t = SBX.parseTc(v, fpsNow());
      if (!isFinite(t)) { toast("Type the time as h:mm:ss.ff, for example 0:12:34.05 (05 = the 5th frame)"); renderShortsPage(); return; }
      const s = f === "start" ? t : b.start, e = f === "end" ? t : b.start + b.dur;
      if (e - s < SBX.MIN || e - s > SBX.MAX) toast(`A Short is ${SBX.MIN} s to ${SBX.MAX / 60} min: kept inside that`);
      edge = f;
      Object.assign(b, SBX.moveEdge(b, f, t, end, fpsNow()));
      showEdge(b);
    } else if (f === "accepted") b.accepted = !!v;
    else if (f === "cropX") b.cropX = Math.min(1, Math.max(0, +v));
    else if (f === "speed") b.speed = +v;
    else if (f === "look" || f === "text" || f === "name") b[f] = String(v).slice(0, 80);
    if (typeof pushUndo === "function" && f !== "cropX") pushUndo();
    project.shortBoxes = all;
    scheduleSave();
    sendList();
    if (f !== "cropX" && f !== "text" && f !== "name") renderShortsPage();
    paintShortBoxes(true);
  }

  /* -- 27 Nov: precise start / end ----------------------------------------------------------------------------------- */
  function preciseHtml(b) {
    const fps = fpsNow();
    const row = (w, name, t) => `<div class="sbt-edge${edge === w ? " on" : ""}" data-edge="${w}"><label>${name}<input data-f="${w}" class="sbt-tc" value="${SBX.tc(t, fps)}" spellcheck="false" title="Type a time: h:mm:ss.ff (ff = the frame), then Enter"></label>` +
      `<span class="sbt-steps">${STEPS.map(([d, l]) => `<button type="button" class="btn tiny" data-sbt="step" data-v="${w}:${d}" title="${d.includes("f") ? "One frame" + (d[0] === "-" ? " back" : " on") + " (← →)" : l + (Math.abs(+d) === 1 ? " (Shift + ← →)" : "")}">${l}</button>`).join("")}</span></div>`;
    return `<div class="sbt-precise wide">${row("start", "Start", b.start)}${row("end", "End", b.start + b.dur)}` +
      `<div class="sbt-lenrow">Length <b class="sbt-tclen">${SBX.tc(b.dur, fps)}</b><label class="sbt-io" title="Play the cut also plays 1 s before the start and 1 s after the end, shown as CUT OUT"><input type="checkbox" data-io ${ioPreview ? "checked" : ""}> In/out preview</label><label class="sbt-io" title="Plays the Short round and round until you press Pause"><input type="checkbox" data-loop ${shortLoop ? "checked" : ""}> Loop</label></div>` +
      `<div class="sbt-bar" title="Drag the two handles in or out. Click to jump there; drag the empty bar to move along. Mouse wheel: zoom (down to single frames); Shift + wheel: move along.">` +
      `<div class="sbb-head"><span class="dim sbb-win"></span><button type="button" class="btn tiny" data-sbt="bzout" title="Zoom out: more around the Short">−</button><button type="button" class="btn tiny" data-sbt="bzin" title="Zoom in, down to single frames">+</button><button type="button" class="btn tiny" data-sbt="bfit" title="The whole Short and 60 s either side">Fit</button></div>` +
      `<div class="sbb-body"><div class="sbb-thumbs"></div><canvas class="sbb-wave" height="40"></canvas><i class="sbb-dim l"></i><i class="sbb-dim r"></i>` +
      `<span class="sbb-keys"></span><i class="sbb-h s" title="The start: drag it in or out"></i><i class="sbb-h e" title="The end: drag it in or out"></i><i class="sbb-play"></i></div>` +
      `<div class="dim sbb-now"></div></div></div>`;
  }
  function markEdgeRows() {
    document.querySelectorAll("#shortsPage .sbt-edge").forEach((r) => r.classList.toggle("on", r.dataset.edge === edge));
  }
  /** After an edge moved: its new times in the tab (not re-rendered while typing), the band, the close-up, and the
   *  playhead on that edge's frame (the start's first frame / the end's last frame) so the monitor shows it. */
  function showEdge(b) {
    const fps = fpsNow(), page = document.getElementById("shortsPage");
    if (page) {
      const row = page.querySelector(`.sbt[data-id="${b.id}"]`);
      if (row) {
        for (const w of ["start", "end"]) { const el = row.querySelector(`input[data-f="${w}"]`); if (el && document.activeElement !== el) el.value = SBX.tc(w === "start" ? b.start : b.start + b.dur, fps); }
        const L = row.querySelector(".sbt-tclen"); if (L) L.textContent = SBX.tc(b.dur, fps);
        const l2 = row.querySelector(".sbt-len"); if (l2) l2.textContent = SBX.length(b.dur);
      }
    }
    if (edge && typeof setTime === "function") setTime(edge === "start" ? b.start : Math.max(b.start, b.start + b.dur - 1 / fps));
    markEdgeRows();
    paintBar();
  }
  function stepEdge(id, w, d) {
    const all = boxesNow(), b = all.find((x) => x.id === id);
    if (!b) return;
    stopShortPlay();
    const fps = fpsNow(), cur = w === "start" ? b.start : b.start + b.dur;
    const to = d === "f" ? cur + 1 / fps : d === "-f" ? cur - 1 / fps : cur + +d;
    edge = w;
    if (typeof pushUndo === "function") pushUndo();
    Object.assign(b, SBX.moveEdge(b, w, to, typeof projDur === "function" ? projDur() : 0, fps));
    project.shortBoxes = all;
    scheduleSave();
    sendList();
    paintShortBoxes(true);
    showEdge(b);
  }
  window.shortStepEdge = (w, d) => { if (selId) stepEdge(selId, w, d); };

  /* -- 27 Nov (Steve): ONE bar - pictures + the sound, the Short and 60 s either side (dimmed outside), both
     handles drag in or out, zoom with the wheel / + / - down to single frames, Fit ------------------------------------ */
  function fitView(b) {
    const L = typeof projDur === "function" ? projDur() : b.start + b.dur + AROUND;
    return { id: b.id, lo: Math.max(0, b.start - AROUND), hi: Math.min(Math.max(L, b.start + b.dur), b.start + b.dur + AROUND) };
  }
  function viewOf(b) {
    if (!barView || barView.id !== b.id) barView = fitView(b);
    return barView;
  }
  function setBarView(b, lo, hi) {
    const L = typeof projDur === "function" ? projDur() : hi, fps = fpsNow();
    const span = Math.max(12 / fps, Math.min(Math.max(L, 1), hi - lo));
    lo = Math.max(0, Math.min(lo, Math.max(0, L - span)));
    barView = { id: b.id, lo, hi: lo + span };
    paintBar();
  }
  function zoomBar(b, f, at) {
    const v = viewOf(b);
    at = at ?? (edge === "end" ? b.start + b.dur : edge === "start" ? b.start : (v.lo + v.hi) / 2);
    setBarView(b, at - (at - v.lo) * f, at - (at - v.lo) * f + (v.hi - v.lo) * f);
  }
  let barPicsKey = "";
  function paintBar() {
    const [b] = current(), box = document.querySelector("#shortsPage .sbt.on .sbt-bar");
    if (!box || !b) return;
    const v = viewOf(b), fps = fpsNow(), span = v.hi - v.lo;
    const X = (t) => (t - v.lo) / span * 100, s = b.start, e = b.start + b.dur;
    box.querySelector(".sbb-dim.l").style.width = Math.max(0, Math.min(100, X(s))) + "%";
    box.querySelector(".sbb-dim.r").style.left = Math.max(0, Math.min(100, X(e))) + "%";
    box.querySelector(".sbb-dim.r").style.width = Math.max(0, 100 - Math.max(0, X(e))) + "%";
    const hs = box.querySelector(".sbb-h.s"), he = box.querySelector(".sbb-h.e");
    hs.style.left = X(s) + "%"; he.style.left = X(e) + "%";
    hs.hidden = s < v.lo || s > v.hi; he.hidden = e < v.lo || e > v.hi;
    hs.classList.toggle("on", edge === "start"); he.classList.toggle("on", edge === "end");
    box.querySelector(".sbb-play").style.left = X(state.time) + "%";
    const f = normFrame(b.frame);
    box.querySelector(".sbb-keys").innerHTML = (f ? f.keys : []).map((k) => `<i class="sbb-key${k.back ? " back" : ""}" style="left:${X(s + k.t)}%"></i>`).join("");
    box.querySelector(".sbb-win").textContent = `Showing ${SBX.tc(v.lo, fps)} to ${SBX.tc(v.hi, fps)} (${span >= 120 ? Math.round(span / 60) + " min" : span >= 2 ? span.toFixed(1) + " s" : Math.round(span * fps) + " frames"})`;
    // pictures: the Editor's own frames of whatever is under each spot (a few per view, cached by the server)
    const W = box.querySelector(".sbb-body").clientWidth || 300, n = Math.max(4, Math.min(16, Math.round(W / 90)));
    const key = `${v.lo.toFixed(2)}|${v.hi.toFixed(2)}|${n}`;
    if (key !== barPicsKey) {
      barPicsKey = key;
      box.querySelector(".sbb-thumbs").innerHTML = Array.from({ length: n }, (_, k) => {
        const tt = v.lo + span * (k + 0.5) / n, src = SBX.sourceAt(project, tt);
        return src ? `<img src="/api/frame?src=${encodeURIComponent(src.src)}&t=${src.at.toFixed(3)}&w=160&q=6" alt="" draggable="false">` : `<i class="sbb-none"></i>`;
      }).join("");
    }
    // the sound of whatever is under each column
    const c = box.querySelector(".sbb-wave"); c.width = W;
    const g = c.getContext("2d"), H = c.height;
    g.clearRect(0, 0, W, H); g.fillStyle = "#B6F23A";
    const per = typeof WAVE_PEAKS_PER_SEC === "number" ? WAVE_PEAKS_PER_SEC : 50;
    for (let x = 0; x < W; x++) {
      const ta = v.lo + span * x / W, tb = v.lo + span * (x + 1) / W, src = SBX.sourceAt(project, ta);
      const pk = src && typeof wavePeaksFor === "function" ? wavePeaksFor(src.clip) : null;
      if (!pk) continue;
      const a0 = src.at, a1 = src.at + (tb - ta) * src.speed;
      let val = 0; for (let k = Math.floor(a0 * per); k <= Math.floor(a1 * per) && k < pk.length; k++) if (k >= 0 && pk[k] > val) val = pk[k];
      const bh = Math.max(1, Math.min(1, val) * (H - 2)); g.fillRect(x, (H - bh) / 2, 1, bh);
    }
    if (W / (span * fps) >= 5) { g.fillStyle = "rgba(255,255,255,.35)"; for (let fr = Math.ceil(v.lo * fps); fr / fps <= v.hi; fr++) g.fillRect(((fr / fps - v.lo) / span) * W, 0, 1, 6); }
    nowLine();
  }
  function wireBar(box) {
    if (!box) return;
    const body = box.querySelector(".sbb-body");
    const T = (cx) => { const [b] = current(), v = viewOf(b), r = body.getBoundingClientRect(); return v.lo + Math.max(0, Math.min(1, (cx - r.left) / r.width)) * (v.hi - v.lo); };
    body.onwheel = (e) => {
      const [b] = current(); if (!b) return;
      e.preventDefault();
      const v = viewOf(b);
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const d = (e.deltaX || e.deltaY) / (body.clientWidth || 300) * (v.hi - v.lo); setBarView(b, v.lo + d, v.hi + d); }
      else zoomBar(b, e.deltaY < 0 ? 0.6 : 1 / 0.6, T(e.clientX));
    };
    const dragEdge = (w) => (e) => {
      const [b] = current(); if (!b) return;
      e.preventDefault(); e.stopPropagation(); stopShortPlay();
      edge = w; markEdgeRows();
      if (typeof pushUndo === "function") pushUndo();
      const move = (ev) => update((x) => { Object.assign(x, SBX.moveEdge(x, w, T(ev.clientX), typeof projDur === "function" ? projDur() : 0, fpsNow())); showEdge(x); paintShortBoxes(true); });
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); sendList(); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };
    box.querySelector(".sbb-h.s").onpointerdown = dragEdge("start");
    box.querySelector(".sbb-h.e").onpointerdown = dragEdge("end");
    body.onpointerdown = (e) => {
      const [b] = current(); if (!b || e.target.classList.contains("sbb-h")) return;
      const x0 = e.clientX, v0 = { ...viewOf(b) }; let panned = false;
      const move = (ev) => { const dx = ev.clientX - x0; if (Math.abs(dx) > 4) panned = true; if (panned) { const d = -dx / (body.clientWidth || 300) * (v0.hi - v0.lo); setBarView(b, v0.lo + d, v0.hi + d); } };
      const up = (ev) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (!panned && typeof setTime === "function") { setTime(T(ev.clientX)); paintBar(); } };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };
  }
  window.addEventListener("resize", () => { barPicsKey = ""; if (selId) paintBar(); });

  /* -- 27 Nov: what is playing, Pause / Resume / Stop --------------------------------------------------------------- */
  function playLabel(on) {
    if (!on || playEnd == null) return "▶ Play";
    return state.playing ? "❚❚ Pause" : "▶ Resume";
  }
  function nowLine() {
    const el = document.querySelector("#shortsPage .sbt.on .sbb-now"), st = document.querySelector("#shortStage .ss-sub");
    const [b] = current();
    let txt = "";
    if (b && playEnd != null) {
      const fps = fpsNow(), t = state.time;
      const where = t < b.start - 0.01 ? "the 1 s before the start (CUT OUT)" : t > b.start + b.dur + 0.01 ? "the 1 s after the end (CUT OUT)" : "the cut";
      txt = `${state.playing ? "Playing" : "Paused"}: ${where} - ${SBX.tc(Math.max(0, t - b.start), fps)} of ${SBX.tc(b.dur, fps)}${playLoop ? " (loops)" : ""}`;
    }
    if (el) el.textContent = txt;
    if (st) st.textContent = txt || "Changes here only change this Short. Main goes back to your video.";
  }

  /* -- 27 Nov (Steve): the frame - Still, Action shot, Follow this person, keyframes ------------------------------------ */
  function frameHtml(b) {
    const f = normFrame(b.frame) || { mode: "still", path: [], keys: [] }, fps = fpsNow();
    const btn = (m, label, tip) => `<button type="button" class="btn tiny ${f.mode === m ? "accent" : ""}" data-sbt="fmode" data-v="${m}" title="${tip}">${label}</button>`;
    const note = frameBusy || (followPick ? "Click the person (or car, animal) in the main picture" :
      f.mode === "action" ? `Action shot (${{ fight: "both fighters kept in", football: "follows the ball", other: "follows the main moving subject" }[f.kind] || "follows the action"})` :
      f.mode === "follow" ? "Following who you clicked" : "Still: drag the picture to place it");
    return `<div class="sbt-frame wide"><div class="sbf-row"><b>Frame</b>${btn("still", "Still", "One position: drag the picture (or the slider)")}` +
      btn("action", "Action shot", "Follows the action automatically (fights: both fighters; football: the ball; else the main moving subject) - worked out on this PC, no AI cost") +
      btn("follow", "Follow this person", "Click a person (or a car, an animal) in the main picture: the frame locks onto them and follows them") + `</div>` +
      `<div class="dim sbf-note">${escapeHtmlSb(note)}</div>` +
      (f.mode === "still" ? `<label class="wide">Position <span class="dim">(left … right)</span><input type="range" data-f="cropX" min="0" max="1" step="0.01" value="${b.cropX}"></label>` : "") +
      `<div class="sbf-row"><button type="button" class="btn tiny" data-sbt="fkey" title="A keyframe here (the playhead): the frame where it is now - drag the picture to move it">+ Keyframe here</button>` +
      (f.mode !== "still" ? `<button type="button" class="btn tiny" data-sbt="fback" title="From here the frame glides back to the Action shot / Follow path">Back to auto here</button>` : "") +
      (f.keys.length ? `<button type="button" class="btn tiny" data-sbt="fclear">Clear keyframes</button>` : "") + `</div>` +
      (f.keys.length ? `<div class="sbf-keys">${f.keys.map((k, i) => `<span class="sbf-key">${SBX.tc(k.t, fps)} · ${k.back ? "back to auto" : Math.round(k.x * 100) + "%"} <button type="button" class="btn tiny ghost" data-sbt="fdel" data-v="${i}" title="Remove this keyframe">✕</button></span>`).join("")}</div>` : "") +
      `</div>`;
  }
  /** The window's position (0..1) now, for the preview: the frame rule at the Short's own time. */
  function cropNow(b) {
    return SBX.frameAt(b, Math.max(0, Math.min(b.dur, state.time - b.start)));
  }
  async function setFrameMode(id, mode) {
    const b = boxesNow().find((x) => x.id === id);
    if (!b) return;
    followPick = false;
    if (mode === "still") {
      update((x) => { x.frame = { ...(normFrame(x.frame) || { path: [], keys: [] }), mode: "still" }; });
      renderShortsPage(); sendList(); return;
    }
    if (mode === "follow") {
      followPick = true; showMain = true; drawStage(); renderShortsPage();
      toast("Click the person (or car, animal) to follow in the small main picture");
      return;
    }
    await askFrame(b, "action", null);
  }
  async function askFrame(b, mode, click) {
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) return toast("The Action shot and Follow are worked out by Create Summat: open the Editor from there");
    const f = SBX.footage(project, b);
    if (!f.pieces.length) return toast("There is no video under this Short to look at");
    frameBusy = mode === "follow" ? "Following them through the Short…" : "Working out the Action shot…";
    renderShortsPage();
    const r = await askHost("short-frame", { project: project.name || "", fps: fpsNow(), box: { id: b.id, start: b.start, dur: b.dur },
      pieces: f.pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })), mode, click }, 600000);
    frameBusy = "";
    if (!r || r.error || !Array.isArray(r.path)) { toast((r && r.error) || "The frame couldn't be worked out"); renderShortsPage(); return; }
    update((x) => { const old = normFrame(x.frame); x.frame = normFrame({ mode, path: r.path, keys: old ? old.keys : [], kind: r.kind || "" }); });
    if (typeof pushUndo === "function") pushUndo();
    renderShortsPage(); sendList();
    toast(mode === "follow" ? "Following them: press Play to see it. Drag the picture to correct a moment (it adds a keyframe)." : "Action shot ready: press Play to see it.");
  }
  function addKey(id, back) {
    const b = boxesNow().find((x) => x.id === id);
    if (!b) return;
    const tt = +Math.max(0, Math.min(b.dur, state.time - b.start)).toFixed(3);
    update((x) => {
      const f = normFrame(x.frame) || { mode: "still", path: [], keys: [] };
      const near = f.keys.findIndex((k) => Math.abs(k.t - tt) < 0.2);
      const key = { t: tt, x: back ? 0.5 : SBX.frameAt(x, tt), back: !!back };
      if (near >= 0) f.keys[near] = key; else f.keys.push(key);
      x.frame = normFrame(f);
    });
    renderShortsPage(); sendList();
  }
  /** Dragging the picture with a path or keyframes: a keyframe at the playhead (moved if one is close). */
  function dragKey(b, crop) {
    const tt = +Math.max(0, Math.min(b.dur, state.time - b.start)).toFixed(3);
    const f = normFrame(b.frame) || { mode: "still", path: [], keys: [] };
    const near = f.keys.findIndex((k) => Math.abs(k.t - tt) < 0.2);
    const key = { t: tt, x: Math.min(1, Math.max(0, crop)), back: false };
    if (near >= 0) f.keys[near] = key; else f.keys.push(key);
    b.frame = normFrame(f);
  }

  function playAround(id, w) {
    const b = boxesNow().find((x) => x.id === id);
    if (!b) return;
    if (selId !== id) selectShort(id);
    edge = w; markEdgeRows(); paintBar();
    const t = w === "start" ? b.start : b.start + b.dur;
    startRange(Math.max(0, t - 1), t + 1, false);
  }
  function startRange(from, to, loop) {
    if (state.playing && typeof pause === "function") pause();
    if (typeof setTime === "function") setTime(from); else state.time = from;
    playFrom = from; playEnd = to; playLoop = loop;
    const [b] = current();
    playRate0 = state.previewRate;
    state.previewRate = (b && b.speed) || 1;
    if (typeof play === "function") play();
    drawStageButtons();
    renderShortsPage();
  }

  /* -- delete: always the same question; never the edit ----------------------------------------------------------- */
  function askDelete(id) {
    const all = boxesNow(), i = all.findIndex((x) => x.id === id);
    if (i < 0) return false;
    if (!confirm(SBX.deleteText(i + 1, all[i].name) + "?")) return true;
    if (typeof pushUndo === "function") pushUndo();
    project.shortBoxes = all.filter((x) => x.id !== id);
    scheduleSave();
    if (selId === id) leaveShortMode();
    paintShortBoxes();
    renderShortsPage();
    toast(`Short ${i + 1} deleted (the marker only, your video and edit stay)`);
    return true;
  }
  window.askDeleteShort = askDelete;
  window.shortDeleteSelected = function shortDeleteSelected() {
    if (!selId) return false;
    askDelete(selId);
    return true;
  };

  /* -- Short mode: the monitor shows the Short, edits go to it only --------------------------------------------------- */
  function selectShort(id) {
    if (!boxesNow().some((b) => b.id === id)) return;
    if (selId !== id) { stopShortPlay(); selId = id; edge = null; barView = null; barPicsKey = ""; followPick = false; }
    if (typeof setSelection === "function" && state.selIds && state.selIds.size) setSelection([]);   // Delete never hits a clip now
    document.body.classList.add("short-mode");
    syncModeSwitch();
    drawStage();
    paintShortBoxes();
    renderShortsPage();
    if (!raf) raf = requestAnimationFrame(frameLoop);
  }
  window.selectShort = selectShort;
  window.shortSelectedId = () => selId;

  function leaveShortMode() {
    if (!selId) return;
    stopShortPlay();
    selId = null; edge = null; barView = null; barPicsKey = ""; followPick = false;
    document.body.classList.remove("short-mode");
    document.getElementById("shortStage")?.remove();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    syncModeSwitch();
    paintShortBoxes();
    renderShortsPage();
  }
  window.leaveShortMode = leaveShortMode;

  /** The Main / Short switch beside "Preview speed". */
  function syncModeSwitch() {
    const sw = document.getElementById("sbModeSwitch");
    if (!sw) return;
    sw.querySelectorAll("[data-sbmode]").forEach((b) => {
      const on = (b.dataset.sbmode === "short") === !!selId;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  window.setShortMode = function setShortMode(mode) {
    if (mode === "main") return leaveShortMode();
    if (selId) return;
    const all = boxesNow();
    if (!all.length) return toast("Add a Short first: put the playhead at the end of a moment and press + Short");
    const under = all.find((b) => state.time >= b.start && state.time <= b.start + b.dur);
    selectShort((under || all[0]).id);
  };

  function current() {
    const all = boxesNow(), i = all.findIndex((b) => b.id === selId);
    return i < 0 ? [null, -1] : [all[i], i];
  }
  function update(fn) {
    const all = boxesNow(), b = all.find((x) => x.id === selId);
    if (!b) return;
    fn(b);
    project.shortBoxes = all;
    scheduleSave();
  }

  /** Play (28 Nov, Steve): plays just this Short once, from its start to its end, then stops (Loop: round again, at
   *  its own speed); In/out preview adds 1 s before the
   *  start and 1 s after the end, shown as CUT OUT. */
  function playShort() {
    const [b] = current();
    if (!b) return;
    if (playEnd != null) {                       // 27 Nov (Steve): Pause / Resume - the loop is kept until Stop
      if (state.playing) pause(); else play();
      drawStageButtons(); renderShortsPage(); return;
    }
    const end = typeof projDur === "function" ? projDur() : 0;
    startRange(ioPreview ? Math.max(0, b.start - 1) : b.start, ioPreview ? (end > 0 ? Math.min(end, b.start + b.dur + 1) : b.start + b.dur + 1) : b.start + b.dur, shortLoop);
  }
  window.playShort = playShort;
  function stopShortPlay(toStart) {
    const from = playFrom;
    if (playEnd != null && state.playing && typeof pause === "function") pause();
    if (playRate0 != null) { state.previewRate = playRate0; playRate0 = null; }
    playEnd = null; playFrom = null; playLoop = false;
    if (toStart && from != null && typeof setTime === "function") setTime(from);
    drawStageButtons(); nowLine();
  }

  /** The Short stage: over the monitor's own area (never resizing anything), the 9:16 Short fitted to its height,
   *  "Editing: Short 1" in big words, the main picture small in a corner (switchable). */
  function drawStage() {
    const [b, i] = current();
    if (!b) return leaveShortMode();
    const host = document.getElementById("monitorStage");
    if (!host) return;
    let st = document.getElementById("shortStage");
    if (!st) {
      st = document.createElement("div");
      st.id = "shortStage";
      st.innerHTML = `<div class="ss-banner"><b class="ss-editing"></b><span class="ss-sub">Changes here only change this Short. Main goes back to your video.</span></div>` +
        `<div class="ss-main" title="Your video: drag the green box to choose what the Short shows"><canvas id="ssMain" width="320" height="180"></canvas></div>` +
        `<canvas id="shortPreview" width="540" height="960" title="This Short as it will look (9:16). Drag it to move the viewing box."></canvas>` +
        `<div class="ss-tools"><button type="button" class="btn tiny accent" id="ssPlay" title="Plays just this Short, start to end / Pause / Resume (space bar)">▶ Play</button>` +
        `<button type="button" class="btn tiny" id="ssStop" title="Stop: back to the start" hidden>■ Stop</button>` +
        `<button type="button" class="btn tiny" id="ssMainToggle"></button><button type="button" class="btn tiny" id="ssDone">Main</button></div>`;
      host.appendChild(st);
      st.querySelector("#ssPlay").onclick = playShort;
      st.querySelector("#ssStop").onclick = () => { stopShortPlay(true); renderShortsPage(); };
      st.querySelector("#ssDone").onclick = leaveShortMode;
      st.querySelector("#ssMainToggle").onclick = () => { showMain = !showMain; try { localStorage.setItem("fc.shortShowMain", showMain ? "1" : "0"); } catch { /* */ } drawStage(); };
      wireDrag(st.querySelector("#ssMain"), "main");
      wireDrag(st.querySelector("#shortPreview"), "short");
    }
    st.querySelector(".ss-editing").textContent = `Editing: ${labelOf(b, i)}`;
    st.querySelector(".ss-main").classList.toggle("hidden", !showMain);
    st.querySelector("#ssMainToggle").textContent = showMain ? "Hide main picture" : "Show main picture";
    fitStage();
    drawStageButtons();
  }
  function drawStageButtons() {
    const btn = document.getElementById("ssPlay");
    if (btn) btn.textContent = playLabel(true);
    const stop = document.getElementById("ssStop");
    if (stop) stop.hidden = playEnd == null;
  }
  /** Sizes from the monitor area itself: the 9:16 preview as tall as fits, the main picture 30 % of the width. */
  function fitStage() {
    const st = document.getElementById("shortStage"), host = document.getElementById("monitorStage");
    if (!st || !host) return;
    const H = host.clientHeight, W = host.clientWidth;
    const ph = Math.max(120, H - 16), pw = Math.round(ph * 9 / 16);
    const sp = st.querySelector("#shortPreview");
    sp.style.height = ph + "px"; sp.style.width = pw + "px";
    const src = els.preview, mw = Math.min(Math.round(W * 0.3), Math.max(120, (W - pw) / 2 - 24));
    const mc = st.querySelector("#ssMain");
    const ar = src && src.width ? src.height / src.width : 9 / 16;
    mc.style.width = mw + "px"; mc.style.height = Math.round(mw * ar) + "px";
  }
  window.addEventListener("resize", () => { if (selId) fitStage(); });

  /** Drag the viewing box WITH the mouse: on the main picture (the box is drawn there), or on the Short preview. */
  function wireDrag(cv, where) {
    cv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
      const [b0] = current(), src = els.preview;
      if (!b0 || !src || !src.width) return;
      if (followPick && where === "main") {                // Follow this person: this click picks them
        const r = cv.getBoundingClientRect();
        followPick = false;
        askFrame(b0, "follow", { t: +Math.max(0, Math.min(b0.dur, state.time - b0.start)).toFixed(3),
          x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
        return;
      }
      const f0 = normFrame(b0.frame), keyed = !!(f0 && (f0.mode !== "still" || f0.keys.length));
      const x0 = e.clientX, c0 = keyed ? cropNow(b0) : b0.cropX;
      const w = SBX.window916(src.width, src.height, c0);
      // screen px per picture px: the main picture shows the whole width; the Short preview shows the box's width
      const pxPer = where === "main" ? cv.clientWidth / src.width : cv.clientWidth / w.w;
      cv.onpointermove = (m) => update((b) => { const c = SBX.dragCrop(c0, m.clientX - x0, pxPer, src.width, src.height); if (keyed) dragKey(b, c); else b.cropX = c; });
      cv.onpointerup = () => { cv.onpointermove = null; sendList(); renderShortsPage(); };
    });
  }

  /** Every frame in Short mode: the 9:16 preview (its look and text), the main picture with the box, its Play range. */
  function frameLoop() {
    raf = 0;
    const [b] = current();
    if (!b) return;
    if (playEnd != null) {
      if (!state.playing) { /* paused: the loop waits for Resume (or Stop) */ }
      else if (state.time >= playEnd - 0.01) {
        if (playLoop && playFrom != null) { const f = playFrom; pause(); setTime(f); play(); }   // Play the cut: again
        else { stopShortPlay(); renderShortsPage(); }
      }
    }
    const src = els.preview, cv = document.getElementById("shortPreview"), mc = document.getElementById("ssMain");
    if (playEnd != null || state.playing) {               // the bar's playhead and the line saying what plays
      const bar = document.querySelector("#shortsPage .sbt.on .sbb-play"), v = viewOf(b);
      if (bar) bar.style.left = ((state.time - v.lo) / (v.hi - v.lo) * 100) + "%";
      nowLine(); drawStageButtons();
    }
    if (src && src.width && src.height) {
      const w = SBX.window916(src.width, src.height, cropNow(b));      // 27 Nov: the frame rule (path + keyframes)
      if (cv) {
        const g = cv.getContext("2d");
        g.filter = (SBX.LOOKS[b.look] || SBX.LOOKS.none)[1];
        try { g.drawImage(src, w.x, 0, w.w, src.height, 0, 0, cv.width, cv.height); } catch { /* a tainted frame: kept */ }
        g.filter = "none";
        if (b.text) {                                    // its on-screen text, high up in the safe area
          const t = b.text.toUpperCase();
          let fs = 72;
          g.font = `900 ${fs}px Anton, Impact, sans-serif`;
          while (fs > 24 && g.measureText(t).width > cv.width - 80) { fs -= 4; g.font = `900 ${fs}px Anton, Impact, sans-serif`; }
          g.textAlign = "center"; g.lineJoin = "round"; g.lineWidth = Math.max(4, fs / 9); g.strokeStyle = "#0b0b10"; g.fillStyle = "#ffffff";
          g.strokeText(t, cv.width / 2, cv.height * 0.2); g.fillText(t, cv.width / 2, cv.height * 0.2);
        }
        if (playEnd != null && state.playing && (state.time < b.start - 0.01 || state.time > b.start + b.dur + 0.01)) {   // in/out preview
          g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, 0, cv.width, cv.height);
          g.font = "900 64px Anton, Impact, sans-serif"; g.textAlign = "center"; g.fillStyle = "#E5484D";
          g.fillText("CUT OUT", cv.width / 2, cv.height / 2);
        }
      }
      if (mc && showMain) {
        const g = mc.getContext("2d");
        if (mc.width !== 320) mc.width = 320;
        const mh = Math.round(320 * src.height / src.width);
        if (mc.height !== mh) mc.height = mh;
        try { g.drawImage(src, 0, 0, mc.width, mc.height); } catch { /* */ }
        const k = mc.width / src.width;
        g.fillStyle = "rgba(0,0,0,.5)";
        g.fillRect(0, 0, w.x * k, mc.height); g.fillRect((w.x + w.w) * k, 0, mc.width - (w.x + w.w) * k, mc.height);
        g.strokeStyle = "#B6F23A"; g.lineWidth = 3; g.strokeRect(w.x * k + 1.5, 1.5, w.w * k - 3, mc.height - 3);
      }
    }
    raf = requestAnimationFrame(frameLoop);
  }

  // Esc / Delete in Short mode (before the editor's own keys); main-timeline edits are stopped while in Short mode
  const MAIN_EDIT_KEYS = new Set(["s", "S", ",", ".", "g", "G", "t", "T", ";", "'", "x", "X", "v", "V"]);
  function blockedMsg() { const [, i] = current(); toast(`You're editing Short ${i + 1}: switch to Main to change your video`); }
  window.addEventListener("keydown", (e) => {
    if (!selId) return;
    const typing = typeof isTypingTarget === "function" && isTypingTarget(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (edge) { edge = null; markEdgeRows(); paintBar(); } else leaveShortMode(); }
    else if (!typing && edge && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); e.stopImmediatePropagation();               // 27 Nov: the grabbed edge, a frame (Shift: 1 s)
      stepEdge(selId, edge, (e.key === "ArrowLeft" ? "-" : "") + (e.shiftKey ? "1" : "f"));
    }
    else if (!typing && e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); e.stopImmediatePropagation(); playShort();  // 27 Nov (Steve): space = Play the cut / Pause / Resume
    }
    else if (!typing && (e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); e.stopImmediatePropagation(); askDelete(selId);
    } else if (!typing && !e.altKey && ((!e.ctrlKey && !e.metaKey && MAIN_EDIT_KEYS.has(e.key) && !/^[xXvV]$/.test(e.key))
        || ((e.ctrlKey || e.metaKey) && /^[xXvVdD]$/.test(e.key)))) {
      e.preventDefault(); e.stopImmediatePropagation(); blockedMsg();
    }
  }, true);
  // a click on a main-timeline clip in Short mode: stopped (the main edit is not this Short's)
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    const menu = document.getElementById("sbMenu");
    if (menu && t instanceof Node && !menu.contains(t)) menu.remove();
    if (!selId || !(t instanceof Element)) return;
    if (t.closest(".clip") && !t.closest(".short-box") && t.closest("#timelinePanel")) { e.preventDefault(); e.stopPropagation(); blockedMsg(); }
  }, true);

  function showMenu(x, y, id) {
    document.getElementById("sbMenu")?.remove();
    const all = boxesNow(), i = all.findIndex((b) => b.id === id);
    if (i < 0) return;
    const m = document.createElement("div");
    m.id = "sbMenu"; m.className = "ctx-menu";
    const item = (label, run) => { const b = document.createElement("button"); b.type = "button"; b.className = "ctx-item";
      b.innerHTML = `<span>${escapeHtmlSb(label)}</span>`; b.onclick = () => { m.remove(); run(); }; m.appendChild(b); };
    item("Edit this Short (Short mode)", () => selectShort(id));
    item("Open in the Shorts tab", () => { selectShort(id); if (typeof setSideTab === "function") setSideTab("shorts"); });
    item(SBX.deleteText(i + 1, all[i].name), () => askDelete(id));
    document.body.appendChild(m);
    m.style.position = "fixed";
    m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + "px";
    m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + "px";
  }

  /* -- Create Summat: the ticked (accepted) Shorts (Library > Shorts), made / removed there ------------------------ */
  const extras = (b) => ({ text: b.text || "", speed: b.speed || 1, look: b.look || "none" });
  /** 27 Nov: what the export needs to frame it exactly as the preview: the path and the keyframes (null: a still). */
  const frameOut = (b) => { const f = normFrame(b.frame); return f && ((f.mode !== "still" && f.path.length) || f.keys.length) ? { path: f.mode !== "still" ? f.path : [], keys: f.keys } : null; };
  let sentSig = null;
  function sendList(force) {
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) return;
    const fps = typeof projectFps === "function" ? projectFps() : project.fps || 30;
    const shorts = boxesNow().map((b, i) => [b, i]).filter(([b]) => b.accepted).map(([b, i]) => ({ id: b.id, name: labelOf(b, i), start: b.start, dur: b.dur, cropX: b.cropX, frame: frameOut(b),
      ...extras(b), pieces: SBX.footage(project, b).pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })) }));
    const sig = JSON.stringify([project.name || "", shorts]);
    if (!force && sig === sentSig) return;
    sentSig = sig;
    hostWindow().postMessage({ source: "fablecut", type: "shorts-list", project: project.name || "", fps, shorts }, "*");
  }
  window.sendShortsList = sendList;

  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.source !== "createsummat" || !d.box || !/^short-/.test(d.type || "")) return;
    const boxes = boxesNow();
    const b = boxes.find((x) => x.id === d.box);
    if (d.type === "short-done") {
      making.delete(d.box);
      if (b) { project.shortBoxes = boxes.filter((x) => x.id !== d.box); scheduleSave(); if (selId === d.box) leaveShortMode(); }
      toast(`"${(b && b.name) || "Short"}" is made: it is in Library > Shorts`);
    } else if (d.type === "short-failed") {
      making.delete(d.box);
      toast(`"${(b && b.name) || "Short"}" was not made: ${d.error || "see the jobs list"}`);
    } else if (d.type === "short-removed") {       // deleted in Library > Shorts: the marker goes here too
      if (b) { project.shortBoxes = boxes.filter((x) => x.id !== d.box); scheduleSave(); if (selId === d.box) leaveShortMode(); }
    }
    if (typeof paintShortBoxes === "function") paintShortBoxes();
    renderShortsPage();
  });

  /* -- the bands on the timeline: big enough to grab; their buttons are in the Shorts tab --------------------------- */
  window.paintShortBoxes = function paintShortBoxes(keepPage) {
    const host = els.tracksContent;
    host.querySelectorAll(".short-box").forEach((x) => x.remove());
    const boxes = boxesNow();
    if (selId && !boxes.some((b) => b.id === selId)) { selId = null; leaveShortMode(); }
    boxes.forEach((b, i) => {
      const el = document.createElement("div");
      const busy = making.has(b.id);
      el.className = "short-box" + (busy ? " making" : "") + (b.id === selId ? " sel" : "") + (b.accepted ? " accepted" : "");
      el.dataset.sb = b.id;
      el.style.left = b.start * state.pps + "px";
      el.style.width = Math.max(12, b.dur * state.pps) + "px";
      const label = labelOf(b, i);
      el.innerHTML = `<div class="sb-bar" title="Click: edit this Short (Short mode). Drag: move it. Its buttons are in the Shorts tab."><span class="sb-name">${escapeHtmlSb(label)} · ${SBX.length(b.dur)}${b.accepted ? " ✓" : ""}${busy ? " · making…" : ""}</span>` +
        `<button type="button" class="btn tiny sb-del" title="${escapeHtmlSb(SBX.deleteText(i + 1, b.name))}">🗑</button></div>` +
        `<div class="sb-h l" title="Drag to change where it starts"></div><div class="sb-h r" title="Drag to change where it ends"></div>`;
      host.appendChild(el);
      el.querySelector(".sb-del").onclick = (e) => { e.stopPropagation(); askDelete(b.id); };
      el.querySelector(".sb-bar").addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showMenu(e.clientX, e.clientY, b.id); });
      el.querySelectorAll(".sb-h").forEach((h) => h.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showMenu(e.clientX, e.clientY, b.id); }));
      const drag = (mode) => (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        e.preventDefault(); e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        const x0 = e.clientX, s0 = b.start, d0 = b.dur, end = typeof projDur === "function" ? projDur() : 0;
        let moved = false;
        if (mode !== "move" && b.id === selId) { edge = mode === "l" ? "start" : "end"; markEdgeRows(); paintBar(); }
        el.onpointermove = (m) => {
          if (!moved && Math.abs(m.clientX - x0) < 3) return;         // a click, not a drag (yet)
          const dt = (m.clientX - x0) / state.pps;
          const fps = fpsNow();
          let nb = mode === "move" ? SBX.clamp({ ...b, start: SBX.snapTo(s0 + dt, fps) }, end)
            : SBX.moveEdge({ ...b, start: s0, dur: d0 }, mode === "l" ? "start" : "end", mode === "l" ? s0 + dt : s0 + d0 + dt, end, fps);   // 27 Nov: on frames
          if (!moved && typeof pushUndo === "function") pushUndo();
          moved = true;
          Object.assign(b, nb);
          el.style.left = b.start * state.pps + "px"; el.style.width = Math.max(12, b.dur * state.pps) + "px";
          el.querySelector(".sb-name").textContent = `${label} · ${SBX.length(b.dur)}${b.accepted ? " ✓" : ""}`;
          if (mode !== "move" && b.id === selId) showEdge(b);
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          if (moved) { project.shortBoxes = boxes; scheduleSave(); sendList(); }
          selectShort(b.id);                                           // a click (or the end of a drag): Short mode
          if (mode !== "move") { edge = mode === "l" ? "start" : "end"; showEdge(b); }   // 27 Nov: the grabbed edge
          renderShortsPage();
        };
      };
      el.addEventListener("pointerdown", (e) => drag(e.target.classList.contains("sb-h") ? (e.target.classList.contains("l") ? "l" : "r") : "move")(e));
    });
    syncExportShortsButton();
    syncModeSwitch();
    sendList();
    if (!keepPage) renderShortsPage();
  };

  async function downloadShort(b, label) {
    const r = typeof askHost === "function" ? await askHost("choose-folder", { start: getSetting("downloadFolder") || "" }) : null;
    if (!r || !r.path) return toast("No folder chosen, so nothing was made");
    setSetting("downloadFolder", r.path);
    createShortFromBox(b, label, { download: true, folder: r.path });
  }

  window.createShortFromBox = function createShortFromBox(b, label, opt = {}) {
    if (making.has(b.id)) return false;
    const f = SBX.footage(project, b);
    if (!f.pieces.length) { toast(`"${b.name || label}": there is no video under this Short, move it over your footage`); return false; }
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) { toast("Shorts are made inside Create Summat"); return false; }
    const notes = [];
    if (f.extra) notes.push(`${f.extra} title${f.extra > 1 ? "s / effects" : " / effect"} under it ${f.extra > 1 ? "are" : "is"} not in the Short (only the footage, plus the Short's own text and look)`);
    if (f.slowed) notes.push("a sped-up or slowed clip plays at the Short's own speed");
    hostWindow().postMessage({ source: "fablecut", type: "make-short", project: project.name || "", name: b.name || label,
      box: { id: b.id, start: b.start, dur: b.dur }, crop_x: SBX.cropOf(b), frame: frameOut(b), ...extras(b), pieces: f.pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })),
      fps: typeof projectFps === "function" ? projectFps() : project.fps || 30, notes, quiet: !!opt.quiet,
      download: !!opt.download, copy_to: opt.folder || "" }, "*");
    making.set(b.id, "making");
    paintShortBoxes();
    if (!opt.quiet) toast(`Making "${b.name || label}" as a Short in the background${opt.download ? `, then saving it in ${opt.folder}` : ", then its Ready to post page"}${notes.length ? ". Note: " + notes.join("; ") : ""}. Keep editing.`);
    return true;
  };

  function escapeHtmlSb(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
}
