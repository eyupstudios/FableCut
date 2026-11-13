"use strict";
/* No console windows on Windows: every child process (ffmpeg, ffprobe, ...) started through child_process gets
   windowsHide: true unless the caller says otherwise. Without it, a server started without a console of its own
   (e.g. by a desktop app) makes Windows open a console / Terminal window for each ffmpeg it runs.
   Required first by server.js, mcp-server.js and cli.js, before anything takes a reference to these functions. */
if (process.platform === "win32") {
  const cp = require("child_process");
  const isOpts = (v) => v && typeof v === "object" && !Array.isArray(v);
  // where the options object goes for each function: after an args array when there is one
  const wrap = (name, withArgs) => {
    const orig = cp[name];
    if (typeof orig !== "function" || orig.__winHide) return;
    const fn = function (...a) {
      let i = withArgs && Array.isArray(a[1]) ? 2 : 1;
      if (isOpts(a[i])) { if (a[i].windowsHide === undefined) a[i] = { ...a[i], windowsHide: true }; }
      else if (a[i] === undefined || typeof a[i] === "function") a.splice(i, 0, { windowsHide: true });
      return orig.apply(this, a);
    };
    fn.__winHide = true;
    cp[name] = fn;
  };
  for (const n of ["spawn", "spawnSync", "execFile", "execFileSync", "fork"]) wrap(n, true);
  for (const n of ["exec", "execSync"]) wrap(n, false);
}
