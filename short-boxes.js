/* Short boxes (Steve, 23 Nov 2026): "Add Short" puts a Short box on the timeline (30 s by default); drag either end to
   make it 15 s to 3 min, move it along. Each box has Export and Download; "Export Shorts (N)" in the top bar makes every
   box at once (23 Nov). A box goes away once its Short is made (it is in Library > Shorts). Export hands the part of the
   edit under the box to Create Summat, which
   makes it vertical (crop / fit, your Short settings, captions, hook option) as a background job with its fast
   renderer. It never changes the edit, and you can keep editing while it renders. Several boxes are allowed.

   Kept in the project as `shortBoxes: [{id, start, dur, name?}]` (timeline seconds). The pure part (limits and which
   footage a box covers) is ShortBoxes.* and is tested on its own; the drawing and dragging use the editor's globals. */
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

  function normalize(list) {
    return (Array.isArray(list) ? list : []).filter((b) => b && typeof b === "object" && isFinite(+b.start)).slice(0, 50)
      .map((b, i) => ({ ...clamp(b, 0), id: String(b.id || "sb" + (i + 1)), name: String(b.name || "").slice(0, 80) }))
      .map((b, i, all) => all.findIndex((x) => x.id === b.id) < i ? { ...b, id: b.id + "_" + (i + 1) } : b);   // ids are unique
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

  return { MIN, MAX, DEFAULT, clamp, normalize, footage };
});

