/* Project tabs (23 Nov, Steve): "Add project tabs along the top of the Editor (like browser tabs), current one
   highlighted." Real clicks are checked in a sandbox Editor (speed-test/night_23nov/tabs_check.py). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const js = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const src = js.slice(js.indexOf('const TABS_KEY = "fablecut-project-tabs";'), js.indexOf("setInterval(syncProjectTabs, 1000);"));

test("a strip of tabs in the top bar, after the undo arrows", () => {
  const nav = html.indexOf('<nav class="pj-tabs" id="pjTabs" role="tablist" aria-label="Open projects"></nav>');
  assert.ok(nav > html.indexOf('id="btnRedo"') && nav < html.indexOf('id="projectName"'));
  assert.ok(css.includes(".pj-tab.on {") && css.includes("overflow-x: auto"));
  assert.ok(js.includes("setInterval(syncProjectTabs, 1000);"));
});

test("the open project gets a tab and is highlighted; other tabs switch; x closes the tab only", async () => {
  const store = {};
  const nav = { innerHTML: "", querySelector: () => null };
  const env = {
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    $: (id) => (id === "pjTabs" ? nav : null),
    document: { body: { classList: { toggle() {} } } },
    escapeHtml: (s) => String(s), toast() {}, pj: {}, pjOpenProject() {},
    fetch: async () => ({ json: async () => ({ projects: [{ id: "a", name: "GTA 6 · 20 Nov stream" }, { id: "b", name: "Part 4" }] }) }),
    state: { connected: true }, runtime: { projectId: "a" }, project: { name: "GTA 6 · 20 Nov stream" }, Date,
  };
  const names = Object.keys(env);
  const f = new Function(...names, src.replace('$("pjTabs")?.addEventListener', "void 0 && $(\"pjTabs\")?.addEventListener")
    + "; return { syncProjectTabs, tabIds, renderProjectTabs };")(...names.map((k) => env[k]));
  await f.syncProjectTabs();
  assert.deepEqual(f.tabIds(), ["a"]);
  env.runtime.projectId = "b"; env.project.name = "Part 4";
  await f.syncProjectTabs();
  assert.deepEqual(f.tabIds(), ["a", "b"]);
  assert.ok(/class="pj-tab on" data-tab="b"/.test(nav.innerHTML) && /data-tab="a"[^>]*>.*GTA 6 · 20 Nov stream/.test(nav.innerHTML));
  assert.ok(nav.innerHTML.includes('data-tabx="a"') && !nav.innerHTML.includes('data-tabx="b"'));   // no x on the open one
});
