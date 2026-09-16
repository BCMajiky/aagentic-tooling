// SPDX-License-Identifier: Apache-2.0

/**
 * The exit codes every `aat` subcommand uses. Fixed by STAGE0-BRIEF.md and by
 * the repository rules in CLAUDE.md; they are part of the CLI's contract with
 * scripts and with agents, so they never change meaning.
 */
export const ExitCode = harden({
  /** The command ran and found nothing to report. */
  OK: 0,
  /** The command ran and has findings to report. Not an error. */
  FINDINGS: 1,
  /** The caller got the invocation wrong: bad flag, missing argument. */
  USAGE: 2,
  /** The environment is wrong: unreachable endpoint, missing binary, bad config. */
  ENVIRONMENT: 3,
} as const);

/** One of the values of {@link ExitCode}. */
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
