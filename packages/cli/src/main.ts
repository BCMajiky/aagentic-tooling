#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

// The single entrypoint, and therefore the single place that may import
// `@endo/init` and read ambient authority. Everything below this file takes its
// powers as arguments.
import '@endo/init/debug.js';

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from './run.js';

/** Read a file, or undefined when it is not there. Other errors still throw. */
const readFileIfExists = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    if (
      typeof cause === 'object' &&
      cause !== null &&
      (cause as { code?: string }).code === 'ENOENT'
    ) {
      return undefined;
    }
    throw cause;
  }
};

const ownVersion = (): string => {
  // dist/src/main.js -> the package root is two levels up.
  const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url));
  const raw: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const version =
    typeof raw === 'object' && raw !== null
      ? (raw as { version?: unknown }).version
      : undefined;
  return typeof version === 'string' ? version : '0.0.0';
};

process.exitCode = run(
  harden({
    argv: harden(process.argv.slice(2)),
    env: harden({ ...process.env }),
    readFileIfExists,
    userConfigPath: join(homedir(), '.aat', 'config.json'),
    projectConfigPath: join(process.cwd(), '.aat.json'),
    version: ownVersion(),
    stdout: (line: string) => process.stdout.write(`${line}\n`),
    stderr: (line: string) => process.stderr.write(`${line}\n`),
  }),
);
