// SPDX-License-Identifier: Apache-2.0

import { ExitCode } from '@dcfoundation/aat-core';
import type { ExitCodeValue } from '@dcfoundation/aat-core';

/**
 * Everything the CLI is allowed to touch, passed in rather than reached for.
 * `main.ts` is the only module that may read ambient authority and fill this in
 * (CLAUDE.md: "ambient authority stays in CLI entrypoints").
 */
export type CliPowers = {
  readonly argv: readonly string[];
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

/**
 * The CLI body. Day 2 replaces the placeholder below with the subcommand
 * registry, layered config and `--json` output; the signature is the part that
 * is settled now, because it is what keeps authority out of the modules.
 */
export const run = (powers: CliPowers): ExitCodeValue => {
  const [subcommand] = powers.argv;
  powers.stderr(
    subcommand === undefined
      ? 'aat: no subcommand given.'
      : `aat: unknown subcommand '${subcommand}'.`,
  );
  powers.stderr('aat: the subcommand registry lands on day 2 of Stage 0.');
  return ExitCode.USAGE;
};
