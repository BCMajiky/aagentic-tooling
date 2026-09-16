// SPDX-License-Identifier: Apache-2.0

import { ExitCode } from './exit-codes.js';
import type { ExitCodeValue } from './exit-codes.js';

/**
 * Every error this toolchain can report, as a stable string code.
 *
 * Codes are the join between three things that must not drift apart: the
 * message a human sees, the `hint` in `--json` output, and Release 1's error
 * catalogue. Adding a code means adding a hint in `./hints.ts` — the type
 * checker enforces that, because `hints` is declared over this exact key set.
 *
 * Codes are never renamed or reused. A code that stops being reachable stays
 * here with its hint, because logs and documentation outlive the code path.
 */
export const ErrorCode = harden({
  // --- usage: the caller got the invocation wrong (exit 2) ---
  USAGE_UNKNOWN_SUBCOMMAND: 'USAGE_UNKNOWN_SUBCOMMAND',
  USAGE_NO_SUBCOMMAND: 'USAGE_NO_SUBCOMMAND',
  USAGE_UNKNOWN_FLAG: 'USAGE_UNKNOWN_FLAG',
  USAGE_FLAG_NEEDS_VALUE: 'USAGE_FLAG_NEEDS_VALUE',
  USAGE_UNEXPECTED_ARGUMENT: 'USAGE_UNEXPECTED_ARGUMENT',

  // --- configuration: what we were told is unusable (exit 3) ---
  CONFIG_UNREADABLE: 'CONFIG_UNREADABLE',
  CONFIG_MALFORMED: 'CONFIG_MALFORMED',
  CONFIG_UNKNOWN_NETWORK: 'CONFIG_UNKNOWN_NETWORK',
  CONFIG_UNKNOWN_KEY: 'CONFIG_UNKNOWN_KEY',
  CONFIG_BAD_VALUE: 'CONFIG_BAD_VALUE',

  // --- environment: the world is not as required (exit 3) ---
  ENV_RPC_UNREACHABLE: 'ENV_RPC_UNREACHABLE',
  ENV_BINARY_MISSING: 'ENV_BINARY_MISSING',
  ENV_NODE_VERSION: 'ENV_NODE_VERSION',

  // --- chain: not reachable until Release 2, but the hints exist now ---
  // STAGE0-BRIEF.md, "Rules that carry over": anything that will later touch a
  // chain uses explicit gas of 100000000 for bundle installs and verifies the
  // bundle id on chain before trusting a success response. The codes and hints
  // are written now so nothing has to be retrofitted, and so Release 1's
  // catalogue can cite them before Release 2 implements them.
  CHAIN_BUNDLE_INSTALL_UNDERGASSED: 'CHAIN_BUNDLE_INSTALL_UNDERGASSED',
  CHAIN_BUNDLE_NOT_FOUND: 'CHAIN_BUNDLE_NOT_FOUND',
  CHAIN_PAYLOAD_TOO_LARGE: 'CHAIN_PAYLOAD_TOO_LARGE',
  CHAIN_ACCOUNT_SEQUENCE_MISMATCH: 'CHAIN_ACCOUNT_SEQUENCE_MISMATCH',
  CHAIN_DENOM_UNKNOWN: 'CHAIN_DENOM_UNKNOWN',

  // --- internal: a bug here, not out there (exit 3) ---
  INTERNAL: 'INTERNAL',
} as const);

/** One of the string values of {@link ErrorCode}. */
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * The process exit code each error code produces. Kept explicit rather than
 * derived from the code's prefix, so that moving an error between categories is
 * a visible edit rather than a rename with invisible consequences.
 */
export const exitCodeByError = harden({
  USAGE_UNKNOWN_SUBCOMMAND: ExitCode.USAGE,
  USAGE_NO_SUBCOMMAND: ExitCode.USAGE,
  USAGE_UNKNOWN_FLAG: ExitCode.USAGE,
  USAGE_FLAG_NEEDS_VALUE: ExitCode.USAGE,
  USAGE_UNEXPECTED_ARGUMENT: ExitCode.USAGE,

  CONFIG_UNREADABLE: ExitCode.ENVIRONMENT,
  CONFIG_MALFORMED: ExitCode.ENVIRONMENT,
  CONFIG_UNKNOWN_NETWORK: ExitCode.ENVIRONMENT,
  CONFIG_UNKNOWN_KEY: ExitCode.ENVIRONMENT,
  CONFIG_BAD_VALUE: ExitCode.ENVIRONMENT,

  ENV_RPC_UNREACHABLE: ExitCode.ENVIRONMENT,
  ENV_BINARY_MISSING: ExitCode.ENVIRONMENT,
  ENV_NODE_VERSION: ExitCode.ENVIRONMENT,

  CHAIN_BUNDLE_INSTALL_UNDERGASSED: ExitCode.ENVIRONMENT,
  CHAIN_BUNDLE_NOT_FOUND: ExitCode.ENVIRONMENT,
  CHAIN_PAYLOAD_TOO_LARGE: ExitCode.ENVIRONMENT,
  CHAIN_ACCOUNT_SEQUENCE_MISMATCH: ExitCode.ENVIRONMENT,
  CHAIN_DENOM_UNKNOWN: ExitCode.ENVIRONMENT,

  INTERNAL: ExitCode.ENVIRONMENT,
} as const satisfies Record<ErrorCodeValue, ExitCodeValue>);