/* -- the editor side (only in a browser with the editor loaded) ------------------------------------------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addShortBox = function addShortBox() {
    const boxes = ShortBoxes.normalize(project.shortBoxes);
    const end = typeof projDur === "function" ? projDur() : 0;
    const b = ShortBoxes.clamp({ id: "sb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: state.time, dur: ShortBoxes.DEFAULT, name: "" }, end);
    if (typeof pushUndo === "function") pushUndo();
    project.shortBoxes = boxes.concat([b]);
    scheduleSave();
    toast("Short box added: drag its ends (15 s to 3 min) or the box itself, then Export or Download (or Export Shorts for all)");
  };

  // Shorts being made right now (box id -> "making"): runtime only, the box goes when Create Summat says it is done
  const making = new Map();
  window.shortBoxesMaking = making;
  function syncExportShortsButton() {
    const btn = document.getElementById("btnExportShorts");
    if (!btn) return;
    const boxes = ShortBoxes.normalize(project.shortBoxes);
    const ready = boxes.filter((b) => !making.has(b.id)).length;
    btn.textContent = `Export Shorts (${ready})`;
    btn.disabled = !ready;
    btn.classList.toggle("hidden", !boxes.length);
    btn.title = ready ? `Make all ${ready} marked Short${ready > 1 ? "s" : ""} (each in the background; the edit is not changed)` : "No Short boxes to make";
  }
  window.syncExportShortsButton = syncExportShortsButton;
  window.exportAllShorts = function exportAllShorts() {
    const boxes = ShortBoxes.normalize(project.shortBoxes).filter((b) => !making.has(b.id));
    if (!boxes.length) return toast("Add a Short box first (+ Short)");
    let sent = 0;
    boxes.forEach((b) => { const i = ShortBoxes.normalize(project.shortBoxes).findIndex((x) => x.id === b.id); if (createShortFromBox(b, b.name || `Short ${i + 1}`, { quiet: true })) sent++; });
    if (sent) toast(`Making ${sent} Short${sent > 1 ? "s" : ""} in the background (Create Summat's jobs list). Each box goes once its Short is in Library > Shorts. Keep editing.`);
  };
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.source !== "createsummat" || !d.box || !/^short-/.test(d.type || "")) return;
    const boxes = ShortBoxes.normalize(project.shortBoxes);
    const b = boxes.find((x) => x.id === d.box);
    if (d.type === "short-done") {
      making.delete(d.box);
      if (b) { project.shortBoxes = boxes.filter((x) => x.id !== d.box); scheduleSave(); }
      toast(`"${(b && b.name) || "Short"}" is made: it is in Library > Shorts`);
    } else if (d.type === "short-failed") {
      making.delete(d.box);
      toast(`"${(b && b.name) || "Short"}" was not made: ${d.error || "see the jobs list"}`);
    }
    if (typeof paintShortBoxes === "function") paintShortBoxes();
  });

  window.paintShortBoxes = function paintShortBoxes() {
    const host = els.tracksContent;
    host.querySelectorAll(".short-box").forEach((x) => x.remove());
    const boxes = ShortBoxes.normalize(project.shortBoxes);
    boxes.forEach((b, i) => {
      const el = document.createElement("div");
      const busy = making.has(b.id);
      el.className = "short-box" + (busy ? " making" : "");
      el.dataset.sb = b.id;
      el.style.left = b.start * state.pps + "px";
      el.style.width = Math.max(12, b.dur * state.pps) + "px";
      const label = b.name || `Short ${i + 1}`;
      el.innerHTML = `<div class="sb-bar"><span class="sb-name" title="Double-click to name it">${label} · ${Math.round(b.dur)} s</span>` +
        (busy ? `<span class="sb-busy">Making…</span>` :
          `<button type="button" class="btn tiny sb-make" title="Make this part a vertical Short: Library > Shorts and Ready to post (in the background; the edit is not changed)">Export</button>` +
          `<button type="button" class="btn tiny sb-dl" title="Make this Short and save just the file in a folder you choose (it also shows in Library > Shorts)">Download</button>`) +
        `<button type="button" class="btn tiny sb-del" title="Remove this box (the edit is not changed)">✕</button></div>` +
        `<div class="sb-h l" title="Drag to change where it starts"></div><div class="sb-h r" title="Drag to change where it ends"></div>`;
      host.appendChild(el);
      el.querySelector(".sb-del").onclick = (e) => { e.stopPropagation(); if (typeof pushUndo === "function") pushUndo();
        project.shortBoxes = boxes.filter((x) => x.id !== b.id); scheduleSave(); };
      el.querySelector(".sb-make")?.addEventListener("click", (e) => { e.stopPropagation(); createShortFromBox(b, label); });
      el.querySelector(".sb-dl")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const r = typeof askHost === "function" ? await askHost("choose-folder", { start: getSetting("downloadFolder") || "" }) : null;
        if (!r || !r.path) return toast("No folder chosen, so nothing was made");
        setSetting("downloadFolder", r.path);
        createShortFromBox(b, label, { download: true, folder: r.path });
      });
      el.querySelector(".sb-name").ondblclick = (e) => { e.stopPropagation(); const n = prompt("Name of this Short", b.name || label);
        if (n == null) return; b.name = n.trim().slice(0, 80); project.shortBoxes = boxes; scheduleSave(); };
      const drag = (mode) => (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        e.preventDefault(); e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        const x0 = e.clientX, s0 = b.start, d0 = b.dur, end = typeof projDur === "function" ? projDur() : 0;
        let moved = false;
        el.onpointermove = (m) => {
          const dt = (m.clientX - x0) / state.pps;
          let nb = mode === "move" ? { ...b, start: s0 + dt } : mode === "l" ? { ...b, start: Math.min(s0 + dt, s0 + d0 - ShortBoxes.MIN), dur: d0 - Math.min(dt, d0 - ShortBoxes.MIN) } : { ...b, dur: d0 + dt };
          if (mode === "l" && nb.dur > ShortBoxes.MAX) { nb.start = s0 + d0 - ShortBoxes.MAX; nb.dur = ShortBoxes.MAX; }
          nb = ShortBoxes.clamp(nb, end);
          if (!moved && typeof pushUndo === "function") pushUndo();
          moved = true;
          Object.assign(b, nb);
          el.style.left = b.start * state.pps + "px"; el.style.width = Math.max(12, b.dur * state.pps) + "px";
          el.querySelector(".sb-name").textContent = `${label} · ${Math.round(b.dur)} s`;
        };
        el.onpointerup = () => { el.onpointermove = null; if (moved) { project.shortBoxes = boxes; scheduleSave(); } };
      };
      el.addEventListener("pointerdown", (e) => drag(e.target.classList.contains("sb-h") ? (e.target.classList.contains("l") ? "l" : "r") : "move")(e));
    });
    syncExportShortsButton();
  };

  window.createShortFromBox = function createShortFromBox(b, label, opt = {}) {
    if (making.has(b.id)) return false;
    const f = ShortBoxes.footage(project, b);
    if (!f.pieces.length) { toast(`"${b.name || label}": there is no video under this box, move it over your footage`); return false; }
    if (!(typeof inCreateSummat === "function" && inCreateSummat())) { toast("Shorts are made inside Create Summat"); return false; }
    const notes = [];
    if (f.extra) notes.push(`${f.extra} title${f.extra > 1 ? "s / effects" : " / effect"} under it ${f.extra > 1 ? "are" : "is"} not in the Short (only the footage is)`);
    if (f.slowed) notes.push("a sped-up or slowed clip plays at normal speed in the Short");
    hostWindow().postMessage({ source: "fablecut", type: "make-short", project: project.name || "", name: b.name || label,
      box: { id: b.id, start: b.start, dur: b.dur }, pieces: f.pieces.map((p) => ({ file: p.file, in: p.in, out: p.out })),
      fps: typeof projectFps === "function" ? projectFps() : project.fps || 30, notes, quiet: !!opt.quiet,
      download: !!opt.download, copy_to: opt.folder || "" }, "*");
    making.set(b.id, "making");
    paintShortBoxes();
    if (!opt.quiet) toast(`Making "${b.name || label}" as a Short in the background${opt.download ? `, then saving it in ${opt.folder}` : ""}${notes.length ? ". Note: " + notes.join("; ") : ""}. Keep editing.`);
    return true;
  };
}
