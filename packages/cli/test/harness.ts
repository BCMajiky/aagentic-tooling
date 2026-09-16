// SPDX-License-Identifier: Apache-2.0

import type { CliPowers } from '../src/run.js';

export type Invocation = {
  readonly code: number;
  readonly out: readonly string[];
  readonly err: readonly string[];
  /** The parsed `--json` envelope, when the invocation emitted one. */
  readonly json: () => Record<string, unknown>;
};

export type FakeWorld = {
  /** Absolute path -> contents. Anything absent reads as "not there". */
  readonly files?: Readonly<Record<string, string>>;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly userConfigPath?: string;
  readonly projectConfigPath?: string;
  readonly version?: string;
};

export const USER_CONFIG = '/home/tester/.aat/config.json';
export const PROJECT_CONFIG = '/work/.aat.json';

/**
 * Build the powers for one CLI invocation against a fake world.
 *
 * Everything the CLI can reach is in here, which is the useful consequence of
 * the powers object: a test needs no temp directory, no environment mutation
 * and no cwd juggling, and two tests cannot interfere with each other.
 */
export const makePowers = (
  argv: readonly string[],
  world: FakeWorld = {},
): { powers: CliPowers; out: string[]; err: string[] } => {
  const out: string[] = [];
  const err: string[] = [];
  const files = world.files ?? {};
  const powers: CliPowers = harden({
    argv: harden([...argv]),
    env: harden({ ...(world.env ?? {}) }),
    readFileIfExists: (path: string) =>
      Object.hasOwn(files, path) ? files[path] : undefined,
    userConfigPath: world.userConfigPath ?? USER_CONFIG,
    projectConfigPath: world.projectConfigPath ?? PROJECT_CONFIG,
    version: world.version ?? '9.9.9',
    stdout: (line: string) => {
      out.push(line);
    },
    stderr: (line: string) => {
      err.push(line);
    },
  });
  return { powers, out, err };
};
