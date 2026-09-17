// SPDX-License-Identifier: Apache-2.0

// Test support: read the skill sources from disk. Ambient `node:fs` stays in
// test code; the modules under src/ take text, not paths.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogue, makeRefIo } from '@dcfoundation/aat-core';

import { SKILL_NAMES } from '../src/index.js';

// Compiled tests run from packages/skills/dist/test/.
export const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const srcRoot = join(repoRoot, 'packages/skills/src');

export const catalogueByCode = new Map(catalogue.map(e => [e.code, e]));

export const refIo = makeRefIo({
  repoRoot,
  exists: existsSync,
  readText: path => readFileSync(path, 'utf8'),
  isCatalogueCode: code => catalogueByCode.has(code),
});

export interface SkillFiles {
  readonly name: string;
  readonly skillMd: string;
  /** Repository-relative path and text of each markdown file. */
  readonly files: ReadonlyArray<{ readonly path: string; readonly text: string }>;
}

export const loadSkills = (): readonly SkillFiles[] =>
  SKILL_NAMES.map(name => {
    const dir = join(srcRoot, name);
    const skillPath = `packages/skills/src/${name}/SKILL.md`;
    const skillMd = readFileSync(join(dir, 'SKILL.md'), 'utf8');
    const refDir = join(dir, 'references');
    const references = existsSync(refDir)
      ? readdirSync(refDir)
          .filter(f => f.endsWith('.md'))
          .sort()
          .map(f => ({
            path: `packages/skills/src/${name}/references/${f}`,
            text: readFileSync(join(refDir, f), 'utf8'),
          }))
      : [];
    return { name, skillMd, files: [{ path: skillPath, text: skillMd }, ...references] };
  });

/** The skill directories actually on disk, to catch one missing from SKILL_NAMES. */
export const skillDirsOnDisk = () =>
  readdirSync(srcRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

/** Upstream text for a lift ref, or undefined when the clone is absent (CI). */
export const readUpstreamLines = (folder: string, path: string) => {
  const full = refIo.upstreamPath(folder, path);
  return full !== undefined && existsSync(full) ? readFileSync(full, 'utf8').split('\n') : undefined;
};
