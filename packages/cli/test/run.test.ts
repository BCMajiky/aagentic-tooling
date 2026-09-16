// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { ExitCode } from '@dcfoundation/aat-core';
import { formats } from '@dcfoundation/aat-schemas';

import { run } from '../src/run.js';
import type { CliPowers } from '../src/run.js';

const makePowers = (argv: readonly string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const powers: CliPowers = harden({
    argv: harden([...argv]),
    stdout: (line: string) => {
      out.push(line);
    },
    stderr: (line: string) => {
      err.push(line);
    },
  });
  return { powers, out, err };
};

// This file's real job on day 1 is to prove the monorepo is wired: the CLI
// package resolves both sibling workspaces through their published `exports`,
// and the build ordering that `tsc --build` computes is correct.
test('the CLI resolves its sibling workspace packages', t => {
  t.is(ExitCode.OK, 0);
  t.deepEqual([...formats], []);
});

test('no subcommand is a usage error, not a crash', t => {
  const { powers, err } = makePowers([]);
  t.is(run(powers), ExitCode.USAGE);
  t.true(err.some(line => line.includes('no subcommand given')));
});

test('an unknown subcommand is a usage error and names the subcommand', t => {
  const { powers, err } = makePowers(['nope']);
  t.is(run(powers), ExitCode.USAGE);
  t.true(err.some(line => line.includes("'nope'")));
});

test('run does not reach for ambient authority', t => {
  // If `run` ever reads process.argv itself this test keeps passing, so it is
  // not a proof. It is a reminder at the one place someone would be tempted:
  // the powers argument is the whole interface.
  const { powers, out } = makePowers(['--version']);
  run(powers);
  t.deepEqual(out, []);
});
