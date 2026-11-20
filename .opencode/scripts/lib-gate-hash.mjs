// lib-gate-hash.mjs — shared hash of the lint-relevant (UI) files under some
// roots. qa-gate.mjs writes it into gate-status.json; precommit-gate.mjs
// recomputes it to prove the gate ran on the CURRENT tree (no stale PASS).
// Also used by qa-api.mjs / precommit-gate.mjs for the backend source hash.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const LINT_EXT = new Set([".html", ".css", ".jsx", ".tsx", ".vue", ".svelte", ".astro"]);
const SKIP_DIR = new Set(["node_modules", "dist", "build", "coverage", "graphify-out", "data"]);

// Hash the sorted (relativePath + content) of every file under `roots` whose
// extension is in `exts`, skipping dependency/build/dotted dirs. `root` is the
// base used to compute relative paths, so the hash is stable across machines.
export function hashWithExts(roots, root, exts) {
  const files = [];
  const walk = (p) => {
    let st;
    try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) {
      let ents;
      try { ents = readdirSync(p, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (e.isDirectory()) {
          if (!e.name.startsWith(".") && !SKIP_DIR.has(e.name)) walk(join(p, e.name));
        } else if (e.isFile()) {
          const d = e.name.lastIndexOf(".");
          if (d > 0 && exts.has(e.name.slice(d).toLowerCase())) files.push(join(p, e.name));
        }
      }
    } else if (st.isFile()) {
      const d = p.lastIndexOf(".");
      if (d > 0 && exts.has(p.slice(d).toLowerCase())) files.push(p);
    }
  };
  roots.forEach(walk);
  files.sort();
  const h = createHash("sha256");
  for (const f of files) {
    try { h.update(relative(root, f)); h.update("\0"); h.update(readFileSync(f)); h.update("\0"); } catch { /* skip */ }
  }
  return { hash: h.digest("hex"), files: files.length };
}

export function hashInputs(roots, root) {
  return hashWithExts(roots, root, LINT_EXT);
}
