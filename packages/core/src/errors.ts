// SPDX-License-Identifier: Apache-2.0

import { exitCodeByError } from './codes.js';
import type { ErrorCodeValue } from './codes.js';
import type { ExitCodeValue } from './exit-codes.js';
import { hints } from './hints.js';

/**
 * The one error type. Every failure `aat` reports on purpose is an `AatError`;
 * anything else reaching the top level is a bug and is reported as `INTERNAL`.
 *
 * The code carries the exit code and the hint with it, so no call site has to
 * remember either. That is the whole design: a subcommand throws with a code
 * and a message, and the shell knows what to print and what to exit with.
 */
export class AatError extends Error {
  /** The stable code. Safe to match on in scripts and in the skill pack. */
  readonly code: ErrorCodeValue;

  /** What the process should exit with. Derived from `code`. */
  readonly exitCode: ExitCodeValue;

  /** What to do about it. Derived from `code`; the same text the skill pack uses. */
  readonly hint: string;

  constructor(
    code: ErrorCodeValue,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AatError';
    this.code = code;
    this.exitCode = exitCodeByError[code];
    this.hint = hints[code];
  }
}
harden(AatError);

/** True when `value` is an {@link AatError}. */
export const isAatError = (value: unknown): value is AatError =>
  value instanceof AatError;

/**
 * Coerce anything thrown into an `AatError`. Used at the top level so that an
 * unexpected throw still produces the documented output shape and a meaningful
 * exit code rather than a stack trace and exit 1.
 */
export const asAatError = (value: unknown): AatError => {
  if (isAatError(value)) return value;
  const message = value instanceof Error ? value.message : String(value);
  return new AatError('INTERNAL', message, { cause: value });
};
