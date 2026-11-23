/* Hover help (Steve, 23 Nov 2026): "Hover help on EVERY button and control in the Editor: after half a second show a
   plain-words tip: what it does + shortcut key. E.g. "Ripple delete: removes the clip and slides everything after it
   left so there's no gap. (Shift+Delete)". Plain words, no jargon. Also a "?" button that lists them all."

   TIPS below are the words for every fixed control (by selector). Controls the editor draws as it goes (clips,
   track buttons, Inspector rows...) carry their own words in data-tip or title; both show the same way. A title is
   moved to data-tip on first hover, so the browser's own slow tooltip never shows on top. The "?" window
   (Keyboard shortcuts) gets a "What every button does" list from TIPS, searchable with its filter box. */
"use strict";
(function () {
  const TIPS = [
    // ── top bar
    ["Top bar", "#btnProjectsDash", "Projects", "Opens your list of projects: open one, start a new one, copy, rename or put one away. (Ctrl+O)"],
    ["Top bar", "#btnUndo", "Undo", "Takes back the last change. (Ctrl+Z)"],
    ["Top bar", "#btnRedo", "Redo", "Puts back the change you just undid. (Ctrl+Y or Ctrl+Shift+Z)"],
    ["Top bar", "[data-ws=edit]", "Edit", "The normal editing layout: your media on the left, the clip's settings on the right."],
    ["Top bar", "[data-ws=color]", "Color", "The colour layout: brightness and colour graphs beside the picture, and colour controls for the selected clip."],
    ["Top bar", "#btnLayoutReset", "Layout", "Puts every panel back to its normal size and place."],
    ["Top bar", "[data-track-size=l]", "S", "Small picture, big timeline: more room to see your clips."],
    ["Top bar", "[data-track-size=m]", "M", "Medium picture and medium timeline."],
    ["Top bar", "[data-track-size=s]", "L", "Large picture, small timeline (clips shown without pictures)."],
    ["Top bar", "#btnSettings", "Settings", "Editor settings, such as how clips you click on are picked."],
    ["Top bar", "#btnHelp", "?", "This help: what every button does, and every keyboard shortcut."],
    ["Top bar", "#btnExport", "Export", "Makes the finished video file. Edits that are only cuts and fades use the fast render."],
    ["Top bar", "#btnTitle", "Title", "Adds a text title at the red playhead."],
    ["Top bar", "#btnAdjust", "Adjustment layer", "Adds a layer that changes the look of everything under it (colour, blur, shake) without touching the clips."],
    // ── media bin
    ["Media", "#btnImport", "Import", "Adds video, sound or picture files from your computer to this project."],
    ["Media", "#btnImportUrl", "Import from a link", "Downloads a file from a web link (https) into this project."],
    ["Media", "[data-tab=project]", "Project", "The files in this project. Right-click for a new folder."],
    ["Media", "[data-tab=elements]", "Elements", "Pictures to lay over your video: light leaks, textures, stickers."],
    ["Media", "[data-tab=sfx]", "SFX", "Sound effects: whooshes, hits, clicks. Drag one onto the timeline."],
    ["Media", "[data-tab=svg]", "SVG", "Moving graphics you can lay over your video."],
    ["Media", "[data-tab=shapes]", "Shapes", "Rectangles, circles, stars and lines to draw on the video."],
    ["Media", "[data-tab=templates]", "Templates", "Ready-made name straps, logo animations and social layouts: type your own words in."],
    ["Media", "#binSearch", "Search", "Finds files by name, kind, size or tag. #word finds tags only. Esc clears it."],
    ["Media", "#binFilter", "Show", "Shows only some files: favourites, used, unused, one kind, one tag."],
    ["Media", "#binSort", "Sort by", "Puts the files in order by name, length, size and more."],
    ["Media", "#binSortDir", "Up / down", "Flips the order (A to Z or Z to A)."],
    ["Media", "#binViewBtn", "List view", "Shows the files as a list with their length, size and frame rate."],
    // ── monitor
    ["Monitor", "#btnMonSource", "Source", "Shows the file you opened from the media list, so you can pick the part you want before putting it in the edit."],
    ["Monitor", "#btnMonProgram", "Program", "Shows your edit, as it will look when exported."],
    ["Monitor", "#btnZoom100", "Fit", "Fits the picture back into the window after zooming or moving it."],
    ["Monitor", "#aspectSel", "Shape", "The shape of the video: wide (16:9), tall (9:16), square and more."],
    ["Monitor", "#fpsSel", "Frame rate", "How many pictures a second the edit and the export have (30 or 60 for most videos)."],
    ["Monitor", "#exportFrameSel", "Export frame", "Exports only a part of the picture, for example a tall 9:16 cut from a wide video."],
    ["Monitor", "#btnExportFrame", "Frame", "Shows the export frame on the picture; drag it to choose which part is exported."],
    ["Monitor", "#btnExportFrameDim", "Lights off", "Darkens everything outside the export frame, so you see only what will be exported."],
    ["Monitor", "#btnGuides", "Safe", "Shows lines where text is safe from being cut off on TVs and phones."],
    ["Monitor", "#btnProxy", "Proxy", "Plays light copies of big files so editing is smooth. The export always uses the real files."],
    ["Monitor", "#btnMarkIn", "Mark In", "Sets where a part starts: in the Source view, the start of the piece to use; in your edit, the start of the range to play or export. (I)"],
    ["Monitor", "#btnMarkOut", "Mark Out", "Sets where a part ends: in the Source view, the end of the piece to use; in your edit, the end of the range to play or export. (O)"],
    ["Monitor", "#btnHome", "Start", "Jumps to the start. (Home)"],
    ["Monitor", "#btnBack", "Back a frame", "Steps back one frame. (Left arrow; Shift+Left = one second)"],
    ["Monitor", "#btnPlay", "Play", "Plays or pauses. (Space)"],
    ["Monitor", "#btnFwd", "Forward a frame", "Steps forward one frame. (Right arrow; Shift+Right = one second)"],
    ["Monitor", "#btnEnd", "End", "Jumps to the end. (End)"],
    ["Monitor", "#btnSpeed", "Preview speed", "How fast the preview plays while you watch: 1x, 1.5x, 2x, 4x. Never changes the export. (L faster, J backwards, K stop)"],
    ["Monitor", "#btnInsert", "Insert", "Puts the marked part of the Source file into the edit at the red playhead and pushes everything after it along. (,)"],
    ["Monitor", "#btnReplace", "Replace", "Puts the marked part of the Source file into the edit at the red playhead, over what is there, without moving anything. (.)"],
    // ── side panel
    ["Side panel", "[data-side=inspector]", "Inspector", "The settings of the selected clip: size, position, look, fades, sound."],
    ["Side panel", "[data-side=mixer]", "Mixer", "The loudness of each sound track and of the whole video, with mute and solo."],
    ["Side panel", "[data-side=color]", "Color", "Colour controls for the selected clip: brightness, warmth, contrast."],
    ["Side panel", "[data-side=transcript]", "Transcript", "The words spoken in your edit: turn speech into text, find a word, cut by deleting words."],
    // ── timeline toolbar
    ["Timeline", "#btnSequences", "Sequences", "Other versions of this edit in the same project, like a tall 9:16 cut or a short version."],
    ["Timeline", "#btnTrimIO", "Trim to In/Out", "Cuts the clips at the In and Out marks. (Shift+T)"],
    ["Timeline", "#btnWorkAreaPlay", "Limit", "Plays only between the In and Out marks, and Home / End jump to them."],
    ["Timeline", "[data-edit-tool=select]", "Selection tool", "Click a clip to pick it, drag it to move it, drag its ends to shorten or lengthen it. (V)"],
    ["Timeline", "[data-edit-tool=ripple]", "Ripple edit tool", "Drag a clip's end: everything after it moves along with it, so no gap appears. (B)"],
    ["Timeline", "[data-edit-tool=roll]", "Rolling edit tool", "Drag the cut between two clips: one gets longer as the other gets shorter, nothing else moves. (R)"],
    ["Timeline", "[data-edit-tool=slip]", "Slip tool", "Drag a clip to show an earlier or later part of its recording, without moving or resizing it. (Y)"],
    ["Timeline", "[data-edit-tool=slide]", "Slide tool", "Drag a clip along: the clips either side shorten or lengthen to make room. (U)"],
    ["Timeline", "#btnSplit", "Split", "Cuts the clips in two at the red playhead. (S)"],
    ["Timeline", "#btnCloseGap", "Close gap", "Removes the empty space under the red playhead by sliding the clips after it left. (Shift+G)"],
    ["Timeline", "#btnNextGap", "Find gap", "Jumps to the next empty space between clips, so you can see if you left a hole. (G)"],
    ["Timeline", "#btnDelete", "Delete", "Removes the selected clips and leaves an empty space where they were. (Delete)"],
    ["Timeline", "#btnRippleDelete", "Ripple delete", "Removes the clip and slides everything after it left so there's no gap. (Shift+Delete)"],
    ["Timeline", "#btnLift", "Lift", "Removes everything between the In and Out marks and leaves an empty space. (;)"],
    ["Timeline", "#btnExtract", "Extract", "Removes everything between the In and Out marks and closes the space, so the rest moves up. (')"],
    ["Timeline", "#btnSnap", "Snap", "When on, clips you drag jump neatly to the playhead, markers and other clips' ends. (N)"],
    ["Timeline", "#btnSnapMenu", "Snap to", "Chooses what clips snap to: clip ends, the playhead, markers, In/Out, keyframes, frames."],
    ["Timeline", "#btnAddShort", "Short", "Adds a Short box at the red playhead (30 s; drag its ends for 15 s to 3 min). Each box becomes a vertical Short."],
    ["Timeline", "#btnThumbFrame", "Thumbnail frame", "Marks the picture at the red playhead as the video's thumbnail. Click it again on the same spot to take it off."],
    ["Timeline", "#btnExportShorts", "Export Shorts", "Makes every Short box into its own vertical video, in the background. Your edit is not changed."],
    ["Timeline", "#btnMarkers", "Markers", "Your markers: jump to one, rename it, change its colour. (M adds or removes one at the playhead, Shift+M goes to the next, Alt+Shift+M the one before)"],
    ["Timeline", "#btnAudioHold", "Audio hold", "When paused, keeps playing the tiny bit of sound under the red playhead over and over, so you can find the exact spot of a word or a bang by ear. Play or Stop turns it off."],
    ["Timeline", "#zoomSlider", "Zoom", "Zooms the timeline in and out around the red playhead. Zoomed right in, times show frames too. (+ and -, or Ctrl+scroll)"],
    ["Timeline", "#btnZoomFit", "Fit", "Zooms so the whole edit fits on screen. (Shift+Z)"],
    ["Timeline", "#btnAddV", "+V", "Adds a video track (a new row for pictures, titles and overlays)."],
    ["Timeline", "#btnAddA", "+A", "Adds a sound track (a new row for music, voice or effects)."],
    // ── export window
    ["Export", "#exportRangeSel", "Range", "What to export: the whole edit, or only between the In and Out marks."],
    ["Export", "#xsSmooth", "Smooth slow-mo", "Makes new in-between pictures for slowed clips, so slow motion looks smooth. Takes longer to make."],
    ["Export", "#forceFrames", "Always frame by frame", "Skips the fast render and draws every frame in the editor. Slower; only needed if the fast render looks wrong."],
    ["Export", "#engineFast", "Standard export", "Makes the file with ffmpeg, frame by frame: works with every effect."],
    ["Export", "#engineRealtime", "Real-time export", "Plays the edit and records it: quick for short edits, may drop frames on a busy computer."],
    ["Export", "#exportProfileSel", "Quality profile", "A saved set of quality settings for the file."],
    ["Export", "#dlvRes", "Size", "How big the picture is: 1080p, 1440p, 4K..."],
    ["Export", "#dlvFps", "Frame rate", "Pictures a second in the file. Keep it the same as the edit unless a site asks for another."],
    ["Export", "#dlvCodec", "Codec", "How the video is packed: H.264 plays everywhere, H.265 is smaller but newer."],
    ["Export", "#dlvEncoder", "Encoder", "What makes the file: your graphics chip (fast) or the processor (slower, sometimes smaller)."],
    ["Export", "#dlvRate", "Quality mode", "Fixed quality (the file size follows) or a fixed size (the quality follows)."],
    ["Export", "#dlvCrf", "Quality", "Lower number = better picture and a bigger file. 18-23 is normal."],
    ["Export", "#dlvBitrate", "Bitrate", "How much data a second the video gets: more = better picture, bigger file."],
    ["Export", "#dlvReframe", "Fit to size", "What happens when the export is another shape from the edit: add black bars, or fill and cut the edges."],
    ["Export", "#dlvProfile", "Codec profile", "A technical setting for older players. Leave it as it is unless a site asks for a profile."],
    ["Export", "#dlvSpeed", "Encoding speed", "Faster makes the file sooner but a little bigger; slower makes it smaller."],
    ["Export", "#dlvPixFmt", "Colour detail", "How much colour detail the file keeps. The normal setting plays everywhere."],
    ["Export", "#dlvColor", "Colour range", "The colour standard written into the file. Leave it on the normal one for YouTube and phones."],
    ["Export", "#dlvContainer", "File type", "The kind of file: MP4 plays everywhere; MOV and MKV are for editing programs."],
    ["Export", "#dlvACodec", "Sound format", "How the sound is packed: AAC plays everywhere."],
    ["Export", "#dlvABitrate", "Sound quality", "Data a second for the sound: 192k or more sounds clean."],
    ["Export", "#dlvARate", "Sound sample rate", "48 kHz is the normal rate for video."],
    ["Export", "#dlvACh", "Sound channels", "Stereo (left and right) or mono (one channel)."],
    ["Export", "#exportWcBitrate", "Bitrate", "Data a second for the real-time export: more = better picture, bigger file."],
    ["Export", "#exportWcMode", "Real-time mode", "How the real-time export records: steady quality or steady file size."],
    ["Projects", "[data-pj-view=active]", "Projects", "Your projects in use."],
    ["Projects", "[data-pj-view=archived]", "Archived", "Projects you put away. Open one to bring it back."],
    ["Media", "#btnDoImportUrl", "Download", "Downloads the file from the link into this project."],
    ["Monitor", ".ef-handle", "Export frame handle", "Drag to move or resize the part of the picture that is exported."],
    ["Export", "#dlvLoud", "Loudness", "Makes the whole video as loud as the sites expect (YouTube about -14) and stops peaks from crackling."],
    ["Export", "#dlvFilename", "File name", "What the finished file is called."],
    ["Export", "#btnQueueExport", "Add to queue", "Saves these settings in the export list to make later."],
    ["Export", "#btnBatchExport", "Export all", "Makes every ticked output at once."],
    ["Export", "#btnDownloadExport", "Download", "Makes the file and also saves a copy in a folder you choose."],
    ["Export", "#btnStartExport", "Export", "Starts making the file now."],
    ["Export", "#btnCancelSetup", "Cancel", "Closes this window without exporting."],
    ["Export", "#btnOpenQueue", "Queue", "Shows the list of exports waiting or being made."],
    ["Export", "#btnCancelExport", "Stop", "Stops the export that is running."],
    // ── on the timeline (drawn as you edit)
    ["On the timeline", ".join-btn", "Transition (the round button on a join)", "Click it to choose what happens between two clips: None, Dip to black, Cross fade or Dip to white, and how long it takes."],
    ["On the timeline", ".clip .fade-grip.l", "Fade in grip", "The small square at a clip's top-left corner: drag it right to fade the picture and sound in."],
    ["On the timeline", ".clip .fade-grip.r", "Fade out grip", "The small square at a clip's top-right corner: drag it left to fade the picture and sound out."],
    ["On the timeline", ".trans-dur-handle", "Transition length", "Drag to make this fade or transition longer or shorter."],
    ["On the timeline", ".trans-mark", "Transition", "A fade or transition on this end of the clip. Click it to change it in the Inspector; Delete takes it off."],
    ["On the timeline", ".clip .handle.l", "Clip start", "Drag to make the clip start later or earlier."],
    ["On the timeline", ".clip .handle.r", "Clip end", "Drag to make the clip end earlier or later."],
    ["On the timeline", ".track-toggle", "Track on / off", "Hides this track from the preview and the export (the clips stay)."],
    ["On the timeline", ".track-id", "Track target", "Lit = cutting, inserting and closing gaps act on this track. Click to switch it on or off."],
    ["On the timeline", ".track-lock", "Lock", "Locks the track: nothing on it can be moved, cut or changed until you unlock it."],
    ["On the timeline", ".track-solo", "Solo", "Plays only this track's sound (all the others go quiet). Click again to hear them all."],
  ];
  const DELAY = 500;
  let tipEl = null, timer = 0, shownFor = null;

  function tipFor(el) {
    for (const [, sel, name, text] of TIPS) {
      try { if (el.matches(sel)) return `${name}: ${text}`; } catch { /* a selector this page doesn't have */ }
    }
    if (el.title) { el.dataset.tip = el.title; el.removeAttribute("title"); }   // no slow browser tooltip on top
    return el.dataset.tip || el.getAttribute("aria-label") || "";
  }
  function target(e) {
    const el = e.target && e.target.closest && e.target.closest(
      "[data-tip],[title],button,select,input,label,.join-btn,.fade-grip,.clip .handle,[role=button]");
    return el && !el.closest(".hover-tip") ? el : null;
  }
  function hide() {
    clearTimeout(timer);
    shownFor = null;
    if (tipEl) tipEl.classList.remove("on");
  }
  function show(el) {
    if (!el.isConnected) return;
    const text = tipFor(el);
    if (!text) return;
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "hover-tip"; tipEl.setAttribute("role", "tooltip"); document.body.appendChild(tipEl); }
    tipEl.textContent = text;
    tipEl.classList.add("on");
    const r = el.getBoundingClientRect(), pad = 8, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 6;
    if (y + h + pad > window.innerHeight) y = r.top - h - 6;
    tipEl.style.left = Math.max(pad, Math.min(x, window.innerWidth - w - pad)) + "px";
    tipEl.style.top = Math.max(pad, y) + "px";
    shownFor = el;
  }
  document.addEventListener("pointerover", (e) => {
    const el = target(e);
    if (el === shownFor) return;
    hide();
    if (!el) return;
    if (el.title) { el.dataset.tip = el.title; el.removeAttribute("title"); }
    timer = setTimeout(() => show(el), DELAY);
  }, true);
  document.addEventListener("pointerout", (e) => { const el = target(e); if (el && !el.contains(e.relatedTarget)) hide(); }, true);
  for (const ev of ["pointerdown", "keydown", "wheel", "scroll"]) document.addEventListener(ev, hide, true);

  /** The "?" window: a searchable "What every button does" list, before the keyboard shortcuts. */
  function addToHelp() {
    const keys = document.getElementById("helpKeys");
    if (!keys || keys.querySelector("[data-tips-list]")) return;
    const groups = [];
    for (const [g, , name, text] of TIPS) {
      let grp = groups.find((x) => x.g === g);
      if (!grp) groups.push(grp = { g, rows: [] });
      grp.rows.push([name, text]);
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const html = groups.map(({ g, rows }) => `<section class="keys-sec" data-tips-list><h3>Buttons: ${esc(g)}</h3><table class="keys">` +
      rows.map(([n, t]) => `<tr><td><b>${esc(n)}</b></td><td>${esc(t)}</td></tr>`).join("") + `</table></section>`).join("");
    keys.insertAdjacentHTML("afterbegin", html);
    const h2 = document.querySelector("#helpOverlay .help-head h2");
    if (h2) h2.textContent = "Help: what every button does, and keyboard shortcuts";
    const f = document.getElementById("helpFilter");
    if (f) f.placeholder = "Search - e.g. ripple, fade, snap, marker";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addToHelp); else addToHelp();

  const api = { TIPS, DELAY, tipFor };
  if (typeof module === "object" && module.exports) module.exports = api;
  else self.FableCutHoverHelp = api;
})();
