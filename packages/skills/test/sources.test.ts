// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { checkRef, parseRef, upstreamFolderByCommit } from '@dcfoundation/aat-core';

import {
  SKILL_NAMES,
  findIdioms,
  findLifts,
  findMalformedWrongFences,
  findWrongSnippets,
  parseSkillFile,
} from '../src/index.js';
import { catalogueByCode, loadSkills, readUpstreamLines, refIo, skillDirsOnDisk } from './sources.js';

const skills = loadSkills();

test('every skill directory is listed in SKILL_NAMES', t => {
  t.deepEqual(skillDirsOnDisk(), [...SKILL_NAMES].sort());
});

for (const skill of skills) {
  test(`${skill.name}: frontmatter names the skill and says when to load it and when not`, t => {
    const parsed = parseSkillFile(skill.skillMd);
    if (typeof parsed === 'string') {
      t.fail(parsed);
      return;
    }
    const { name, description } = parsed.frontmatter;
    t.is(name, skill.name);
    t.regex(name, /^agoric-[a-z-]+$/);
    // Both Claude Code and Codex pick skills implicitly by description (D2).
    t.regex(description, /\bLoad when\b/, 'description does not say when to load');
    t.regex(description, /\bDo not load\b/, 'description does not say when not to load');
    t.true(description.length <= 1024, 'description is too long for skill loaders');
  });

  test(`${skill.name}: every idiom has a correct ref and a wrong snippet`, t => {
    const idioms = findIdioms(skill.skillMd);
    t.true(idioms.length > 0, 'no ## Idioms section with ### idioms');
    for (const idiom of idioms) {
      t.true(idiom.correctRefs.length > 0, `"${idiom.title}" has no **Correct:** ref`);
      t.true(idiom.wrongSnippets.length > 0, `"${idiom.title}" has no wrong snippet`);
    }
  });

  test(`${skill.name}: every wrong snippet resolves to a catalogue entry`, t => {
    for (const { path, text } of skill.files) {
      t.deepEqual(findMalformedWrongFences(text), [], `${path} has malformed wrong fences`);
      for (const snippet of findWrongSnippets(text)) {
        const where = `${path}:${snippet.line}`;
        const entry = catalogueByCode.get(snippet.code);
        t.truthy(entry, `${where}: ${snippet.code} is not in hints.ts`);
        t.truthy(snippet.produces, `${where}: no **Produces:** line`);
        if (!entry || snippet.produces === undefined) continue;
        const saysSilent = /^silent\b/i.test(snippet.produces);
        t.is(
          saysSilent,
          entry.match.kind === 'silent',
          `${where}: Produces says ${saysSilent ? 'silent' : 'an error'} but ${snippet.code} is ${entry.match.kind}`,
        );
      }
    }
  });

  test(`${skill.name}: every correct ref resolves`, t => {
    for (const idiom of findIdioms(skill.skillMd)) {
      for (const ref of idiom.correctRefs) {
        t.deepEqual(checkRef(ref, refIo), [], `"${idiom.title}": ${ref}`);
      }
    }
  });

  test(`${skill.name}: lifted text matches upstream word for word`, t => {
    // Most skills lift nothing; the test still has to assert something.
    t.pass();
    for (const { path, text } of skill.files) {
      for (const lift of findLifts(text)) {
        const parsed = parseRef(lift.ref);
        if (typeof parsed === 'string' || parsed.kind !== 'upstream' || !parsed.lines) {
          t.fail(`${path}:${lift.line}: lift ref must be an upstream ref with a line range`);
          continue;
        }
        const folder = upstreamFolderByCommit[parsed.commit] ?? '';
        const upstream = readUpstreamLines(folder, parsed.path);
        if (upstream === undefined) {
          t.log(`${path}:${lift.line}: ${lift.ref} not checked, clone absent`);
          continue;
        }
        t.is(
          lift.text,
          upstream.slice(parsed.lines.start - 1, parsed.lines.end).join('\n'),
          `${path}:${lift.line}: lift differs from ${lift.ref}`,
        );
      }
    }
  });
}

test('the three upstream lifts are present', t => {
  const lifts = skills.flatMap(s => s.files.flatMap(f => findLifts(f.text).map(l => `${s.name} ${l.ref}`)));
  t.true(lifts.some(l => l.startsWith('agoric-zoe-contract agoric-sdk@a2a3de9:AGENTS.md#')), 'POLA lift missing');
  t.true(lifts.some(l => l.startsWith('agoric-orchestration agoric-sdk@a2a3de9:AGENTS.md#')), 'Async-Flow lift missing');
  t.true(
    lifts.some(l => l.startsWith('agoric-orchestration agoric-sdk@a2a3de9:.github/copilot-instructions.md#')),
    'vows rule lift missing',
  );
});
