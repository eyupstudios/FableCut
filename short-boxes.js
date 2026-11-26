/* Short boxes (Steve, 23 Nov 2026; Short mode 26 Nov 2026).

   "+ Short" marks a Short on the timeline. 26 Nov: it ENDS at the playhead and covers the 30 s before it ("I find the
   end of the moment, then press Short"); with In and Out set (I / O) it covers In to Out instead (3 min at most: the
   last 3 min before Out).

   SHORT MODE: clicking a Short's band selects it (green) and opens Short mode for it: drag the band or its edges
   (15 s to 3 min, the length shown), a 9:16 preview of just this Short beside a smaller main picture with its own Play
   (only the Short's range plays), the 9:16 frame dragged left / right over the picture (saved per Short as `cropX`,
   never part of the edit), and "Accept Short". Esc or a click elsewhere leaves Short mode.

   SHORTS LIST: accepted Shorts are listed in the Editor ("Shorts (N)" in the top bar: Preview, Export, Download,
   Delete, Export all) and sent to Create Summat, which lists them under the recording's Shorts tab in the Library.

   DELETE: Delete / Backspace, the right-click menu or the bin on the band, always asking "Delete Short 1 (the marker
   only, your video and edit stay)". While a Short is selected the main Delete never touches the edit.

   Export hands the footage under the box (and its frame position) to Create Summat, which makes it vertical in the
   background. The edit is never changed.

   Kept in the project as `shortBoxes: [{id, start, dur, name?, cropX?, accepted?}]` (timeline seconds; cropX 0 = the
   frame at the left edge, 0.5 = centre, 1 = right edge). The pure part is ShortBoxes.* and is tested on its own. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShortBoxes = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MIN = 15, MAX = 180, DEFAULT = 30;

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
        cropX: Math.round(cropOf(b) * 1000) / 1000, accepted: b.accepted === true }))
      .map((b, i, all) => all.findIndex((x) => x.id === b.id) < i ? { ...b, id: b.id + "_" + (i + 1) } : b);   // ids are unique
  }

  /** 26 Nov: where "+ Short" puts a new box. With In and Out set: In to Out (a span over 3 min keeps its last
   *  3 min, ending at Out). Otherwise the box ENDS at the playhead and covers the 30 s before it (from 0 when the
   *  playhead is nearer the start than that; 15 s at least). */
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

  /** The 9:16 window over a picture `w` x `h` at frame position `cropX`: {x, w} in the picture's pixels. */
  function window916(w, h, cropX) {
    const fw = Math.min(w, Math.round(h * 9 / 16));
    return { x: Math.round((w - fw) * (isFinite(+cropX) ? Math.min(1, Math.max(0, +cropX)) : 0.5)), w: fw };
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

  return { MIN, MAX, DEFAULT, clamp, normalize, forPlayhead, length, window916, deleteText, footage, cropOf };
});

