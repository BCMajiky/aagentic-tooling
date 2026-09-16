// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { ErrorCode, exitCodeByError } from '../src/codes.js';
import { AatError, asAatError, isAatError } from '../src/errors.js';
import { ExitCode } from '../src/exit-codes.js';
import { hints } from '../src/hints.js';

test('every error code has a hint', t => {
  // The type checker already enforces this via `satisfies`, but the map is the
  // contract Release 1's catalogue imports, so assert it at runtime too: a hint
  // that is present but empty would type-check and be useless.
  for (const code of Object.values(ErrorCode)) {
    t.is(typeof hints[code], 'string', `${code} has no hint`);
    t.true(hints[code].length > 10, `${code} has a stub hint`);
  }
});

test('every error code has an exit code', t => {
  for (const code of Object.values(ErrorCode)) {
    const exitCode = exitCodeByError[code];
    t.true(
      Object.values(ExitCode).includes(exitCode),
      `${code} maps to ${exitCode}, which is not an exit code`,
    );
  }
});

test('no error code maps to OK or FINDINGS', t => {
  // Findings are not errors: a command returns them, it does not throw them.
  for (const code of Object.values(ErrorCode)) {
    t.not(exitCodeByError[code], ExitCode.OK);
    t.not(exitCodeByError[code], ExitCode.FINDINGS);
  }
});

test('usage codes exit 2 and everything else exits 3', t => {
  for (const code of Object.values(ErrorCode)) {
    const expected = code.startsWith('USAGE_')
      ? ExitCode.USAGE
      : ExitCode.ENVIRONMENT;
    t.is(exitCodeByError[code], expected, `${code} has the wrong exit code`);
  }
});

test('an AatError carries its exit code and hint', t => {
  const error = new AatError('USAGE_UNKNOWN_FLAG', "unknown flag '--nope'");
  t.is(error.code, 'USAGE_UNKNOWN_FLAG');
  t.is(error.exitCode, ExitCode.USAGE);
  t.is(error.hint, hints.USAGE_UNKNOWN_FLAG);
  t.is(error.name, 'AatError');
  t.true(error instanceof Error);
});

test('isAatError distinguishes ours from anything else', t => {
  t.true(isAatError(new AatError('INTERNAL', 'x')));
  t.false(isAatError(new Error('x')));
  t.false(isAatError('x'));
  t.false(isAatError(undefined));
});

test('asAatError passes ours through unchanged', t => {
  const original = new AatError('CONFIG_MALFORMED', 'bad json');
  t.is(asAatError(original), original);
});

test('asAatError wraps anything else as INTERNAL and keeps the cause', t => {
  const cause = new Error('something unexpected');
  const wrapped = asAatError(cause);
  t.is(wrapped.code, 'INTERNAL');
  t.is(wrapped.exitCode, ExitCode.ENVIRONMENT);
  t.is(wrapped.message, 'something unexpected');
  t.is(wrapped.cause, cause);
});

test('asAatError survives a non-Error throw', t => {
  const wrapped = asAatError('a bare string');
  t.is(wrapped.code, 'INTERNAL');
  t.is(wrapped.message, 'a bare string');
});

test('the hint map is hardened, so no consumer can rewrite the advice', t => {
  t.true(Object.isFrozen(hints));
  t.throws(() => {
    (hints as unknown as Record<string, string>).INTERNAL = 'nonsense';
  });
});
