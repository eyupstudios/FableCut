/* The guard itself (Create Summat, Steve 20 Nov): the live Editor's files and port are refused, and counted. */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const net = require("net");
const path = require("path");
const guard = require("./guard.cjs");

const VE = path.join((process.env.SystemDrive || "C:") + path.sep, "VideoEditor");
const LIVE = path.join(VE, "editor");

test("the live Editor's project, media and outputs are refused", () => {
  const before = guard.violations.length;
  assert.throws(() => fs.writeFileSync(path.join(LIVE, "project.json"), "{}"), /LIVE GUARD/);
  assert.throws(() => fs.readFileSync(path.join(LIVE, "project.json")), /LIVE GUARD/);
  assert.throws(() => fs.mkdirSync(path.join(LIVE, "media", "x")), /LIVE GUARD/);
  assert.throws(() => fs.writeFileSync(path.join(VE, "outputs", "x.txt"), "x"), /LIVE GUARD/);
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "package.json")));   // its own code may be read
  assert.equal(guard.violations.length - before, 4);
  guard.violations.splice(before);                     // deliberate: not a failure of the run
});

test("the live Editor's port is refused", () => {
  const before = guard.violations.length;
  assert.throws(() => net.connect(7777, "127.0.0.1"), /LIVE GUARD/);
  assert.ok(process.env.FABLECUT_PORT && process.env.FABLECUT_PORT !== "7777");
  guard.violations.splice(before);
});

test("servers the tests start carry the guard", () => {
  assert.match(process.env.NODE_OPTIONS || "", /guard\.cjs/);
});
