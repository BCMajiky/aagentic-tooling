#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * Render the skill pack, or check that the committed render is current.
 *
 *   yarn skills:build   write every target (RELEASE1-BRIEF.md D2)
 *   yarn skills:check   exit 1 if any rendered file differs, is missing or is stale
 *
 * The render itself is `renderPack` in src/render.ts, which is pure. This
 * entrypoint holds the ambient authority: it reads the sources, writes the
 * output, and checks the token budgets (D2, D3) on what it rendered.
 */
import '@endo/init/debug.js';

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogue } from '@dcfoundation/aat-core';
import {
  AGENTS_MD_LIMIT_TOKENS,
  AGENTS_MD_WARN_TOKENS,
  PACKAGE_AGENTS_MD_LIMIT_TOKENS,
  RENDER_ROOTS,
  SKILL_BODY_LIMIT_TOKENS,
  SKILL_BODY_TARGET_TOKENS,
  SKILL_NAMES,
  countSkillTokens,
  loadRenderInputs,
  parseSkillFile,
  renderPack,
} from '../dist/src/index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const check = process.argv.includes('--check');
const abs = path => join(repoRoot, path);

const io = harden({
  readText: path => readFileSync(abs(path), 'utf8'),
  list: path => (existsSync(abs(path)) ? readdirSync(abs(path)) : []),
  exists: path => existsSync(abs(path)),
  isDirectory: path => existsSync(abs(path)) && statSync(abs(path)).isDirectory(),
});

const require = createRequire(import.meta.url);
const { version: tokenizerVersion } = require('gpt-tokenizer/package.json');

const files = renderPack(
  loadRenderInputs(io, {
    skillNames: SKILL_NAMES,
    catalogue,
    tokenizer: { name: 'gpt-tokenizer', version: tokenizerVersion, encoding: 'o200k_base' },
  }),
);

// --- token budgets on the rendered output ----------------------------------
let failed = 0;
const report = [];
for (const { path, content } of files) {
  let limit;
  let warn;
  let body = content;
  if (path.endsWith('/agents-md/AGENTS.md') || path.endsWith('/copilot-instructions.md')) {
    [limit, warn] = [AGENTS_MD_LIMIT_TOKENS, AGENTS_MD_WARN_TOKENS];
  } else if (/\/agents-md\/(contract|ui)\/AGENTS\.md$/.test(path)) {
    [limit, warn] = [PACKAGE_AGENTS_MD_LIMIT_TOKENS, PACKAGE_AGENTS_MD_LIMIT_TOKENS];
  } else if (path.includes('/dist/claude/') && path.endsWith('/SKILL.md')) {
    const parsed = parseSkillFile(content.replace(/^---\n/, '---\ndisplay-name: x\nshort-description: x\nwhen: x\n'));
    body = typeof parsed === 'string' ? content : parsed.body;
    [limit, warn] = [SKILL_BODY_LIMIT_TOKENS, SKILL_BODY_TARGET_TOKENS];
  } else {
    continue;
  }
  const tokens = countSkillTokens(body);
  let verdict = 'ok';
  if (tokens > limit) verdict = 'FAIL';
  else if (tokens > warn) verdict = 'warn';
  if (verdict === 'FAIL') failed += 1;
  report.push(`  ${verdict.padEnd(4)} ${String(tokens).padStart(5)} / ${limit}  ${path}`);
}

// --- write or check ----------------------------------------------------------
const walk = dir =>
  existsSync(abs(dir))
    ? readdirSync(abs(dir)).flatMap(name => {
        const path = `${dir}/${name}`;
        return statSync(abs(path)).isDirectory() ? walk(path) : [path];
      })
    : [];
const onDisk = new Set(RENDER_ROOTS.flatMap(walk));
const rendered = new Set(files.map(f => f.path));

const drift = [];
for (const { path, content } of files) {
  if (!onDisk.has(path)) drift.push(`missing  ${path}`);
  else if (readFileSync(abs(path), 'utf8') !== content) drift.push(`differs  ${path}`);
}
for (const path of [...onDisk].sort()) {
  if (!rendered.has(path)) drift.push(`stale    ${path}`);
}

process.stdout.write(`Token budgets:\n${report.join('\n')}\n`);

if (check) {
  if (drift.length > 0) {
    process.stderr.write(
      `The rendered skill pack is out of date (${drift.length}):\n${drift.map(d => `  ${d}`).join('\n')}\nRun \`yarn skills:build\` and commit the result.\n`,
    );
    failed += 1;
  } else {
    process.stdout.write(`Rendered skill pack is current: ${files.length} files.\n`);
  }
} else {
  for (const path of [...onDisk]) if (!rendered.has(path)) rmSync(abs(path));
  for (const { path, content } of files) {
    mkdirSync(dirname(abs(path)), { recursive: true });
    writeFileSync(abs(path), content);
  }
  process.stdout.write(`Rendered ${files.length} files (${drift.length} changed).\n`);
}

if (failed > 0) process.stderr.write(`${failed} check(s) failed.\n`);
process.exitCode = failed > 0 ? 1 : 0;

