import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture fitness tests: module boundaries are enforced by CI, not by convention.
 *  - platform/ never imports app/ or modules/ (it's the foundation every squad builds on)
 *  - a module imports another module only through its public entries: index.js or domain.js
 *  - domain.js entries stay pure (no React, no Firebase), so logic is testable and reusable anywhere
 *  - no import cycles between modules
 */
const SRC = path.dirname(new URL(import.meta.url).pathname);
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? files(path.join(dir, d.name)) : /\.(jsx?)$/.test(d.name) && !/\.test\./.test(d.name) ? [path.join(dir, d.name)] : []);
const importsOf = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
const moduleOf = (f) => rel(f).match(/^modules\/([^/]+)\//)?.[1];
const resolve = (from, spec) => (spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null);

const all = files(SRC);

describe('architecture', () => {
  it('platform depends on nothing above it', () => {
    const bad = all.filter((f) => rel(f).startsWith('platform/')).flatMap((f) =>
      importsOf(f).map((s) => resolve(f, s)).filter(Boolean).map(rel).filter((t) => t.startsWith('app/') || t.startsWith('modules/')).map((t) => `${rel(f)} -> ${t}`));
    expect(bad).toEqual([]);
  });

  it('modules talk to each other only through index.js / domain.js', () => {
    const bad = [];
    for (const f of all) {
      const own = moduleOf(f);
      if (!own) continue;
      for (const spec of importsOf(f)) {
        const target = resolve(f, spec);
        if (!target) continue;
        const other = moduleOf(target);
        if (other && other !== own && !/^modules\/[^/]+\/(index|domain)\.js$/.test(rel(target))) bad.push(`${rel(f)} -> ${rel(target)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('domain entries are pure', () => {
    const impure = [];
    const visit = (f, seen) => {
      if (seen.has(f)) return;
      seen.add(f);
      for (const spec of importsOf(f)) {
        if (/^(react|react-dom|react-redux|firebase|@reduxjs)/.test(spec)) impure.push(`${rel(f)} imports ${spec}`);
        const t = resolve(f, spec);
        if (t && fs.existsSync(t)) visit(t, seen);
      }
    };
    all.filter((f) => /^modules\/[^/]+\/domain\.js$/.test(rel(f))).forEach((f) => visit(f, new Set()));
    expect(impure).toEqual([]);
  });

  it('module dependency graph has no cycles', () => {
    const graph = new Map();
    for (const f of all) {
      const own = moduleOf(f);
      if (!own) continue;
      for (const spec of importsOf(f)) {
        const other = moduleOf(resolve(f, spec) ?? '');
        if (other && other !== own) graph.set(own, new Set([...(graph.get(own) ?? []), other]));
      }
    }
    const cycle = [];
    const state = new Map();
    const dfs = (n, trail) => {
      if (state.get(n) === 1) return cycle.push([...trail, n].join(' -> '));
      if (state.get(n) === 2) return undefined;
      state.set(n, 1);
      (graph.get(n) ?? []).forEach((m) => dfs(m, [...trail, n]));
      state.set(n, 2);
      return undefined;
    };
    [...graph.keys()].forEach((n) => dfs(n, []));
    expect(cycle).toEqual([]);
  });
});
