// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { formats } from '../src/registry.js';

test('the format registry is hardened', t => {
  t.true(Object.isFrozen(formats));
});

test('no formats are registered yet', t => {
  // Day 3 replaces this with `trace-event v0`, day 4 adds
  // `contract-manifest v0`. Until then the registry is empty on purpose.
  t.deepEqual([...formats], []);
});
