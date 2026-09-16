#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * Render the generated blocks of AGENTS.md from the code, or check that they
 * are already up to date.
 *
 *   yarn agents:write   rewrite AGENTS.md in place
 *   yarn agents:check   exit 1 if it would change
 *
 * The same `renderInto` runs in `packages/cli/test/agents-doc.test.ts`, so the
 * divergence is caught by the test suite on both Node versions as well as here.
 * This script exists so that fixing the drift is one command rather than a
 * hand edit.
 */
import '@endo/init/debug.js';

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderInto } from '../packages/cli/dist/src/agents-doc.js';

const path = fileURLToPath(new URL('../AGENTS.md', import.meta.url));
const check = process.argv.includes('--check');

const current = readFileSync(path, 'utf8');
const rendered = renderInto(current);

if (current === rendered) {
  process.stdout.write('AGENTS.md is up to date.\n');
  process.exitCode = 0;
} else if (check) {
  process.stderr.write(
    'AGENTS.md has drifted from the code it documents.\n' +
      'Run `yarn agents:write` and commit the result.\n',
  );
  process.exitCode = 1;
} else {
  writeFileSync(path, rendered);
  process.stdout.write('AGENTS.md rewritten.\n');
  process.exitCode = 0;
}
