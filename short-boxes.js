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
        look: Object.prototype.hasOwnProperty.call(LOOKS, b.look) ? b.look : "none" }))
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
           deleteText, footage, cropOf, tc, parseTc, snapTo, moveEdge, sourceAt };
});

/* -- the editor side (only in a browser with the editor loaded) ------------------------------------------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const SBX = ShortBoxes;
  const boxesNow = () => SBX.normalize(project.shortBoxes);
  const labelOf = (b, i) => b.name || `Short ${i + 1}`;
  let selId = null;          // the Short in Short mode
  let playEnd = null;        // its Play: stop here
  let playRate0 = null;      // the preview speed before a Short's own speed played
  let raf = 0;
  let showMain = true;       // the small main picture in Short mode
  let edge = null;           // 27 Nov: "start" / "end" - the edge last grabbed (← → move it)
  let sspan = 6;             // the close-up: seconds across
  let ioPreview = false;     // Play the cut: 1 s before and after too
  let playFrom = null, playLoop = false;   // Play the cut loops; Play around plays once
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
            `<label class="wide">Frame <span class="dim">(left … right)</span><input type="range" data-f="cropX" min="0" max="1" step="0.01" value="${b.cropX}"></label>` +
            `<label class="wide">On-screen text <span class="dim">(this Short only)</span><input data-f="text" value="${escapeHtmlSb(b.text)}" maxlength="80" placeholder="e.g. BUSTED"></label>` +
            `<label>Speed<select data-f="speed">${SBX.SPEEDS.map((s) => `<option value="${s}" ${s === b.speed ? "selected" : ""}>${s}×</option>`).join("")}</select></label>` +
            `<label>Look<select data-f="look">${Object.entries(SBX.LOOKS).map(([k, [n]]) => `<option value="${k}" ${k === b.look ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>` : "") +
          `<div class="sbt-acts">` + (busy ? `<span class="sb-busy">Making…</span>` :
            `<button type="button" class="btn tiny" data-sbt="preview" title="Loops just this Short until you press Stop${on && ioPreview ? " (with 1 s before and after: In/out preview)" : ""}">${on && playEnd != null && state.playing && playLoop ? "■ Stop" : "▶ Play the cut"}</button>` +
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
      else if (act === "step") { const [w, d] = x.dataset.v.split(":"); stepEdge(b.id, w, d); }
      else if (act === "around") playAround(b.id, x.dataset.v);
      else if (act === "zin" || act === "zout") { sspan = act === "zin" ? Math.max(1, sspan / 2) : Math.min(96, sspan * 2); renderShortsPage(); }
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
    page.querySelectorAll("[data-edge]").forEach((r) => r.addEventListener("pointerdown", () => { if (edge !== r.dataset.edge) { edge = r.dataset.edge; paintClose(); markEdgeRows(); } }));
    wireClose(page.querySelector(".sbt-close"));
    paintClose();
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
      `<span class="sbt-steps">${STEPS.map(([d, l]) => `<button type="button" class="btn tiny" data-sbt="step" data-v="${w}:${d}" title="${d.includes("f") ? "One frame" + (d[0] === "-" ? " back" : " on") + " (← →)" : l + (Math.abs(+d) === 1 ? " (Shift + ← →)" : "")}">${l}</button>`).join("")}` +
      `<button type="button" class="btn tiny" data-sbt="around" data-v="${w}" title="Plays 1 second before to 1 second after the ${name.toLowerCase()}: what is not in the Short shows as CUT OUT">Play around</button></span></div>`;
    return `<div class="sbt-precise wide">${row("start", "Start", b.start)}${row("end", "End", b.start + b.dur)}` +
      `<div class="sbt-lenrow">Length <b class="sbt-tclen">${SBX.tc(b.dur, fps)}</b><label class="sbt-io" title="Play the cut also plays 1 s before the start and 1 s after the end, shown as CUT OUT"><input type="checkbox" data-io ${ioPreview ? "checked" : ""}> In/out preview</label></div>` +
      `<div class="sbt-close" title="Close-up of the edge you last grabbed: click or drag to put it on the exact frame">` +
      `<div class="sbc-head"><b class="sbc-name"></b><span class="dim sbc-info"></span><button type="button" class="btn tiny" data-sbt="zin" title="Closer (fewer seconds across)">+</button><button type="button" class="btn tiny" data-sbt="zout" title="Wider (more seconds across)">−</button></div>` +
      `<div class="sbc-body"><img class="sbc-pics" alt="" draggable="false"><canvas class="sbc-wave" height="40"></canvas><i class="sbc-dim"></i><i class="sbc-mark"></i></div></div></div>`;
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
    paintClose();
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

  /** The close-up: pictures (the Editor's own frame sheet of the file under the edge) and that file's waveform,
   *  `sspan` seconds across, centred on the edge; dimmed on the side that is not in the Short. */
  let closeWin = null;
  function closeWindow(b) {
    const t = edge === "end" ? b.start + b.dur : b.start;
    const src = SBX.sourceAt(project, edge === "end" ? Math.max(0, t - 1e-3) : t);
    if (!src) return { t, src: null };
    const t0 = Math.max(src.from, t - sspan / 2), t1 = Math.min(src.to, t0 + sspan);
    return { t, src, t0, t1 };
  }
  function paintClose() {
    const [b] = current(), box = document.querySelector("#shortsPage .sbt.on .sbt-close");
    if (!box || !b) return;
    if (!edge) { box.classList.add("idle"); box.querySelector(".sbc-name").textContent = "Close-up"; box.querySelector(".sbc-info").textContent = "grab the start or the end (here or on the band) to see that spot frame by frame"; return; }
    box.classList.remove("idle");
    const fps = fpsNow(), w = closeWindow(b);
    box.querySelector(".sbc-name").textContent = edge === "start" ? "Start" : "End";
    if (!w.src) { box.querySelector(".sbc-info").textContent = `${SBX.tc(w.t, fps)} · no footage under this edge`; return; }
    // the window is only moved when the edge leaves its middle, so frame steps don't reload the pictures
    if (!closeWin || closeWin.src.src !== w.src.src || closeWin.span !== sspan || closeWin.edge !== edge || w.t < closeWin.t0 + sspan * 0.2 && closeWin.t0 > w.src.from || w.t > closeWin.t1 - sspan * 0.2 && closeWin.t1 < w.src.to) closeWin = { ...w, span: sspan, edge };
    const cw = closeWin, sp = cw.src.speed, a0 = cw.src.at + (cw.t0 - cw.t) * sp, a1 = cw.src.at + (cw.t1 - cw.t) * sp;
    const img = box.querySelector(".sbc-pics"), url = `/api/frame?src=${encodeURIComponent(cw.src.src)}&frames=8&cols=8&from=${a0.toFixed(3)}&to=${a1.toFixed(3)}&w=120&q=6`;
    if (img.dataset.url !== url) { img.dataset.url = url; img.src = url; }
    const S = (x) => Math.max(0, Math.min(100, ((x - cw.t0) / (cw.t1 - cw.t0)) * 100));
    box.querySelector(".sbc-mark").style.left = S(w.t) + "%";
    const dim = box.querySelector(".sbc-dim");
    if (edge === "start") { dim.style.left = "0"; dim.style.width = S(w.t) + "%"; } else { dim.style.left = S(w.t) + "%"; dim.style.width = (100 - S(w.t)) + "%"; }
    box.querySelector(".sbc-info").textContent = `${SBX.tc(w.t, fps)} · ${(cw.t1 - cw.t0).toFixed(1)} s across · ${Math.round(fps * 100) / 100} fps`;
    const c = box.querySelector(".sbc-wave"), W = c.clientWidth || 300; c.width = W;
    const g = c.getContext("2d"), H = c.height;
    g.clearRect(0, 0, W, H);
    const pk = typeof wavePeaksFor === "function" ? wavePeaksFor(cw.src.clip) : null, per = typeof WAVE_PEAKS_PER_SEC === "number" ? WAVE_PEAKS_PER_SEC : 50;
    if (pk && pk.length) {
      g.fillStyle = "#B6F23A";
      for (let x = 0; x < W; x++) {
        const ta = a0 + (x / W) * (a1 - a0), tb = a0 + ((x + 1) / W) * (a1 - a0);
        let v = 0; for (let k = Math.floor(ta * per); k <= Math.floor(tb * per) && k < pk.length; k++) if (k >= 0 && pk[k] > v) v = pk[k];
        const bh = Math.max(1, Math.min(1, v) * (H - 2)); g.fillRect(x, (H - bh) / 2, 1, bh);
      }
    } else { g.fillStyle = "rgba(255,255,255,.4)"; g.font = "11px sans-serif"; g.fillText("the waveform shows once the Editor has read this file's sound", 6, H / 2 + 4); }
    const pxf = W / ((cw.t1 - cw.t0) * fps);
    if (pxf >= 5) { g.fillStyle = "rgba(255,255,255,.35)"; for (let f = Math.ceil(cw.t0 * fps); f / fps <= cw.t1; f++) g.fillRect(((f / fps - cw.t0) / (cw.t1 - cw.t0)) * W, 0, 1, 5); }
  }
  function wireClose(box) {
    if (!box) return;
    const body = box.querySelector(".sbc-body");
    body.onpointerdown = (e) => {
      const [b] = current();
      if (!b || !edge || !closeWin) return;
      e.preventDefault(); e.stopPropagation();
      stopShortPlay();
      const r = body.getBoundingClientRect(), cw = closeWin;
      if (typeof pushUndo === "function") pushUndo();
      const at = (ev) => cw.t0 + Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * (cw.t1 - cw.t0);
      const move = (ev) => update((x) => { Object.assign(x, SBX.moveEdge(x, edge, at(ev), typeof projDur === "function" ? projDur() : 0, fpsNow())); showEdge(x); paintShortBoxes(true); });
      move(e);
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); sendList(); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };
  }
  function playAround(id, w) {
    const b = boxesNow().find((x) => x.id === id);
    if (!b) return;
    if (selId !== id) selectShort(id);
    edge = w; markEdgeRows(); paintClose();
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
    if (selId !== id) { stopShortPlay(); selId = id; edge = null; closeWin = null; }
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
    selId = null; edge = null; closeWin = null;
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

  /** Play the cut (27 Nov): loops just this Short until Stop (at its own speed); In/out preview adds 1 s before the
   *  start and 1 s after the end, shown as CUT OUT. */
  function playShort() {
    const [b] = current();
    if (!b) return;
    if (playEnd != null && state.playing) { stopShortPlay(); renderShortsPage(); return; }
    const end = typeof projDur === "function" ? projDur() : 0;
    startRange(ioPreview ? Math.max(0, b.start - 1) : b.start, ioPreview ? (end > 0 ? Math.min(end, b.start + b.dur + 1) : b.start + b.dur + 1) : b.start + b.dur, true);
  }
  window.playShort = playShort;
  function stopShortPlay() {
    if (playEnd != null && state.playing && typeof pause === "function") pause();
    if (playRate0 != null) { state.previewRate = playRate0; playRate0 = null; }
    playEnd = null; playFrom = null; playLoop = false;
    drawStageButtons();
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
        `<div class="ss-tools"><button type="button" class="btn tiny accent" id="ssPlay">▶ Play Short</button>` +
        `<button type="button" class="btn tiny" id="ssMainToggle"></button><button type="button" class="btn tiny" id="ssDone">Main</button></div>`;
      host.appendChild(st);
      st.querySelector("#ssPlay").onclick = playShort;
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
    if (btn) btn.textContent = playEnd != null && state.playing ? "■ Stop" : "▶ Play the cut";
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
      const x0 = e.clientX, c0 = b0.cropX;
      const w = SBX.window916(src.width, src.height, c0);
      // screen px per picture px: the main picture shows the whole width; the Short preview shows the box's width
      const pxPer = where === "main" ? cv.clientWidth / src.width : cv.clientWidth / w.w;
      cv.onpointermove = (m) => update((b) => { b.cropX = SBX.dragCrop(c0, m.clientX - x0, pxPer, src.width, src.height); });
      cv.onpointerup = () => { cv.onpointermove = null; sendList(); renderShortsPage(); };
    });
  }

  /** Every frame in Short mode: the 9:16 preview (its look and text), the main picture with the box, its Play range. */
  function frameLoop() {
    raf = 0;
    const [b] = current();
    if (!b) return;
    if (playEnd != null) {
      if (!state.playing) { stopShortPlay(); renderShortsPage(); }
      else if (state.time >= playEnd - 0.01) {
        if (playLoop && playFrom != null) { const f = playFrom; pause(); setTime(f); play(); }   // Play the cut: again
        else { stopShortPlay(); renderShortsPage(); }
      }
    }
    const src = els.preview, cv = document.getElementById("shortPreview"), mc = document.getElementById("ssMain");
    if (src && src.width && src.height) {
      const w = SBX.window916(src.width, src.height, b.cropX);
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
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (edge) { edge = null; markEdgeRows(); paintClose(); } else leaveShortMode(); }
    else if (!typing && edge && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); e.stopImmediatePropagation();               // 27 Nov: the grabbed edge, a frame (Shift: 1 s)
      stepEdge(selId, edge, (e.key === "ArrowLeft" ? "-" : "") + (e.shiftKey ? "1" : "f"));
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
  let sentSig = null;
  function sendList(force) {
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) return;
    const fps = typeof projectFps === "function" ? projectFps() : project.fps || 30;
    const shorts = boxesNow().map((b, i) => [b, i]).filter(([b]) => b.accepted).map(([b, i]) => ({ id: b.id, name: labelOf(b, i), start: b.start, dur: b.dur, cropX: b.cropX,
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
        if (mode !== "move" && b.id === selId) { edge = mode === "l" ? "start" : "end"; markEdgeRows(); paintClose(); }
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
      box: { id: b.id, start: b.start, dur: b.dur }, crop_x: SBX.cropOf(b), ...extras(b), pieces: f.pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })),
      fps: typeof projectFps === "function" ? projectFps() : project.fps || 30, notes, quiet: !!opt.quiet,
      download: !!opt.download, copy_to: opt.folder || "" }, "*");
    making.set(b.id, "making");
    paintShortBoxes();
    if (!opt.quiet) toast(`Making "${b.name || label}" as a Short in the background${opt.download ? `, then saving it in ${opt.folder}` : ", then its Ready to post page"}${notes.length ? ". Note: " + notes.join("; ") : ""}. Keep editing.`);
    return true;
  };

  function escapeHtmlSb(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
}
