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
           deleteText, footage, cropOf };
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
            `<label>Start<input data-f="start" value="${SBX.clock(b.start)}"></label><label>End<input data-f="end" value="${SBX.clock(b.start + b.dur)}"></label>` +
            `<label class="wide">Frame <span class="dim">(left … right)</span><input type="range" data-f="cropX" min="0" max="1" step="0.01" value="${b.cropX}"></label>` +
            `<label class="wide">On-screen text <span class="dim">(this Short only)</span><input data-f="text" value="${escapeHtmlSb(b.text)}" maxlength="80" placeholder="e.g. BUSTED"></label>` +
            `<label>Speed<select data-f="speed">${SBX.SPEEDS.map((s) => `<option value="${s}" ${s === b.speed ? "selected" : ""}>${s}×</option>`).join("")}</select></label>` +
            `<label>Look<select data-f="look">${Object.entries(SBX.LOOKS).map(([k, [n]]) => `<option value="${k}" ${k === b.look ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>` : "") +
          `<div class="sbt-acts">` + (busy ? `<span class="sb-busy">Making…</span>` :
            `<button type="button" class="btn tiny" data-sbt="preview">${on && playEnd != null && state.playing ? "❚❚ Pause" : "▶ Preview"}</button>` +
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
      else if (act === "export") createShortFromBox(b, labelOf(b, i));
      else if (act === "download") downloadShort(b, labelOf(b, i));
      else if (act === "delete") askDelete(b.id);
    });
    page.querySelectorAll(".sbt").forEach((row) => row.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, input[type=checkbox]")) return;
      if (row.dataset.id !== selId) selectShort(row.dataset.id);
    }));
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
      const t = SBX.parseClock(v);
      if (!isFinite(t)) return toast("Write a time like 1:05.2");
      const s = f === "start" ? t : b.start, e = f === "end" ? t : b.start + b.dur;
      if (e - s < SBX.MIN || e - s > SBX.MAX) toast(`A Short is ${SBX.MIN} s to ${SBX.MAX / 60} min: kept inside that`);
      const ns = f === "start" ? Math.min(s, e - SBX.MIN) : s;
      Object.assign(b, SBX.clamp({ ...b, start: ns, dur: e - ns }, end));
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
    if (selId !== id) { stopShortPlay(); selId = id; }
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
    selId = null;
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

  function playShort() {
    const [b] = current();
    if (!b) return;
    if (playEnd != null && state.playing) { stopShortPlay(); return; }
    if (typeof setTime === "function") setTime(b.start); else state.time = b.start;
    playEnd = b.start + b.dur;
    playRate0 = state.previewRate;
    state.previewRate = b.speed || 1;                     // its own speed while it plays
    if (typeof play === "function") play();
    drawStageButtons();
    renderShortsPage();
  }
  window.playShort = playShort;
  function stopShortPlay() {
    if (playEnd != null && state.playing && typeof pause === "function") pause();
    if (playRate0 != null) { state.previewRate = playRate0; playRate0 = null; }
    playEnd = null;
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
    if (btn) btn.textContent = playEnd != null && state.playing ? "❚❚ Pause" : "▶ Play Short";
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
      else if (state.time >= playEnd - 0.01) { stopShortPlay(); renderShortsPage(); }
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
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); leaveShortMode(); }
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
        el.onpointermove = (m) => {
          if (!moved && Math.abs(m.clientX - x0) < 3) return;         // a click, not a drag (yet)
          const dt = (m.clientX - x0) / state.pps;
          let nb = mode === "move" ? { ...b, start: s0 + dt } : mode === "l" ? { ...b, start: Math.min(s0 + dt, s0 + d0 - SBX.MIN), dur: d0 - Math.min(dt, d0 - SBX.MIN) } : { ...b, dur: d0 + dt };
          if (mode === "l" && nb.dur > SBX.MAX) { nb.start = s0 + d0 - SBX.MAX; nb.dur = SBX.MAX; }
          nb = SBX.clamp(nb, end);
          if (!moved && typeof pushUndo === "function") pushUndo();
          moved = true;
          Object.assign(b, nb);
          el.style.left = b.start * state.pps + "px"; el.style.width = Math.max(12, b.dur * state.pps) + "px";
          el.querySelector(".sb-name").textContent = `${label} · ${SBX.length(b.dur)}${b.accepted ? " ✓" : ""}`;
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          if (moved) { project.shortBoxes = boxes; scheduleSave(); sendList(); }
          selectShort(b.id);                                           // a click (or the end of a drag): Short mode
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
