#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

// The single entrypoint, and therefore the single place that may import
// `@endo/init` and read ambient authority. Everything below this file takes its
// powers as arguments.
import '@endo/init/debug.js';

import { run } from './run.js';

process.exitCode = run(
  harden({
    argv: harden(process.argv.slice(2)),
    stdout: (line: string) => process.stdout.write(`${line}\n`),
    stderr: (line: string) => process.stderr.write(`${line}\n`),
  }),
);
