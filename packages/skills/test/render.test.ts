// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { catalogue, notCarriedOver } from '@dcfoundation/aat-core';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, normalize } from 'node:path';

import {
  AGENTS_MD_LIMIT_TOKENS,
  AGENTS_MD_WARN_TOKENS,
  DIST,
  ERRORS_SKILL,
  PACKAGE_AGENTS_MD_LIMIT_TOKENS,
  RENDER_ROOTS,
  SKILL_NAMES,
  countSkillTokens,
  loadRenderInputs,
  orderCatalogue,
  renderPack,
  topicOf,
} from '../src/index.js';
import type { RenderedFile } from '../src/index.js';
import { repoRoot } from './sources.js';

const abs = (path: string) => join(repoRoot, path);
const io = harden({
  readText: (path: string) => readFileSync(abs(path), 'utf8'),
  list: (path: string) => (existsSync(abs(path)) ? readdirSync(abs(path)) : []),
  exists: (path: string) => existsSync(abs(path)),
  isDirectory: (path: string) => existsSync(abs(path)) && statSync(abs(path)).isDirectory(),
});
const require = createRequire(import.meta.url);
const tokenizer = {
  name: 'gpt-tokenizer',
  version: (require('gpt-tokenizer/package.json') as { version: string }).version,
  encoding: 'o200k_base',
};
const render = () => renderPack(loadRenderInputs(io, { skillNames: SKILL_NAMES, catalogue, notCarriedOver, tokenizer }));
const files = render();
const byPath = new Map(files.map(f => [f.path, f.content]));

const walk = (dir: string): string[] =>
  existsSync(abs(dir))
    ? readdirSync(abs(dir)).flatMap(name => {
        const path = `${dir}/${name}`;
        return statSync(abs(path)).isDirectory() ? walk(path) : [path];
      })
    : [];

/** Differences between a render and what is on disk under the render roots. */
const driftAgainstDisk = (rendered: readonly RenderedFile[]) => {
  const onDisk = new Set(RENDER_ROOTS.flatMap(walk));
  const drift: string[] = [];
  for (const { path, content } of rendered) {
    if (!onDisk.has(path)) drift.push(`missing ${path}`);
    else if (readFileSync(abs(path), 'utf8') !== content) drift.push(`differs ${path}`);
  }
  const renderedPaths = new Set(rendered.map(f => f.path));
  for (const path of onDisk) if (!renderedPaths.has(path)) drift.push(`stale ${path}`);
  return drift.sort();
};

test('rendering is deterministic', t => {
  t.deepEqual(render(), files);
  t.deepEqual(
    files.map(f => f.path),
    [...files.map(f => f.path)].sort(),
    'files come out sorted by path',
  );
});

test('the committed render matches a fresh render', t => {
  // Fails on a hand edit to any rendered file, a missing file, or a stale one.
  t.deepEqual(driftAgainstDisk(files), [], 'run `yarn skills:build` and commit the result');
});

test('every target is rendered for every skill', t => {
  for (const name of [...SKILL_NAMES, ERRORS_SKILL]) {
    for (const path of [
      `${DIST}/claude/${name}/SKILL.md`,
      `${DIST}/codex/.agents/skills/${name}/SKILL.md`,
      `${DIST}/codex/.agents/skills/${name}/agents/openai.yaml`,
      `${DIST}/cursor/.cursor/rules/${name}.mdc`,
      `docs/skills/${name}.md`,
    ]) {
      t.true(byPath.has(path), path);
    }
  }
  for (const path of [
    `${DIST}/agents-md/AGENTS.md`,
    `${DIST}/agents-md/contract/AGENTS.md`,
    `${DIST}/agents-md/ui/AGENTS.md`,
    `${DIST}/copilot/.github/copilot-instructions.md`,
  ]) {
    t.true(byPath.has(path), path);
  }
});

