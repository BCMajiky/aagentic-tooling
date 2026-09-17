#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * Build the documentation site into `docs/_site/`.
 *
 * Deliberately small: `marked` plus one HTML shell, no framework. The site is
 * a handful of specs that need to be readable and linkable, and a docs toolchain
 * that needs its own upgrades is a liability in a repository whose whole point
 * is pinning things.
 *
 * **The page list below is explicit, never a glob.** `docs/context/` holds
 * internal planning material, and a glob over `docs/` would publish it the
 * first time somebody added a file. Adding a page here is a deliberate act.
 * See `docs/BEFORE-PUBLIC.md`.
 */
import { marked } from 'marked';

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(repoRoot, 'docs', '_site');

/** source path, output path, nav title. Order is the nav order. */
const PAGES = [
  { src: 'README.md', out: 'index.html', title: 'Overview' },
  { src: 'docs/formats/trace-event.v0.md', out: 'formats/trace-event.v0.html', title: 'Format A: trace events' },
  { src: 'docs/formats/contract-manifest.v0.md', out: 'formats/contract-manifest.v0.html', title: 'Format B: contract manifests' },
  { src: 'AGENTS.md', out: 'agents.html', title: 'Agent instructions' },
  { src: 'CONTRIBUTING.md', out: 'contributing.html', title: 'Contributing' },
  { src: 'docs/PINS.md', out: 'pins.html', title: 'Pins' },
  { src: 'SECURITY.md', out: 'security.html', title: 'Security' },
  // The rendered skill pack (packages/skills, `yarn skills:build`). Listed one
  // by one like everything else: a new skill is a new line here.
  { src: 'docs/skills/index.md', out: 'skills/index.html', title: 'Skill pack' },
  { src: 'docs/skills/agoric-hardened-js.md', out: 'skills/agoric-hardened-js.html', title: 'Skill: hardened JS' },
  { src: 'docs/skills/agoric-zoe-contract.md', out: 'skills/agoric-zoe-contract.html', title: 'Skill: Zoe contract' },
  { src: 'docs/skills/agoric-durable-state.md', out: 'skills/agoric-durable-state.html', title: 'Skill: durable state' },
  { src: 'docs/skills/agoric-orchestration.md', out: 'skills/agoric-orchestration.html', title: 'Skill: orchestration' },
  { src: 'docs/skills/agoric-testing.md', out: 'skills/agoric-testing.html', title: 'Skill: testing' },
  { src: 'docs/skills/agoric-deploy.md', out: 'skills/agoric-deploy.html', title: 'Skill: deploy' },
  { src: 'docs/skills/agoric-errors.md', out: 'skills/agoric-errors.html', title: 'Skill: errors' },
];

const escape = text =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dirOf = path => path.split('/').slice(0, -1).join('/');
const baseOf = path => path.split('/').at(-1);

/** Rewrite in-repo links so they work between built pages. */
const rewriteLinks = (html, depth, current) => {
  const up = '../'.repeat(depth);
  let out = html;
  for (const page of PAGES) {
    const target = `${up}${page.out}`;
    // Links as written in the markdown, relative to the source file.
    for (const form of [page.src, `/${page.src}`, `../../${page.src}`, `../${page.src}`]) {
      out = out.split(`href="${form}"`).join(`href="${target}"`);
    }
    // A bare file name between pages in the same source directory, as the
    // rendered docs/skills/index.md writes them.
    if (dirOf(page.src) === dirOf(current.src) && dirOf(page.out) === dirOf(current.out)) {
      out = out.split(`href="${baseOf(page.src)}"`).join(`href="${baseOf(page.out)}"`);
    }
  }
  return out;
};

const shell = ({ title, body, depth }) => {
  const up = '../'.repeat(depth);
  const nav = PAGES.map(
    page => `<li><a href="${up}${page.out}">${escape(page.title)}</a></li>`,
  ).join('\n        ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — aagentic-tooling</title>
<style>
  :root { color-scheme: light dark; --fg: #16191d; --bg: #fdfdfc; --muted: #5b6470; --rule: #dcdfe4; --accent: #1f5fa8; --code-bg: #f2f3f5; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e6e8ea; --bg: #16181b; --muted: #9aa3ad; --rule: #2c3238; --accent: #7fb2ef; --code-bg: #1f2429; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; display: flex; gap: 40px; align-items: flex-start; }
  nav { position: sticky; top: 0; flex: 0 0 210px; padding: 32px 0; }
  nav strong { display: block; font-size: 15px; margin-bottom: 12px; }
  nav ul { list-style: none; margin: 0; padding: 0; }
  nav li { margin: 0 0 6px; }
  nav a { color: var(--muted); text-decoration: none; font-size: 14px; }
  nav a:hover { color: var(--accent); }
  main { flex: 1 1 auto; min-width: 0; padding: 32px 0 80px; }
  h1, h2, h3 { line-height: 1.25; }
  h1 { font-size: 30px; margin-top: 0; }
  h2 { font-size: 21px; margin-top: 2.2em; border-bottom: 1px solid var(--rule); padding-bottom: 6px; }
  h3 { font-size: 17px; margin-top: 1.8em; }
  a { color: var(--accent); }
  code { background: var(--code-bg); padding: 1px 5px; border-radius: 3px;
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { background: var(--code-bg); padding: 14px 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1.2em 0; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--rule); padding: 7px 10px; text-align: left; font-size: 14px; vertical-align: top; }
  th { background: var(--code-bg); }
  blockquote { margin: 1.2em 0; padding: 2px 16px; border-left: 3px solid var(--rule); color: var(--muted); }
  footer { border-top: 1px solid var(--rule); margin-top: 60px; padding-top: 16px; color: var(--muted); font-size: 13px; }
  @media (max-width: 760px) { .wrap { flex-direction: column; gap: 0; } nav { position: static; padding: 24px 0 0; } }
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <strong>aagentic-tooling</strong>
    <ul>
        ${nav}
    </ul>
  </nav>
  <main>
${body}
    <footer>Apache-2.0. No telemetry.</footer>
  </main>
</div>
</body>
</html>
`;
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const page of PAGES) {
  const markdown = readFileSync(join(repoRoot, page.src), 'utf8');
  const depth = page.out.split('/').length - 1;
  const body = rewriteLinks(marked.parse(markdown, { async: false }), depth, page);
  const target = join(outDir, page.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, shell({ title: page.title, body, depth }));
  process.stdout.write(`  ${page.src} -> docs/_site/${page.out}\n`);
}

// The schemas are the normative artifacts. Publish them next to the specs so a
// $id URL resolves to something real.
mkdirSync(join(outDir, 'schemas'), { recursive: true });
for (const name of ['trace-event.v0.schema.json', 'contract-manifest.v0.schema.json']) {
  writeFileSync(
    join(outDir, 'schemas', name),
    readFileSync(join(repoRoot, 'packages/schemas/schemas', name), 'utf8'),
  );
  process.stdout.write(`  packages/schemas/schemas/${name} -> docs/_site/schemas/${name}\n`);
}

// Tell GitHub Pages not to run the output through Jekyll.
writeFileSync(join(outDir, '.nojekyll'), '');

process.stdout.write(`\nBuilt ${PAGES.length} pages into docs/_site.\n`);
