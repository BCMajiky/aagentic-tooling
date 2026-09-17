#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * Create a baseline workspace for an agent run (RELEASE1-BRIEF.md D1, D4).
 *
 *   yarn baseline:workspace <name> [--with-pack] [--dir <parent>] [--json]
 *
 * Makes `<parent>/<name>/` (default parent ~/Desktop/Agoric-L1/baseline) as
 * the day 1 baseline workspaces were made, recorded in
 * docs/notes/baseline-2026-09/README.md, "Workspaces": `git init` on `main`
 * and one commit by `baseline-setup` holding a `package.json` with the
 * agoric-upgrade-23 pins from docs/PINS.md, ava, @endo/ses-ava and
 * @endo/bundle-source as devDependencies, and the root `resolutions` block.
 * Nothing else: no .yarnrc.yml, no ava config, no instructions file.
 *
 * `--with-pack` adds `.claude/skills/` holding the rendered Claude Code pack
 * from packages/skills/dist/claude/, in the same setup commit, so an agent's
 * diff shows only its own work.
 *
 * Exit codes: 0 created, 2 usage error, 3 environment error (the workspace
 * already exists, git failed, the pack is not rendered).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const json = args.includes('--json');

const finish = (code, message, data = undefined) => {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: code === 0, code, ...(data ? { data } : {}), ...(code ? { hint: message } : {}) })}\n`);
  } else {
    (code === 0 ? process.stdout : process.stderr).write(`${message}\n`);
  }
  process.exit(code);
};

// --- arguments -------------------------------------------------------------
const positional = [];
let parent = join(homedir(), 'Desktop/Agoric-L1/baseline');
let withPack = false;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--json') continue;
  if (arg === '--with-pack') withPack = true;
  else if (arg === '--dir') {
    if (args[i + 1] === undefined) finish(2, '--dir needs a directory');
    parent = resolve(args[i + 1]);
    i += 1;
  } else if (arg.startsWith('--')) finish(2, `unknown flag ${arg}; usage: yarn baseline:workspace <name> [--with-pack] [--dir <parent>] [--json]`);
  else positional.push(arg);
}
if (positional.length !== 1 || !/^[a-z0-9][a-z0-9-]*$/.test(positional[0])) {
  finish(2, 'usage: yarn baseline:workspace <name> [--with-pack] [--dir <parent>] [--json]; name is lower-case letters, digits and hyphens');
}
const name = positional[0];
const workspace = join(parent, name);
if (existsSync(workspace)) finish(3, `${workspace} already exists; a baseline workspace starts empty, so pick a new name or remove it yourself`);

// --- package.json, from the repository's own records ----------------------
const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const pinsSection = readFileSync(join(repoRoot, 'docs/PINS.md'), 'utf8').split('## Agoric SDK packages')[1]?.split('\n## ')[0] ?? '';
const pins = Object.fromEntries(
  [...pinsSection.matchAll(/^\| `(@agoric\/[\w-]+)` \| `([^`]+)` \|$/gm)].map(m => [m[1], m[2]]).sort(([a], [b]) => (a < b ? -1 : 1)),
);
if (Object.keys(pins).length !== 7) finish(3, `expected 7 Agoric pins in docs/PINS.md, found ${Object.keys(pins).length}`);

const pkg = {
  name: `baseline-${name}`,
  private: true,
  packageManager: rootPkg.packageManager,
  dependencies: pins,
  devDependencies: {
    '@endo/bundle-source': rootPkg.devDependencies['@endo/bundle-source'],
    '@endo/ses-ava': rootPkg.devDependencies['@endo/ses-ava'],
    ava: rootPkg.devDependencies.ava,
  },
  resolutions: rootPkg.resolutions,
};

const packDir = join(repoRoot, 'packages/skills/dist/claude');
if (withPack && (!existsSync(packDir) || readdirSync(packDir).length === 0)) {
  finish(3, 'packages/skills/dist/claude is empty; run `yarn skills:build` first');
}

// --- create ------------------------------------------------------------------
const git = (...gitArgs) =>
  execFileSync('git', ['-C', workspace, ...gitArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  mkdirSync(workspace, { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(workspace, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  git('add', 'package.json');
  if (withPack) {
    cpSync(packDir, join(workspace, '.claude/skills'), { recursive: true });
    git('add', '.claude/skills');
  }
  git(
    '-c', 'user.name=baseline-setup',
    '-c', 'user.email=baseline-setup@localhost',
    'commit', '-q', '-m',
    withPack
      ? 'baseline: package.json with u23 pins, and the rendered Claude Code skill pack'
      : 'baseline: package.json with u23 pins',
  );
} catch (err) {
  finish(3, `creating ${workspace} failed: ${err?.stderr || err?.message || err}`);
}

const skills = withPack ? readdirSync(join(workspace, '.claude/skills')).sort() : [];
finish(0, `Created ${workspace} at ${git('rev-parse', '--short', 'HEAD').trim()}${withPack ? ` with ${skills.length} skills: ${skills.join(', ')}` : ''}.`, {
  workspace,
  commit: git('rev-parse', 'HEAD').trim(),
  withPack,
  skills,
});
