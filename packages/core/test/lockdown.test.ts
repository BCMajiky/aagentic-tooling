// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { ExitCode } from '../src/exit-codes.js';

// The point of this file is not to test `ExitCode`. It is to fail loudly if the
// test harness ever stops running under SES. `@endo/init` plus plain ava passes
// under conditions the chain never provides (STAGE0-BRIEF.md, "Rules that carry
// over"), and the cheapest way to catch that is to assert on the two things
// only `lockdown()` does.

test('lockdown() has run: shared intrinsics are frozen', t => {
  t.true(Object.isFrozen(Object.prototype));
  t.true(Object.isFrozen(Array.prototype));
  t.true(Object.isFrozen(Function.prototype));
});

test('harden is a global', t => {
  t.is(typeof harden, 'function');
});

test('ExitCode is hardened and carries the brief-mandated values', t => {
  t.true(Object.isFrozen(ExitCode));
  t.deepEqual({ ...ExitCode }, {
    OK: 0,
    FINDINGS: 1,
    USAGE: 2,
    ENVIRONMENT: 3,
  });
});

test('a hardened export cannot be reassigned', t => {
  // The cast is the point: TypeScript already refuses this, and we want to know
  // that the runtime refuses it too, in a module the caller could reach.
  const mutable = ExitCode as unknown as { OK: number };
  t.throws(() => {
    mutable.OK = 99;
  });
  t.is(ExitCode.OK, 0);
});
