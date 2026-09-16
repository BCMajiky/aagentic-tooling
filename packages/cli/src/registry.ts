// SPDX-License-Identifier: Apache-2.0

import { AatError } from '@dcfoundation/aat-core';
import type { AatConfig, CommandResult } from '@dcfoundation/aat-core';

import type { FlagSpecs, ParsedArgs } from './args.js';

/**
 * What a subcommand is handed. Note what is absent: no `process`, no `fs`, no
 * clock, no network. A subcommand that needs one of those takes it here, added
 * to this type, and the entrypoint supplies it.
 */
export type CommandContext = {
  readonly args: ParsedArgs;
  readonly config: AatConfig;
  /** Where the value of each config key came from; for `--help` and diagnostics. */
  readonly provenance: Readonly<Record<string, string>>;
  /** Lines of human-readable output. Ignored when `--json` is in effect. */
  readonly print: (line: string) => void;
};

/**
 * A subcommand. This type is the compounding promise from plan §1.1: a new tool
 * is a new workspace package exporting one of these, plus one line in the
 * registry. Nothing else.
 */
export type Subcommand = {
  readonly name: string;
  /** One line, shown in `aat --help`. */
  readonly summary: string;
  /** Flags beyond the global ones. */
  readonly flags?: FlagSpecs;
  /** Longer text for `aat <name> --help`. */
  readonly help?: readonly string[];
  readonly run: (context: CommandContext) => CommandResult;
};

export type Registry = {
  readonly list: () => readonly Subcommand[];
  readonly get: (name: string) => Subcommand | undefined;
  readonly require: (name: string) => Subcommand;
};

/** Build a registry over a fixed set of subcommands. */
export const makeRegistry = (
  subcommands: readonly Subcommand[],
): Registry => {
  const byName = new Map<string, Subcommand>();
  for (const subcommand of subcommands) {
    if (byName.has(subcommand.name)) {
      throw new AatError(
        'INTERNAL',
        `subcommand '${subcommand.name}' is registered twice`,
      );
    }
    byName.set(subcommand.name, subcommand);
  }

  const sorted = harden(
    [...subcommands].sort((a, b) => (a.name < b.name ? -1 : 1)),
  );

  return harden({
    list: () => sorted,
    get: (name: string) => byName.get(name),
    require: (name: string) => {
      const found = byName.get(name);
      if (!found) {
        throw new AatError(
          'USAGE_UNKNOWN_SUBCOMMAND',
          `unknown subcommand '${name}'; known subcommands are ${sorted.map(s => s.name).join(', ')}`,
        );
      }
      return found;
    },
  });
};
