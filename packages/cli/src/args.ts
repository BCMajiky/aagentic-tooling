// SPDX-License-Identifier: Apache-2.0

import { AatError } from '@dcfoundation/aat-core';

/**
 * What a flag carries. `boolean` flags take no value; `string` flags take one,
 * either as `--flag value` or `--flag=value`.
 */
export type FlagKind = 'boolean' | 'string';

export type FlagSpec = {
  readonly kind: FlagKind;
  /** One line, shown by `--help`. */
  readonly summary: string;
};

export type FlagSpecs = Readonly<Record<string, FlagSpec>>;

export type ParsedArgs = {
  readonly flags: Readonly<Record<string, string | boolean>>;
  readonly positional: readonly string[];
};

/**
 * A deliberately small flag parser: long flags only, no clustering, no
 * abbreviation, `--` ends flag parsing.
 *
 * Written rather than taken from npm because the whole surface is `--json`,
 * `--help`, `--version` and a handful of string options, and a dependency here
 * would be a dependency in every tool that ever registers a subcommand.
 *
 * An unknown flag is an error. Guessing what someone meant by `--jsonn` is how
 * a tool ends up silently not emitting JSON in someone's CI.
 */
export const parseArgs = (
  argv: readonly string[],
  specs: FlagSpecs,
): ParsedArgs => {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    index += 1;
    if (token === undefined) break;

    if (token === '--') {
      positional.push(...argv.slice(index));
      break;
    }

    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const equals = token.indexOf('=');
    const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
    const inlineValue = equals === -1 ? undefined : token.slice(equals + 1);

    const spec = specs[name];
    if (!spec) {
      throw new AatError(
        'USAGE_UNKNOWN_FLAG',
        `unknown flag '--${name}'`,
      );
    }

    if (spec.kind === 'boolean') {
      if (inlineValue !== undefined) {
        throw new AatError(
          'USAGE_UNEXPECTED_ARGUMENT',
          `flag '--${name}' takes no value, got '--${name}=${inlineValue}'`,
        );
      }
      flags[name] = true;
      continue;
    }

    if (inlineValue !== undefined) {
      flags[name] = inlineValue;
      continue;
    }

    const next = argv[index];
    if (next === undefined || next.startsWith('--')) {
      throw new AatError(
        'USAGE_FLAG_NEEDS_VALUE',
        `flag '--${name}' needs a value`,
      );
    }
    flags[name] = next;
    index += 1;
  }

  return harden({ flags, positional });
};

/** Read a string flag, or `undefined` when it was not given. */
export const stringFlag = (
  parsed: ParsedArgs,
  name: string,
): string | undefined => {
  const value = parsed.flags[name];
  return typeof value === 'string' ? value : undefined;
};

/** Read a boolean flag. Absent means `false`. */
export const booleanFlag = (parsed: ParsedArgs, name: string): boolean =>
  parsed.flags[name] === true;
