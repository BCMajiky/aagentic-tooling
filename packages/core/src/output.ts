// SPDX-License-Identifier: Apache-2.0

import { ExitCode } from './exit-codes.js';
import type { ExitCodeValue } from './exit-codes.js';
import type { AatError } from './errors.js';

/**
 * One thing a command found worth reporting. Findings are not errors: a command
 * that returns findings ran correctly and exits 1.
 */
export type Finding = {
  readonly code: string;
  readonly message: string;
  readonly hint?: string;
};

/**
 * The `--json` envelope, identical for every subcommand.
 *
 * STAGE0-BRIEF.md fixes this shape: `{ ok, code, findings?, data?, hint? }`.
 * It is a stable interface — scripts and agents parse it — so the optional
 * members are omitted rather than emitted as null, and no subcommand adds a
 * top-level key of its own. Command-specific output goes inside `data`.
 */
export type CommandResult = {
  readonly ok: boolean;
  readonly code: ExitCodeValue;
  readonly findings?: readonly Finding[];
  readonly data?: unknown;
  readonly hint?: string;
};

/** A result meaning "ran, nothing to report", optionally carrying data. */
export const ok = (data?: unknown): CommandResult =>
  harden(data === undefined ? { ok: true, code: ExitCode.OK } : { ok: true, code: ExitCode.OK, data });

/** A result meaning "ran correctly, and here is what I found". Exits 1. */
export const withFindings = (
  findings: readonly Finding[],
  data?: unknown,
): CommandResult =>
  harden({
    ok: false,
    code: ExitCode.FINDINGS,
    findings: [...findings],
    ...(data === undefined ? {} : { data }),
  });

/** A result built from a thrown `AatError`. */
export const fromError = (error: AatError): CommandResult =>
  harden({
    ok: false,
    code: error.exitCode,
    findings: [{ code: error.code, message: error.message }],
    hint: error.hint,
  });

/**
 * Render a result as a single line of JSON.
 *
 * One line, not pretty-printed: `--json` output is for programs, and one
 * object per line is what makes it pipeable into `jq` and appendable to a log.
 */
export const renderJson = (result: CommandResult): string =>
  JSON.stringify(result);

/**
 * Render a result for a human.
 *
 * Findings go to the caller as lines; `data` is the command's business and is
 * rendered by the command itself, which is why this takes the already-rendered
 * body rather than trying to format arbitrary data.
 */
export const renderHuman = (
  result: CommandResult,
  body?: readonly string[],
): readonly string[] => {
  const lines: string[] = [];
  if (body) lines.push(...body);
  for (const finding of result.findings ?? []) {
    lines.push(`${finding.code}: ${finding.message}`);
    if (finding.hint) lines.push(`  hint: ${finding.hint}`);
  }
  if (result.hint) lines.push(`hint: ${result.hint}`);
  return harden(lines);
};
