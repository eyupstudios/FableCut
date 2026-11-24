/* Transitions panel (Steve, 24 Nov): ffmpeg's built-in xfade transitions, dragged onto a join, length in seconds.
   A transition is a Cross fade join (fades.js: the clips overlap by its length) with a `style`, the xfade name, on
   the clip after: transitionIn {type: "cross", duration, style: "wipeleft"}. The fast renderer exports it with
   ffmpeg's own xfade=transition=<style>; the preview draws the same shapes from the functions below, so the two
   match (the progress runs in a straight line, as xfade's does).

   effect(style, P, role, W, H): what one picture does at progress P (0 = the join starts, 1 = it ends). role "out"
   is the clip before, "in" the clip after (drawn on top). Returns {alpha, dx, dy, scale, dip, dipColor, clip,
   pixel, blur}: clip = a shape the picture is cut to (see path()); pixel = block size in px; blur = px.
   Shared by the page (window.FableCutXfades), the panel's moving previews and the tests (require). */
"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FableCutXfades = api;
})(typeof self !== "undefined" ? self : this, function () {
  const STYLES = [
    ["fade", "Fade", "Fades"], ["dissolve", "Dissolve", "Fades"], ["fadeblack", "Through black", "Fades"],
    ["fadewhite", "Through white", "Fades"], ["hblur", "Blur", "Fades"], ["pixelize", "Pixelize", "Fades"],
    ["wipeleft", "Wipe left", "Wipes"], ["wiperight", "Wipe right", "Wipes"], ["wipeup", "Wipe up", "Wipes"],
    ["wipedown", "Wipe down", "Wipes"], ["smoothleft", "Smooth left", "Wipes"], ["smoothright", "Smooth right", "Wipes"],
    ["smoothup", "Smooth up", "Wipes"], ["smoothdown", "Smooth down", "Wipes"],
    ["slideleft", "Slide left", "Slides"], ["slideright", "Slide right", "Slides"], ["slideup", "Slide up", "Slides"],
    ["slidedown", "Slide down", "Slides"],
    ["circleopen", "Circle open", "Shapes"], ["circleclose", "Circle close", "Shapes"], ["radial", "Radial", "Shapes"],
    ["vertopen", "Open from the middle", "Shapes"], ["horzopen", "Open across", "Shapes"], ["zoomin", "Zoom in", "Shapes"],
  ];
  const IDS = STYLES.map((s) => s[0]);
  const SOFT = 0.15;                                  // a smooth wipe's soft edge, part of the frame
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const label = (id) => (STYLES.find((s) => s[0] === id) || [id, id])[1];

  function effect(style, P, role, W, H) {
    P = clamp01(+P || 0);
    const e = { alpha: 1, dx: 0, dy: 0, scale: 1, dip: 0, dipColor: "#000000", clip: null, pixel: 0, blur: 0 };
    const inn = role === "in";
    switch (style) {
      case "fade": if (inn) e.alpha = P; break;
      case "dissolve": if (inn) e.clip = { kind: "dissolve", k: P }; break;
      case "fadeblack": case "fadewhite": {          // ffmpeg's own weights (vf_xfade.c, phase 0.2; p = 1 - P)
        e.dipColor = style === "fadewhite" ? "#ffffff" : "#000000";
        const p = 1 - P, wA = p * smooth(0.8, 1, p), wB = (1 - p) * (1 - smooth(0.2, 1, p));
        if (inn) { e.alpha = wA > 0.02 ? 0 : 1; e.dip = 1 - wB; } else e.dip = 1 - wA;
        break;
      }
      case "hblur": e.blur = 2 * Math.min(P, 1 - P) * W / 48; if (inn) e.alpha = P; break;
      case "pixelize": e.pixel = Math.max(1, Math.round(2 * Math.min(P, 1 - P) * Math.min(W, H) / 20)); if (inn) e.alpha = P; break;
      case "wipeleft": if (inn) e.clip = { kind: "rect", x: W * (1 - P), y: 0, w: W * P, h: H }; break;
      case "wiperight": if (inn) e.clip = { kind: "rect", x: 0, y: 0, w: W * P, h: H }; break;
      case "wipeup": if (inn) e.clip = { kind: "rect", x: 0, y: H * (1 - P), w: W, h: H * P }; break;
      case "wipedown": if (inn) e.clip = { kind: "rect", x: 0, y: 0, w: W, h: H * P }; break;
      case "smoothleft": case "smoothright": case "smoothup": case "smoothdown":
        if (inn) e.clip = { kind: "soft", dir: style.slice(6), k: P }; break;
      case "slideleft": e.dx = inn ? W * (1 - P) : -W * P; break;
      case "slideright": e.dx = inn ? -W * (1 - P) : W * P; break;
      case "slideup": e.dy = inn ? H * (1 - P) : -H * P; break;
      case "slidedown": e.dy = inn ? -H * (1 - P) : H * P; break;
      case "circleopen": if (inn) e.clip = { kind: "circle", r: P * Math.hypot(W, H) / 2 }; break;
      case "circleclose": if (inn) e.clip = { kind: "notcircle", r: (1 - P) * Math.hypot(W, H) / 2 }; break;
      case "radial": if (inn) e.clip = { kind: "wedge", a: P * Math.PI * 2 }; break;
      case "vertopen": if (inn) e.clip = { kind: "rect", x: W * (1 - P) / 2, y: 0, w: W * P, h: H }; break;
      case "horzopen": if (inn) e.clip = { kind: "rect", x: 0, y: H * (1 - P) / 2, w: W, h: H * P }; break;
      case "zoomin":                                  // the picture before zooms in (ffmpeg: 1 / zf), then the next fades up
        if (inn) e.alpha = smooth(0.5, 1, P); else e.scale = 1 / Math.max(0.12, 1 - smooth(0, 0.5, P));
        break;
      default: if (inn) e.alpha = P;
    }
    return e;
  }

  /** The soft edge of a smooth wipe as bands: [{x, y, w, h, alpha}] covering the picture shown (alpha 0..1). */
  function softBands(dir, k, W, H, n = 6) {
    const horiz = dir === "left" || dir === "right", L = horiz ? W : H;
    const edge = (1 + SOFT) * k * L - SOFT * L;      // where the solid part ends, from the side it comes in from
    const out = [];
    const span = (a, b) => { a = Math.max(0, a); b = Math.min(L, b); return b > a ? [a, b] : null; };
    const put = (s, alpha) => { if (!s) return; const [a, b] = s;
      const from = dir === "left" || dir === "up" ? L - b : a;          // "left": it comes in from the right side
      out.push(horiz ? { x: from, y: 0, w: b - a, h: H, alpha } : { x: 0, y: from, w: W, h: b - a, alpha }); };
    put(span(0, edge), 1);
    for (let i = 0; i < n; i++) put(span(edge + (i / n) * SOFT * L, edge + ((i + 1) / n) * SOFT * L), 1 - (i + 0.5) / n);
    return out;
  }

  /** Hash noise 0..1 for (x, y) - the same pattern every frame, so a dissolve grows rather than flickers. */
  const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

  /** Cut the canvas to `clip` (canvas 2D context). Soft clips are drawn as bands by the caller. */
  function path(ctx, clip, W, H) {
    ctx.beginPath();
    if (clip.kind === "rect") ctx.rect(clip.x, clip.y, clip.w, clip.h);
    else if (clip.kind === "circle") ctx.arc(W / 2, H / 2, Math.max(0.01, clip.r), 0, Math.PI * 2);
    else if (clip.kind === "notcircle") { ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0.01, clip.r), 0, Math.PI * 2, true); }
    else if (clip.kind === "wedge") {
      const R = Math.hypot(W, H);
      ctx.moveTo(W / 2, H / 2);
      ctx.arc(W / 2, H / 2, R, -Math.PI / 2, -Math.PI / 2 + clip.a);
      ctx.closePath();
    } else if (clip.kind === "dissolve") {
      const B = Math.max(2, Math.round(Math.min(W, H) / 180));         // ~3 px blocks at 540p: grain, as xfade's
      for (let y = 0; y < H; y += B) for (let x = 0; x < W; x += B) if (noise(x / B, y / B) < clip.k) ctx.rect(x, y, B, B);
    }
    ctx.clip(clip.kind === "notcircle" ? "evenodd" : "nonzero");
  }

  /** Draw one frame of a transition between pictures a and b (any drawImage source) into ctx (W x H): the panel's
   *  moving previews. The editor's compositor does the same per clip. */
  function drawPair(ctx, a, b, style, P, W, H) {
    ctx.save();
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    for (const [img, role] of [[a, "out"], [b, "in"]]) {
      const e = effect(style, P, role, W, H);
      const draw = (alpha) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (e.blur > 0.3) ctx.filter = `blur(${e.blur.toFixed(1)}px)`;
        ctx.translate(W / 2 + e.dx, H / 2 + e.dy); ctx.scale(e.scale, e.scale);
        if (e.pixel > 1) {
          const tw = Math.max(1, Math.round(W / e.pixel)), th = Math.max(1, Math.round(H / e.pixel));
          const t = drawPair._tmp || (drawPair._tmp = (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(tw, th) : document.createElement("canvas")));
          t.width = tw; t.height = th; t.getContext("2d").drawImage(img, 0, 0, tw, th);
          ctx.imageSmoothingEnabled = false; ctx.drawImage(t, -W / 2, -H / 2, W, H);
        } else ctx.drawImage(img, -W / 2, -H / 2, W, H);
        ctx.restore();
        if (e.dip > 0) { ctx.save(); ctx.globalAlpha = alpha * e.dip; ctx.fillStyle = e.dipColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      };
      if (e.alpha <= 0) continue;
      if (e.clip && e.clip.kind === "soft") {
        for (const band of softBands(e.clip.dir, e.clip.k, W, H)) {
          ctx.save(); ctx.beginPath(); ctx.rect(band.x, band.y, band.w, band.h); ctx.clip(); draw(e.alpha * band.alpha); ctx.restore();
        }
      } else if (e.clip) { ctx.save(); path(ctx, e.clip, W, H); draw(e.alpha); ctx.restore(); }
      else draw(e.alpha);
    }
    ctx.restore();
  }

  return { STYLES, IDS, SOFT, label, effect, softBands, noise, path, drawPair };
});
