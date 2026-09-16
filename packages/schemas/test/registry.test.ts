// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { formats } from '../src/registry.js';

test('the format registry is hardened', t => {
  t.true(Object.isFrozen(formats));
});

test('trace-event v0 is registered', t => {
  // Day 4 adds `contract-manifest v0` as one more entry here.
  t.deepEqual(
    formats.map(format => `${format.name} ${format.version}`),
    ['trace-event v0'],
  );
});

test('every registered format has a usable summary', t => {
  for (const format of formats) {
    t.true(format.summary.length > 10, `${format.name} has a stub summary`);
    t.regex(format.version, /^v\d+$/, `${format.name} has an odd version`);
  }
});
