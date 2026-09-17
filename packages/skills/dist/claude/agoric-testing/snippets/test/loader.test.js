// SPDX-License-Identifier: Apache-2.0

// The D4 loader check, rerun (RELEASE1-BRIEF.md D4;
// docs/notes/baseline-2026-09/README.md, "D4 loader check", correction 2).
// ava starts this package's workers with --loader=ts-blank-space/register.
// This file asserts which copy of the loader that resolves to, and that the
// published TypeScript test tools import and run through it.

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { buildVTransferEvent } from '@agoric/orchestration/tools/ibc-mocks.ts';
import { setupOrchestrationTest } from '@agoric/orchestration/tools/contract-tests.ts';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

test('the loader resolves to a ts-blank-space satisfying ^0.6.2', t => {
  // --loader resolves its specifier from the working directory, which ava sets
  // to this package; resolve the same way to see which copy that is.
  const require = createRequire(join(process.cwd(), 'package.json'));
  const pkgPath = require.resolve('ts-blank-space/package.json');
  const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  t.log(`ts-blank-space ${version} at ${pkgPath}`);
  t.log(`node ${process.version}`);
  t.regex(version, /^0\.6\.([2-9]|\d{2,})$/);
});

test('setupOrchestrationTest and ibc-mocks import and run through the loader', async t => {
  const { bootstrap, commonPrivateArgs, utils } = await setupOrchestrationTest({ log: t.log });
  t.truthy(bootstrap.cosmosInterchainService);
  t.truthy(commonPrivateArgs.localchain);
  t.is(typeof utils.transmitVTransferEvent, 'function');
  t.is(typeof buildVTransferEvent, 'function');
});
