// SPDX-License-Identifier: Apache-2.0

import type { CatalogueEntry } from '@dcfoundation/aat-core';

import type { RenderInputs, SkillSource } from './render.js';

/** What `loadRenderInputs` needs from the filesystem. Paths are repository-relative. */
export interface SourceIo {
  readonly readText: (path: string) => string;
  /** Names in a directory, or [] if it does not exist. */
  readonly list: (path: string) => readonly string[];
  readonly exists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
}

const SKILLS_SRC = 'packages/skills/src';
const SNIPPETS = 'packages/skills/snippets';

const walk = (io: SourceIo, dir: string, prefix = ''): string[] =>
  io
    .list(dir)
    .filter(name => name !== 'node_modules')
    .sort()
    .flatMap(name => {
      const path = `${dir}/${name}`;
      const rel = prefix ? `${prefix}/${name}` : name;
      return io.isDirectory(path) ? walk(io, path, rel) : [rel];
    });

/** Parse the Agoric SDK package table in docs/PINS.md. */
export const parsePins = (pinsMd: string) => {
  const section = pinsMd.split('## Agoric SDK packages')[1]?.split('\n## ')[0] ?? '';
  return harden(
    [...section.matchAll(/^\| `(@agoric\/[\w-]+)` \| `([^`]+)` \|$/gm)].map(m => ({
      name: m[1] ?? '',
      version: m[2] ?? '',
    })),
  );
};

/**
 * Read everything the render needs. The caller supplies the filesystem, so
 * the build script and the staleness test read the same inputs the same way.
 */
export const loadRenderInputs = (
  io: SourceIo,
  {
    skillNames,
    catalogue,
    notCarriedOver,
    tokenizer,
  }: {
    readonly skillNames: readonly string[];
    readonly catalogue: readonly CatalogueEntry[];
    readonly notCarriedOver: RenderInputs['notCarriedOver'];
    readonly tokenizer: RenderInputs['tokenizer'];
  },
): RenderInputs => {
  const skills: SkillSource[] = skillNames.map(name => ({
    name,
    skillMd: io.readText(`${SKILLS_SRC}/${name}/SKILL.md`),
    references: io
      .list(`${SKILLS_SRC}/${name}/references`)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => ({ name: f, text: io.readText(`${SKILLS_SRC}/${name}/references/${f}`) })),
  }));

  const snippets = Object.fromEntries(
    walk(io, SNIPPETS).map(rel => [rel, io.readText(`${SNIPPETS}/${rel}`)]),
  );

  // Every code span and catalogue ref that names something in this repository.
  const texts = skills.flatMap(s => [s.skillMd, ...s.references.map(r => r.text)]);
  const candidates = new Set<string>([
    ...texts.flatMap(t => [...t.matchAll(/`([^`\n]+)`/g)].map(m => (m[1] ?? '').split('#')[0] ?? '')),
    ...catalogue.flatMap(e => e.refs.map(r => r.split('#')[0] ?? '')),
  ]);
  const repoPaths = [...candidates]
    .filter(p => p !== '' && !p.includes(' ') && !p.includes(':') && io.exists(p))
    .sort();
  const examples = Object.fromEntries(
    repoPaths
      .filter(p => p.startsWith('examples/') && p.endsWith('.js') && !io.isDirectory(p))
      .map(p => [p, io.readText(p)]),
  );

  return harden({
    skills,
    catalogue,
    notCarriedOver,
    packRules: io.readText(`${SKILLS_SRC}/pack-rules.md`),
    snippets,
    examples,
    repoPaths,
    pins: parsePins(io.readText('docs/PINS.md')),
    tokenizer,
  });
};