test('codex sidecars have the shape agoric-sdk uses at a2a3de9', t => {
  for (const [path, content] of byPath) {
    if (!path.endsWith('/agents/openai.yaml')) continue;
    t.regex(content, /^interface:\n {2}display_name: "[^"]+"\n {2}short_description: "[^"]+"\n$/, path);
  }
});

test('relative links in rendered skill folders resolve to rendered files', t => {
  for (const [path, content] of byPath) {
    if (!path.startsWith(DIST) || !/\.(md|mdc)$/.test(path)) continue;
    for (const m of content.matchAll(/\]\(((?:\.\.\/)*[\w@.-]+\/[^)#\s]+)\)/g)) {
      const target = normalize(join(dirname(path), m[1] ?? ''));
      t.true(byPath.has(target), `${path} links to ${m[1]}, which is not rendered`);
    }
  }
});

test('agoric-errors renders every catalogue entry, by topic, silent first', t => {
  const index = byPath.get(`${DIST}/claude/${ERRORS_SKILL}/SKILL.md`) ?? '';
  const indexed = [...index.matchAll(/^- \*\*([A-Z0-9_]+)\*\*/gm)].map(m => m[1]);
  t.deepEqual(indexed, orderCatalogue(catalogue).map(e => e.code));
  t.is(new Set(indexed).size, catalogue.length);

  const references = [...byPath]
    .filter(([p]) => p.startsWith(`${DIST}/claude/${ERRORS_SKILL}/references/`))
    .map(([, c]) => c)
    .join('\n');
  for (const entry of catalogue) {
    t.true(references.includes(`### ${entry.code}\n`), `${entry.code} has no full entry`);
    t.true(references.includes(entry.fix), `${entry.code} fix is not rendered in full`);
  }

  for (const { sharpEdge } of notCarriedOver) {
    t.true(index.includes(`- **Sharp edge ${sharpEdge}.**`), `sharp edge ${sharpEdge} is not listed as not carried over`);
  }

  // Within each topic, no silent entry follows a non-silent one.
  const ordered = orderCatalogue(catalogue);
  for (let i = 1; i < ordered.length; i += 1) {
    const [prev, cur] = [ordered[i - 1], ordered[i]];
    if (prev && cur && topicOf(prev) === topicOf(cur)) {
      t.false(prev.match.kind !== 'silent' && cur.match.kind === 'silent', `${cur.code} is silent but follows ${prev.code}`);
    }
  }
});

test('the pack AGENTS.md carries the rules from pack-rules.md', t => {
  const rules = readFileSync(abs('packages/skills/src/pack-rules.md'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter(l => l.startsWith('- '));
  const agents = byPath.get(`${DIST}/agents-md/AGENTS.md`) ?? '';
  t.is(rules.length, 11);
  for (const rule of rules) t.true(agents.includes(`${rule}\n`), rule);
  t.regex(agents, /counted with gpt-tokenizer \d+\.\d+\.\d+ \(o200k_base\)\.\n$/);
});

test('AGENTS.md and copilot instructions: warn above 1,600 tokens, fail above 2,000', t => {
  for (const path of [`${DIST}/agents-md/AGENTS.md`, `${DIST}/copilot/.github/copilot-instructions.md`]) {
    const tokens = countSkillTokens(byPath.get(path) ?? '');
    t.log(`${path}: ${tokens} tokens`);
    if (tokens > AGENTS_MD_WARN_TOKENS) t.log(`WARNING: over ${AGENTS_MD_WARN_TOKENS}`);
    t.true(tokens <= AGENTS_MD_LIMIT_TOKENS, `${path} is ${tokens} tokens`);
  }
});

test('per-package AGENTS.md files are within 500 tokens', t => {
  for (const dir of ['contract', 'ui']) {
    const path = `${DIST}/agents-md/${dir}/AGENTS.md`;
    const tokens = countSkillTokens(byPath.get(path) ?? '');
    t.log(`${path}: ${tokens} tokens`);
    t.true(tokens <= PACKAGE_AGENTS_MD_LIMIT_TOKENS, `${path} is ${tokens} tokens`);
  }
});
