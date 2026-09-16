// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ErrorCode, NETWORK_NAMES, hints } from '@dcfoundation/aat-core';
import { formats } from '@dcfoundation/aat-schemas';

import { BEGIN, END, generatedSections, renderInto } from '../src/agents-doc.js';
import { registry } from '../src/run.js';

// dist/test/agents-doc.test.js -> packages/cli -> packages -> repo root.
const agentsPath = fileURLToPath(new URL('../../../../AGENTS.md', import.meta.url));
const agents = () => readFileSync(agentsPath, 'utf8');

// This is the divergence test plan §1.6 asks for. The skill pack is Release 1,
// so there is nothing to diverge from yet — but the facts it will restate are
// already here, and a document that repeats them by hand goes stale the first
// time one changes.
test('AGENTS.md has not drifted from the code it documents', t => {
  const current = agents();
  const rendered = renderInto(current);
  if (current !== rendered) {
    t.fail(
      'AGENTS.md is out of date with the code. Run `yarn agents:write` and commit the result.',
    );
    return;
  }
  t.pass();
});

test('every generated section has its markers in the file', t => {
  const text = agents();
  for (const section of generatedSections()) {
    t.true(text.includes(BEGIN(section.id)), `missing begin marker: ${section.id}`);
    t.true(text.includes(END(section.id)), `missing end marker: ${section.id}`);
  }
});

test('renderInto refuses a document that is missing a block', t => {
  // A section that silently fails to render is exactly the drift this guards
  // against, so it throws rather than skipping.
  t.throws(() => renderInto('# nothing here\n'), {
    message: /has no 'subcommands' block/,
  });
});

test('AGENTS.md names every subcommand', t => {
  const text = agents();
  for (const command of registry.list()) {
    t.true(text.includes(`\`aat ${command.name}\``), command.name);
  }
});

test('AGENTS.md carries every error code and its hint', t => {
  // The brief: the hints are the same text the skill pack uses. This is what
  // makes that true rather than aspirational.
  const text = agents();
  for (const code of Object.values(ErrorCode)) {
    t.true(text.includes(`\`${code}\``), `missing code ${code}`);
    const hint = hints[code].replace(/\|/g, '\\|');
    t.true(text.includes(hint), `missing hint for ${code}`);
  }
});

test('AGENTS.md lists every network and every registered format', t => {
  const text = agents();
  for (const name of NETWORK_NAMES) {
    t.true(text.includes(`\`${name}\``), name);
  }
  for (const format of formats) {
    t.true(text.includes(`\`${format.name}\``), format.name);
  }
});

test('AGENTS.md states the non-negotiable rules', t => {
  // Prose, so this can only check that the load-bearing phrases survive an
  // edit. Better than nothing: these are the rules whose loss is expensive.
  const text = agents();
  for (const phrase of [
    '@endo/ses-ava',
    'harden()',
    'Ambient authority stays in entrypoints',
    'No telemetry',
    'Do not modify',
    'Pin exactly',
  ]) {
    t.true(text.includes(phrase), `AGENTS.md no longer says: ${phrase}`);
  }
});
