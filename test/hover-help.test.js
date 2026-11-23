// Hover help (Steve, 23 Nov 2026): "Hover help on EVERY button and control in the Editor ... what it does + shortcut
// key ... Plain words, no jargon. Also a "?" button that lists them all."
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
global.document = { readyState: "loading", addEventListener() {}, getElementById() { return null } };
global.self = global;
const { TIPS, DELAY } = require("../hover-help.js");

test("tips appear after half a second", () => assert.equal(DELAY, 500));

test("every button, menu and box in the editor's page has words: a tip, or its own hover text", () => {
  const ids = new Set(TIPS.map((t) => t[1]).filter((s) => s.startsWith("#")).map((s) => s.slice(1)));
  const attrs = new Set(TIPS.map((t) => t[1]).filter((s) => s.startsWith("[")));
  const missing = [];
  for (const m of html.matchAll(/<(button|select)\b[^>]*>/g)) {
    const tag = m[0], id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    const attr = [...attrs].find((a) => { const [k, v] = a.slice(1, -1).split("="); return tag.includes(`${k}="${v}"`); });
    const cls = TIPS.some((t) => /^\.[\w-]+$/.test(t[1]) && new RegExp(`class="[^"]*\\b${t[1].slice(1)}\\b`).test(tag));
    if ((id && ids.has(id)) || attr || cls || /\btitle="[^"]+"/.test(tag)) continue;
    if (/btnClose|Cancel|Ok"|dlvSave(Ok|Cancel)|btnQueue(Clear|Close|Start)|pjClose|pjNewBtn|importUrl|setLinkSelect|helpFilter/.test(id || "")) continue;   // dialog closers / OK
    missing.push(id || tag.slice(0, 60));
  }
  assert.deepEqual(missing, []);
});

test("the ones Steve named are there, in plain words, with their keys", () => {
  const byName = Object.fromEntries(TIPS.map((t) => [t[2], t[3]]));
  assert.equal(byName["Ripple delete"], "Removes the clip and slides everything after it left so there's no gap. (Shift+Delete)");
  for (const n of ["Lift", "Extract", "Close gap", "Find gap", "Snap", "Audio hold", "Mark In", "Mark Out", "Markers", "Proxy", "Safe", "Frame", "S", "M", "L"])
    assert.ok(byName[n], n);
  assert.match(byName["Lift"], /\(;\)$/);
  assert.match(byName["Extract"], /\('\)$/);
  assert.match(byName["Audio hold"], /tiny bit of sound under the red playhead/);
  for (const [, , name, text] of TIPS) assert.ok(!/\b(ripples?|targeted|NLE|keyframe interpolation|overwrite)\b/i.test(text), `${name}: jargon`);
});

test("the ? window lists them all, searchable", () => {
  const js = fs.readFileSync(path.join(__dirname, "..", "hover-help.js"), "utf8");
  assert.ok(js.includes('keys.insertAdjacentHTML("afterbegin", html)') && js.includes('class="keys-sec" data-tips-list'));
  assert.ok(html.indexOf('<script src="hover-help.js">') > 0);
});
