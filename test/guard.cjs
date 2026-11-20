/* Steve's standing rule (Create Summat, 20 Nov 2026): tests NEVER touch his real app, Editor, projects or files -
   their own ports, profiles and folders only, and the run FAILS if one tries.

   Loaded before every test file (`npm test` runs `node --test --require ./test/guard.cjs`; test/helpers.js also
   requires it) and, through NODE_OPTIONS, in every server / MCP process a test starts:
   - files: writing (or reading) under his real folders - the live Editor data (C:\VideoEditor\editor: project.json,
     projects, media, exports; the editor's own code may be read), outputs, Twitch recordings, the app's settings -
     throws and is recorded;
   - ports: connecting to the live Editor (7777, or CS_LIVE_PORTS) throws and is recorded;
   - any recorded attempt makes the process exit with code 1, so its test file fails even when the error was caught. */
"use strict";
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

if (!global.__csLiveGuard) {
  global.__csLiveGuard = true;
  const VE = (process.env.SystemDrive || "C:") + "\\VideoEditor";
  const APPDATA = process.env.CS_REAL_APPDATA || process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const LOCAL = process.env.CS_REAL_LOCALAPPDATA || process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  process.env.CS_REAL_APPDATA = APPDATA;
  process.env.CS_REAL_LOCALAPPDATA = LOCAL;
  const norm = (p) => path.resolve(String(p)).toLowerCase();
  const PROTECTED = [path.join(VE, "editor"), path.join(VE, "outputs"), path.join(VE, "twitch"),
    path.join(VE, "auto-video-editor-master"), path.join(APPDATA, "auto-video-editor"),
    path.join(LOCAL, "auto-video-editor")].map(norm);
  const READ_OK = [path.join(VE, "editor", "FableCut")].map(norm);   // the editor's own code (these tests' home)
  const LIVE_PORTS = new Set((process.env.CS_LIVE_PORTS || "7777").split(",").map((x) => +x).filter(Boolean));
  const inside = (s, roots) => roots.some((r) => s === r || s.startsWith(r + path.sep));
  const hit = (p, write) => {
    if (p == null || typeof p === "number") return false;
    let s;
    try { s = norm(p instanceof URL ? p.pathname.replace(/^\/([A-Za-z]:)/, "$1") : Buffer.isBuffer(p) ? p.toString() : p); }
    catch { return false; }
    if (!inside(s, PROTECTED)) return false;
    return write || !inside(s, READ_OK);
  };
  const violations = [];
  const refuse = (what, target) => {
    const msg = `LIVE GUARD (Steve's rule: tests never touch the real app / Editor / files): ${what} ${target}`;
    violations.push(msg + "\n" + new Error().stack.split("\n").slice(2, 8).join("\n"));
    const e = new Error(msg); e.code = "EACCES"; throw e;
  };
  const isWriteFlag = (f) => typeof f === "string" ? /[wa+]/.test(f) : typeof f === "number" &&
    !!(f & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND));

  const WRITE1 = ["writeFile", "appendFile", "mkdir", "rm", "rmdir", "unlink", "truncate", "utimes", "mkdtemp",
    "createWriteStream", "writeFileSync", "appendFileSync", "mkdirSync", "rmSync", "rmdirSync", "unlinkSync",
    "truncateSync", "utimesSync", "mkdtempSync"];
  const WRITE2 = ["rename", "renameSync", "link", "linkSync", "symlink", "symlinkSync", "copyFile", "copyFileSync",
    "cp", "cpSync"];
  const READ1 = ["readFile", "readFileSync", "readdir", "readdirSync", "createReadStream", "stat", "statSync",
    "lstat", "lstatSync", "access", "accessSync", "existsSync", "watch"];
  const wrap = (obj, name, check) => {
    const real = obj[name];
    if (typeof real !== "function") return;
    obj[name] = function (...a) { check(a); return real.apply(this, a); };
  };
  for (const target of [fs, fs.promises]) {
    for (const n of WRITE1) wrap(target, n, (a) => { if (hit(a[0], true)) refuse(`fs.${n}`, a[0]); });
    for (const n of WRITE2) wrap(target, n, (a) => {
      if (hit(a[0], n.startsWith("copy") || n.startsWith("cp") ? false : true)) refuse(`fs.${n} from`, a[0]);
      if (hit(a[1], true)) refuse(`fs.${n} to`, a[1]);
    });
    for (const n of READ1) wrap(target, n, (a) => { if (hit(a[0], false)) refuse(`fs.${n}`, a[0]); });
    for (const n of ["open", "openSync"]) wrap(target, n, (a) => { if (hit(a[0], isWriteFlag(a[1]))) refuse(`fs.${n}`, a[0]); });
  }
  // ports: never the live Editor
  const realConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...a) {
    const o = a[0];
    const port = Array.isArray(o) ? +(o[0] && o[0].port) : typeof o === "object" && o ? +o.port : +o;
    const host = String((typeof o === "object" && o && !Array.isArray(o) ? o.host : a[1]) || "localhost").toLowerCase();
    if (LIVE_PORTS.has(port) && ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host)) {
      violations.push(`connect to the live Editor on port ${port}\n` + new Error().stack.split("\n").slice(2, 8).join("\n"));
      const e = new Error(`LIVE GUARD: tests never connect to the live Editor (port ${port})`); e.code = "ECONNREFUSED";
      throw e;
    }
    return realConnect.apply(this, a);
  };
  // servers and MCP processes the tests start carry the guard too
  const me = __filename.includes(" ") ? `"${__filename}"` : __filename;
  if (!(process.env.NODE_OPTIONS || "").includes("guard.cjs"))
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ""} --require ${me}`.trim();
  // a test server may not default to the real Editor port either
  if (!process.env.FABLECUT_PORT) process.env.FABLECUT_PORT = "7999";
  process.on("exit", () => {
    if (!violations.length) return;
    process.exitCode = 1;
    process.stderr.write(`\nLIVE GUARD - this test run tried to touch Steve's real app / Editor / files (${violations.length}):\n`
      + violations.slice(0, 10).join("\n\n") + "\n");
  });
  module.exports = { violations, hit };
} else {
  module.exports = {};
}