/* -- the editor side (only in a browser with the editor loaded) ------------------------------------------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const SBX = ShortBoxes;
  const boxesNow = () => SBX.normalize(project.shortBoxes);
  const labelOf = (b, i) => b.name || `Short ${i + 1}`;
  let selId = null;          // the Short in Short mode
  let playEnd = null;        // its Play: stop here
  let raf = 0;

  window.addShortBox = function addShortBox() {
    const boxes = boxesNow();
    const end = typeof projDur === "function" ? projDur() : 0;
    const p = SBX.forPlayhead(state.time, project.inPoint, project.outPoint, end);
    const b = { id: "sb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: p.start, dur: p.dur, name: "", cropX: 0.5, accepted: false };
    if (typeof pushUndo === "function") pushUndo();
    project.shortBoxes = boxes.concat([b]);
    scheduleSave();
    toast(p.from === "io" ? `Short added from In to Out (${SBX.length(b.dur)}). Click it to adjust, preview and accept it.`
      : `Short added: the ${SBX.length(b.dur)} before the playhead. Click it to adjust, preview and accept it.`);
    selectShort(b.id);
  };

  // Shorts being made right now (box id -> "making"): runtime only, the box goes when Create Summat says it is done
  const making = new Map();
  window.shortBoxesMaking = making;

  /* -- the Shorts list (top bar "Shorts (N)") -------------------------------------------------------------------- */
  function syncExportShortsButton() {
    const btn = document.getElementById("btnExportShorts");
    if (!btn) return;
    const boxes = boxesNow(), acc = boxes.filter((b) => b.accepted);
    btn.textContent = `Shorts (${acc.length})`;
    btn.disabled = false;
    btn.classList.toggle("hidden", !boxes.length);
    btn.title = acc.length ? `Your ${acc.length} accepted Short${acc.length > 1 ? "s" : ""}: preview, export or download each, or Export all`
      : "No Short accepted yet: click a Short's band, then tick Accept Short";
    const list = document.getElementById("shortsList");
    if (list && !list.hidden) drawList();
  }
  window.syncExportShortsButton = syncExportShortsButton;

  function drawList() {
    let list = document.getElementById("shortsList");
    if (!list) {
      list = document.createElement("div");
      list.id = "shortsList";
      list.className = "sb-list";
      document.body.appendChild(list);
    }
    const boxes = boxesNow(), acc = boxes.map((b, i) => [b, i]).filter(([b]) => b.accepted);
    const waiting = boxes.length - acc.length;
    list.innerHTML = `<div class="sb-list-head"><b>Shorts</b>` +
      (acc.length ? `<button type="button" class="btn tiny accent" data-sl="all" title="Make every accepted Short (each in the background; the edit is not changed)">Export all (${acc.filter(([b]) => !making.has(b.id)).length})</button>` : "") +
      `<button type="button" class="btn tiny" data-sl="close">Close</button></div>` +
      (acc.length ? acc.map(([b, i]) => `<div class="sb-row" data-id="${b.id}"><span class="sb-row-name">${escapeHtmlSb(labelOf(b, i))}</span>` +
        `<span class="dim">${clockSb(b.start)}–${clockSb(b.start + b.dur)} · ${SBX.length(b.dur)}</span>` +
        (making.has(b.id) ? `<span class="sb-busy">Making…</span>` :
          `<button type="button" class="btn tiny" data-sl="preview">Preview</button><button type="button" class="btn tiny" data-sl="export">Export</button>` +
          `<button type="button" class="btn tiny" data-sl="download">Download</button>`) +
        `<button type="button" class="btn tiny sb-bin" data-sl="delete" title="${escapeHtmlSb(SBX.deleteText(i + 1, b.name))}">🗑</button></div>`).join("")
        : `<p class="dim">No Short accepted yet. Click a Short's band on the timeline, then tick <b>Accept Short</b>.</p>`) +
      (waiting ? `<p class="dim">${waiting} more Short${waiting > 1 ? "s" : ""} on the timeline not accepted yet.</p>` : "");
    const btn = document.getElementById("btnExportShorts");
    if (btn) { const r = btn.getBoundingClientRect(); list.style.top = Math.round(r.bottom + 6) + "px"; list.style.left = Math.max(8, Math.round(r.right - 420)) + "px"; }
    list.hidden = false;
    list.querySelectorAll("[data-sl]").forEach((x) => x.onclick = (e) => {
      e.stopPropagation();
      const act = x.dataset.sl, row = x.closest(".sb-row");
      if (act === "close") { list.hidden = true; return; }
      if (act === "all") return exportAllShorts();
      const all = boxesNow(), i = all.findIndex((y) => y.id === row.dataset.id), b = all[i];
      if (!b) return;
      if (act === "preview") { selectShort(b.id); playShort(); }
      else if (act === "export") createShortFromBox(b, labelOf(b, i));
      else if (act === "download") downloadShort(b, labelOf(b, i));
      else if (act === "delete") askDelete(b.id);
    });
  }
  window.toggleShortsList = function toggleShortsList() {
    const list = document.getElementById("shortsList");
    if (list && !list.hidden) { list.hidden = true; return; }
    drawList();
  };
  window.exportAllShorts = function exportAllShorts() {
    const all = boxesNow();
    const boxes = all.filter((b) => b.accepted && !making.has(b.id));
    if (!boxes.length) return toast(all.length ? "Accept a Short first: click its band, then tick Accept Short" : "Add a Short first (+ Short)");
    let sent = 0;
    boxes.forEach((b) => { if (createShortFromBox(b, labelOf(b, all.findIndex((x) => x.id === b.id)), { quiet: true })) sent++; });
    if (sent) toast(`Making ${sent} Short${sent > 1 ? "s" : ""} in the background (Create Summat's jobs list). Each one goes from this list once it is in Library > Shorts. Keep editing.`);
  };

  /* -- delete: always the same question; never the edit ----------------------------------------------------------- */
  function askDelete(id) {
    const all = boxesNow(), i = all.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const text = SBX.deleteText(i + 1, all[i].name);
    if (!confirm(text + "?")) return true;
    if (typeof pushUndo === "function") pushUndo();
    project.shortBoxes = all.filter((x) => x.id !== id);
    scheduleSave();
    if (selId === id) leaveShortMode();
    paintShortBoxes();
    toast(`Short ${i + 1} deleted (the marker only, your video and edit stay)`);
    return true;
  }
  window.askDeleteShort = askDelete;
  /** The main Delete / Ripple delete call this first: with a Short selected it deletes the Short (after asking) and
   *  the edit is never touched. Returns true when it handled the key. */
  window.shortDeleteSelected = function shortDeleteSelected() {
    if (!selId) return false;
    askDelete(selId);
    return true;
  };

  /* -- Short mode ------------------------------------------------------------------------------------------------- */
  function selectShort(id) {
    if (!boxesNow().some((b) => b.id === id)) return;
    if (selId !== id) { stopShortPlay(); selId = id; }
    if (typeof setSelection === "function" && state.selIds && state.selIds.size) setSelection([]);   // Delete never hits a clip now
    document.getElementById("monitorPanel")?.classList.add("short-mode");
    drawPanel();
    paintShortBoxes();
    if (!raf) raf = requestAnimationFrame(frameLoop);
  }
  window.selectShort = selectShort;
  window.shortSelectedId = () => selId;

  function leaveShortMode() {
    if (!selId) return;
    stopShortPlay();
    selId = null;
    document.getElementById("monitorPanel")?.classList.remove("short-mode");
    document.getElementById("shortPanel")?.remove();
    document.getElementById("shortCrop")?.remove();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    paintShortBoxes();
  }
  window.leaveShortMode = leaveShortMode;

  function current() {
    const all = boxesNow(), i = all.findIndex((b) => b.id === selId);
    return i < 0 ? [null, -1] : [all[i], i];
  }
  function update(fn) {               // change the selected Short (its frame, accepted, name), saved
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
    if (typeof play === "function") play();
    drawPanelButtons();
  }
  window.playShort = playShort;
  function stopShortPlay() {
    if (playEnd != null && state.playing && typeof pause === "function") pause();
    playEnd = null;
    drawPanelButtons();
  }

  function drawPanel() {
    const [b, i] = current();
    if (!b) return leaveShortMode();
    const host = document.getElementById("monitorPanel");
    if (!host) return;
    let p = document.getElementById("shortPanel");
    if (!p) {
      p = document.createElement("div");
      p.id = "shortPanel";
      p.className = "sb-panel";
      host.appendChild(p);
    }
    p.innerHTML = `<div class="sb-panel-head"><b>${escapeHtmlSb(labelOf(b, i))}</b><span class="dim">${clockSb(b.start)}–${clockSb(b.start + b.dur)} · <b class="sb-len">${SBX.length(b.dur)}</b></span></div>` +
      `<canvas id="shortPreview" width="180" height="320" title="This Short as it will look (9:16)"></canvas>` +
      `<div class="sb-panel-row"><button type="button" class="btn tiny accent" id="sbPlay">▶ Play Short</button>` +
      `<label class="sb-accept"><input type="checkbox" id="sbAccept" ${b.accepted ? "checked" : ""}> Accept Short</label></div>` +
      `<label class="sb-panel-row" title="Where the 9:16 frame sits over the picture (or drag the frame on the picture)">Frame <input type="range" id="sbCrop" min="0" max="1" step="0.01" value="${b.cropX}"></label>` +
      `<div class="sb-panel-row"><button type="button" class="btn tiny" id="sbExport" ${making.has(b.id) ? "disabled" : ""}>Export</button>` +
      `<button type="button" class="btn tiny" id="sbDownload" ${making.has(b.id) ? "disabled" : ""}>Download</button>` +
      `<button type="button" class="btn tiny sb-bin" id="sbDelete" title="${escapeHtmlSb(SBX.deleteText(i + 1, b.name))}">🗑 Delete</button></div>` +
      `<p class="dim">Drag the band or its edges on the timeline (15 s to 3 min). Esc or a click elsewhere: done.</p>` +
      `<div class="sb-panel-row"><button type="button" class="btn tiny" id="sbDone">Done</button></div>`;
    p.querySelector("#sbPlay").onclick = playShort;
    p.querySelector("#sbCrop").oninput = (e) => update((x) => { x.cropX = Math.round(+e.target.value * 1000) / 1000; });
    p.querySelector("#sbAccept").onchange = (e) => { update((x) => { x.accepted = e.target.checked; });
      toast(e.target.checked ? `${labelOf(b, i)} accepted: it is in the Shorts list (top bar) and in Library > Shorts` : `${labelOf(b, i)} is no longer accepted`);
      syncExportShortsButton(); sendList(); };
    p.querySelector("#sbExport").onclick = () => { const [x, k] = current(); if (x) createShortFromBox(x, labelOf(x, k)); };
    p.querySelector("#sbDownload").onclick = () => { const [x, k] = current(); if (x) downloadShort(x, labelOf(x, k)); };
    p.querySelector("#sbDelete").onclick = () => askDelete(selId);
    p.querySelector("#sbDone").onclick = leaveShortMode;
    drawPanelButtons();
  }
  function drawPanelButtons() {
    const btn = document.getElementById("sbPlay");
    if (btn) btn.textContent = playEnd != null && state.playing ? "❚❚ Pause" : "▶ Play Short";
  }

  /** Every frame while in Short mode: the 9:16 preview, the frame over the picture, the Short's Play range. */
  function frameLoop() {
    raf = 0;
    const [b] = current();
    if (!b) return;
    if (playEnd != null) {
      if (!state.playing) { playEnd = null; drawPanelButtons(); }
      else if (state.time >= playEnd - 0.01) { stopShortPlay(); }
    }
    const src = els.preview, cv = document.getElementById("shortPreview");
    if (src && cv && src.width && src.height) {
      const w = SBX.window916(src.width, src.height, b.cropX);
      const g = cv.getContext("2d");
      try { g.drawImage(src, w.x, 0, w.w, src.height, 0, 0, cv.width, cv.height); } catch { /* a tainted frame: the panel stays */ }
    }
    placeCrop(b);
    raf = requestAnimationFrame(frameLoop);
  }

  function placeCrop(b) {
    const cvs = els.preview, inner = cvs && cvs.parentElement;
    if (!inner) return;
    let o = document.getElementById("shortCrop");
    if (!o) {
      o = document.createElement("div");
      o.id = "shortCrop";
      o.className = "sb-crop";
      o.innerHTML = `<div class="sb-win" title="Drag left or right: what this Short shows (only this Short; the edit is not changed)"><span>9:16</span></div>`;
      inner.appendChild(o);
      const win = o.querySelector(".sb-win");
      win.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        win.setPointerCapture(e.pointerId);
        const x0 = e.clientX, [bb] = current(), c0 = bb ? bb.cropX : 0.5;
        const room = Math.max(1, o.clientWidth - win.offsetWidth);
        win.onpointermove = (m) => {
          const v = Math.min(1, Math.max(0, c0 + (m.clientX - x0) / room));
          update((x) => { x.cropX = Math.round(v * 1000) / 1000; });
          const r = document.getElementById("sbCrop"); if (r) r.value = String(v);
        };
        win.onpointerup = () => { win.onpointermove = null; };
      });
    }
    o.style.left = cvs.offsetLeft + "px"; o.style.top = cvs.offsetTop + "px";
    o.style.width = cvs.offsetWidth + "px"; o.style.height = cvs.offsetHeight + "px";
    const win = o.querySelector(".sb-win");
    const fw = Math.min(cvs.offsetWidth, cvs.offsetHeight * 9 / 16);
    win.style.width = fw + "px";
    win.style.left = (cvs.offsetWidth - fw) * b.cropX + "px";
  }

  // Esc / Delete while in Short mode (before the editor's own keys: the main Delete must never touch the edit)
  window.addEventListener("keydown", (e) => {
    if (!selId) return;
    const typing = typeof isTypingTarget === "function" && isTypingTarget(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); leaveShortMode(); }
    else if (!typing && (e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); e.stopImmediatePropagation(); askDelete(selId);
    }
  }, true);
  // a click anywhere else leaves Short mode
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    const menu = document.getElementById("sbMenu");
    if (menu && !menu.contains(t)) menu.remove();
    if (!selId || !(t instanceof Element)) return;
    if (t.closest(".short-box, #shortPanel, #shortCrop, #sbMenu, #shortsList, #btnExportShorts, #btnAddShort")) return;
    leaveShortMode();
  }, true);

  function showMenu(x, y, id) {
    document.getElementById("sbMenu")?.remove();
    const all = boxesNow(), i = all.findIndex((b) => b.id === id);
    if (i < 0) return;
    const m = document.createElement("div");
    m.id = "sbMenu"; m.className = "ctx-menu";
    const item = (label, run) => { const b = document.createElement("button"); b.type = "button"; b.className = "ctx-item";
      b.innerHTML = `<span>${escapeHtmlSb(label)}</span>`; b.onclick = () => { m.remove(); run(); }; m.appendChild(b); };
    item("Open in Short mode", () => selectShort(id));
    item(all[i].accepted ? "Un-accept" : "Accept Short", () => { selId = id; update((b) => { b.accepted = !b.accepted; }); syncExportShortsButton(); sendList(); selectShort(id); });
    item(SBX.deleteText(i + 1, all[i].name), () => askDelete(id));
    document.body.appendChild(m);
    m.style.position = "fixed";
    m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + "px";
    m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + "px";
  }

  /* -- Create Summat: the accepted Shorts (Library > Shorts), made / removed there ---------------------------------- */
  let sentSig = null;
  function sendList(force) {
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) return;
    const fps = typeof projectFps === "function" ? projectFps() : project.fps || 30;
    const shorts = boxesNow().map((b, i) => [b, i]).filter(([b]) => b.accepted).map(([b, i]) => ({ id: b.id, name: labelOf(b, i), start: b.start, dur: b.dur, cropX: b.cropX,
      pieces: SBX.footage(project, b).pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })) }));
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
  });

  window.paintShortBoxes = function paintShortBoxes() {
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
      el.innerHTML = `<div class="sb-bar" title="Click: Short mode (preview, frame, accept). Drag: move it."><span class="sb-name" title="Double-click to name it">${escapeHtmlSb(label)} · ${SBX.length(b.dur)}${b.accepted ? " ✓" : ""}</span>` +
        (busy ? `<span class="sb-busy">Making…</span>` :
          `<button type="button" class="btn tiny sb-make" title="Make this part a vertical Short: Library > Shorts and Ready to post (in the background; the edit is not changed)">Export</button>` +
          `<button type="button" class="btn tiny sb-dl" title="Make this Short and save just the file in a folder you choose (it also shows in Library > Shorts)">Download</button>`) +
        `<button type="button" class="btn tiny sb-del" title="${escapeHtmlSb(SBX.deleteText(i + 1, b.name))}">🗑</button></div>` +
        `<div class="sb-h l" title="Drag to change where it starts"></div><div class="sb-h r" title="Drag to change where it ends"></div>`;
      host.appendChild(el);
      el.querySelector(".sb-del").onclick = (e) => { e.stopPropagation(); askDelete(b.id); };
      el.querySelector(".sb-make")?.addEventListener("click", (e) => { e.stopPropagation(); createShortFromBox(b, label); });
      el.querySelector(".sb-dl")?.addEventListener("click", (e) => { e.stopPropagation(); downloadShort(b, label); });
      el.querySelector(".sb-name").ondblclick = (e) => { e.stopPropagation(); const n = prompt("Name of this Short", b.name || label);
        if (n == null) return; b.name = n.trim().slice(0, 80); project.shortBoxes = boxes; scheduleSave(); sendList(); };
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
          const len = document.querySelector("#shortPanel .sb-len"); if (len && b.id === selId) len.textContent = SBX.length(b.dur);
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          if (moved) { project.shortBoxes = boxes; scheduleSave(); if (b.id === selId) drawPanel(); sendList(); }
          selectShort(b.id);                                           // a click (or the end of a drag): Short mode
        };
      };
      el.addEventListener("pointerdown", (e) => drag(e.target.classList.contains("sb-h") ? (e.target.classList.contains("l") ? "l" : "r") : "move")(e));
    });
    syncExportShortsButton();
    sendList();
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
    if (!f.pieces.length) { toast(`"${b.name || label}": there is no video under this box, move it over your footage`); return false; }
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) { toast("Shorts are made inside Create Summat"); return false; }
    const notes = [];
    if (f.extra) notes.push(`${f.extra} title${f.extra > 1 ? "s / effects" : " / effect"} under it ${f.extra > 1 ? "are" : "is"} not in the Short (only the footage is)`);
    if (f.slowed) notes.push("a sped-up or slowed clip plays at normal speed in the Short");
    hostWindow().postMessage({ source: "fablecut", type: "make-short", project: project.name || "", name: b.name || label,
      box: { id: b.id, start: b.start, dur: b.dur }, crop_x: SBX.cropOf(b), pieces: f.pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })),
      fps: typeof projectFps === "function" ? projectFps() : project.fps || 30, notes, quiet: !!opt.quiet,
      download: !!opt.download, copy_to: opt.folder || "" }, "*");
    making.set(b.id, "making");
    paintShortBoxes();
    if (!opt.quiet) toast(`Making "${b.name || label}" as a Short in the background${opt.download ? `, then saving it in ${opt.folder}` : ""}${notes.length ? ". Note: " + notes.join("; ") : ""}. Keep editing.`);
    return true;
  };

  function escapeHtmlSb(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function clockSb(t) { t = Math.max(0, +t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + s.toFixed(1).padStart(4, "0"); }
}
