// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { ExitCode, networks } from '@dcfoundation/aat-core';

import { run } from '../src/run.js';
import { PROJECT_CONFIG, USER_CONFIG, makePowers } from './harness.js';
import type { FakeWorld } from './harness.js';

const invoke = (argv: readonly string[], world?: FakeWorld) => {
  const { powers, out, err } = makePowers(argv, world);
  const code = run(powers);
  return { code, out, err };
};

const invokeJson = (argv: readonly string[], world?: FakeWorld) => {
  const { code, out, err } = invoke([...argv, '--json'], world);
  return { code, err, envelope: JSON.parse(out.join('\n')) as Record<string, unknown> };
};

// --- the two things day 2's done-when names -------------------------------

test('--version prints the version and exits 0', t => {
  const { code, out } = invoke(['--version'], { version: '1.2.3' });
  t.is(code, ExitCode.OK);
  t.deepEqual(out, ['1.2.3']);
});

test('--help lists every registered subcommand', t => {
  const { code, out } = invoke(['--help']);
  t.is(code, ExitCode.OK);
  const text = out.join('\n');
  for (const name of ['config', 'doctor', 'schemas']) {
    t.true(text.includes(name), `expected --help to mention ${name}`);
  }
  t.true(text.includes('0 ok, 1 findings, 2 usage error, 3 environment error'));
});

test('no subcommand is a usage error, exit 2', t => {
  const { code, err } = invoke([]);
  t.is(code, ExitCode.USAGE);
  t.true(err.join('\n').includes('USAGE_NO_SUBCOMMAND'));
});

test('an unknown subcommand is a usage error, exit 2, and lists the real ones', t => {
  const { code, err } = invoke(['bogus']);
  t.is(code, ExitCode.USAGE);
  const text = err.join('\n');
  t.true(text.includes('USAGE_UNKNOWN_SUBCOMMAND'));
  t.true(text.includes('schemas'));
});

test('an unknown flag is a usage error, exit 2', t => {
  const { code, err } = invoke(['schemas', 'list', '--jsonn']);
  t.is(code, ExitCode.USAGE);
  t.true(err.join('\n').includes('USAGE_UNKNOWN_FLAG'));
});

test('a string flag with no value is a usage error, exit 2', t => {
  const { code, err } = invoke(['doctor', '--network']);
  t.is(code, ExitCode.USAGE);
  t.true(err.join('\n').includes('USAGE_FLAG_NEEDS_VALUE'));
});

test('an unusable config file is an environment error, exit 3', t => {
  const { code, err } = invoke(['config', 'show'], {
    files: { [PROJECT_CONFIG]: '{ not json' },
  });
  t.is(code, ExitCode.ENVIRONMENT);
  t.true(err.join('\n').includes('CONFIG_MALFORMED'));
});

test('an unknown network is an environment error, exit 3', t => {
  const { code, err } = invoke(['config', 'show', '--network', 'testnet']);
  t.is(code, ExitCode.ENVIRONMENT);
  t.true(err.join('\n').includes('CONFIG_UNKNOWN_NETWORK'));
});

// --- the --json envelope --------------------------------------------------

test('the JSON envelope has the brief-mandated shape on success', t => {
  const { code, envelope } = invokeJson(['schemas', 'list']);
  t.is(code, ExitCode.OK);
  t.is(envelope.ok, true);
  t.is(envelope.code, ExitCode.OK);
  t.false('findings' in envelope);
  t.false('hint' in envelope);
  t.true('data' in envelope);
});

test('the JSON envelope carries the code, the finding and the hint on failure', t => {
  const { code, envelope } = invokeJson(['bogus']);
  t.is(code, ExitCode.USAGE);
  t.is(envelope.ok, false);
  t.is(envelope.code, ExitCode.USAGE);
  const findings = envelope.findings as Array<Record<string, unknown>>;
  t.is(findings[0]?.code, 'USAGE_UNKNOWN_SUBCOMMAND');
  t.is(typeof envelope.hint, 'string');
  t.true((envelope.hint as string).includes('aat --help'));
});

test('--json is honoured even when argument parsing is what failed', t => {
  // The failure happens before any config is read, so the output mode has to be
  // decided from argv directly or this emits human text into a JSON pipeline.
  const { code, out } = invoke(['--json', '--nope']);
  t.is(code, ExitCode.USAGE);
  t.notThrows(() => {
    JSON.parse(out.join('\n'));
  });
});

test('one line of JSON, so output is pipeable and appendable', t => {
  const { out } = invoke(['schemas', 'list', '--json']);
  t.is(out.length, 1);
  t.false(out[0]?.includes('\n'));
});

test('--json works before or after the subcommand', t => {
  const before = invoke(['--json', 'schemas', 'list']);
  const after = invoke(['schemas', 'list', '--json']);
  t.deepEqual(before.out, after.out);
});

// --- subcommands ----------------------------------------------------------

test('schemas list reports the registered formats', t => {
  const { code, envelope } = invokeJson(['schemas', 'list']);
  t.is(code, ExitCode.OK);
  const { formats } = envelope.data as {
    formats: Array<{ name: string; version: string; summary: string }>;
  };
  t.deepEqual(
    formats.map(format => `${format.name} ${format.version}`),
    ['trace-event v0'],
  );
});

test('schemas list prints trace-event v0 for a human too', t => {
  const { code, out } = invoke(['schemas', 'list']);
  t.is(code, ExitCode.OK);
  const text = out.join('\n');
  t.true(text.includes('trace-event'));
  t.true(text.includes('v0'));
});

test('schemas with no action is a usage error', t => {
  const { code, err } = invoke(['schemas']);
  t.is(code, ExitCode.USAGE);
  t.true(err.join('\n').includes('USAGE_NO_SUBCOMMAND'));
});

test('doctor --help describes what it will check without running anything', t => {
  const { code, out } = invoke(['doctor', '--help']);
  t.is(code, ExitCode.OK);
  const text = out.join('\n');
  t.true(text.includes('Release 2'));
  t.true(text.includes('will not submit transactions'));
});

test('doctor reports honestly that it is not implemented', t => {
  const { code, envelope } = invokeJson(['doctor']);
  t.is(code, ExitCode.OK);
  t.is((envelope.data as { implemented: boolean }).implemented, false);
});

// --- config precedence ----------------------------------------------------

test('with nothing configured, the defaults are local', t => {
  const { envelope } = invokeJson(['config', 'show']);
  const config = (envelope.data as { config: Record<string, unknown> }).config;
  t.is(config.network, 'local');
  t.is(config.chainId, networks.local.chainId);
  t.is(config.rpc, networks.local.rpc);
  t.is(config.walletAddress, null);
});

test('the project file beats the user file', t => {
  const { envelope } = invokeJson(['config', 'show'], {
    files: {
      [USER_CONFIG]: JSON.stringify({ network: 'mainnet' }),
      [PROJECT_CONFIG]: JSON.stringify({ network: 'devnet' }),
    },
  });
  const data = envelope.data as {
    config: Record<string, unknown>;
    provenance: Record<string, string>;
  };
  t.is(data.config.network, 'devnet');
  t.is(data.provenance.network, 'project file');
});

test('the environment beats both files', t => {
  const { envelope } = invokeJson(['config', 'show'], {
    files: {
      [USER_CONFIG]: JSON.stringify({ network: 'mainnet' }),
      [PROJECT_CONFIG]: JSON.stringify({ network: 'devnet' }),
    },
    env: { AAT_NETWORK: 'emerynet' },
  });
  const data = envelope.data as {
    config: Record<string, unknown>;
    provenance: Record<string, string>;
  };
  t.is(data.config.network, 'emerynet');
  t.is(data.provenance.network, 'environment');
});

test('flags beat everything', t => {
  const { envelope } = invokeJson(['config', 'show', '--network', 'mainnet'], {
    files: {
      [USER_CONFIG]: JSON.stringify({ network: 'devnet' }),
      [PROJECT_CONFIG]: JSON.stringify({ network: 'devnet' }),
    },
    env: { AAT_NETWORK: 'emerynet' },
  });
  const data = envelope.data as {
    config: Record<string, unknown>;
    provenance: Record<string, string>;
  };
  t.is(data.config.network, 'mainnet');
  t.is(data.provenance.network, 'flags');
});

test('the full precedence chain, one key per layer', t => {
  const { envelope } = invokeJson(
    ['config', 'show', '--wallet-address', 'agoric1flag'],
    {
      files: {
        [USER_CONFIG]: JSON.stringify({ api: 'https://user.example/api' }),
        [PROJECT_CONFIG]: JSON.stringify({ rpc: 'https://project.example/rpc' }),
      },
      env: { AAT_CHAIN_ID: 'agoricdev-99' },
    },
  );
  const data = envelope.data as {
    config: Record<string, unknown>;
    provenance: Record<string, string>;
  };
  t.is(data.config.network, 'local');
  t.is(data.provenance.network, 'defaults');
  t.is(data.config.api, 'https://user.example/api');
  t.is(data.provenance.api, 'user file');
  t.is(data.config.rpc, 'https://project.example/rpc');
  t.is(data.provenance.rpc, 'project file');
  t.is(data.config.chainId, 'agoricdev-99');
  t.is(data.provenance.chainId, 'environment');
  t.is(data.config.walletAddress, 'agoric1flag');
  t.is(data.provenance.walletAddress, 'flags');
});

test('selecting a network seeds the endpoints it did not set explicitly', t => {
  const { envelope } = invokeJson(['config', 'show', '--network', 'devnet']);
  const data = envelope.data as {
    config: Record<string, unknown>;
    provenance: Record<string, string>;
  };
  t.is(data.config.rpc, networks.devnet.rpc);
  t.is(data.config.chainId, networks.devnet.chainId);
  t.is(data.provenance.rpc, "network 'devnet'");
});

test('an explicit endpoint survives a network chosen alongside it', t => {
  const { envelope } = invokeJson([
    'config',
    'show',
    '--network',
    'mainnet',
    '--rpc',
    'http://0.0.0.0:26657',
  ]);
  const config = (envelope.data as { config: Record<string, unknown> }).config;
  t.is(config.network, 'mainnet');
  t.is(config.rpc, 'http://0.0.0.0:26657');
  // The other three still come from mainnet.
  t.is(config.chainId, networks.mainnet.chainId);
  t.is(config.api, networks.mainnet.api);
});

test('a network chosen in a higher layer overrides an endpoint from a lower one', t => {
  // This is the rule worth pinning: --network is the more specific statement of
  // intent, so it wins over an rpc set in a file, but not over an rpc set
  // alongside it.
  const { envelope } = invokeJson(['config', 'show', '--network', 'mainnet'], {
    files: { [PROJECT_CONFIG]: JSON.stringify({ rpc: 'https://stale.example' }) },
  });
  const config = (envelope.data as { config: Record<string, unknown> }).config;
  t.is(config.rpc, 'https://stale.example');
  t.is(config.chainId, networks.mainnet.chainId);
});

test('--config replaces the project file', t => {
  const { envelope } = invokeJson(
    ['config', 'show', '--config', '/elsewhere/other.json'],
    {
      files: {
        [PROJECT_CONFIG]: JSON.stringify({ network: 'devnet' }),
        '/elsewhere/other.json': JSON.stringify({ network: 'mainnet' }),
      },
    },
  );
  const config = (envelope.data as { config: Record<string, unknown> }).config;
  t.is(config.network, 'mainnet');
});

test('AAT_JSON turns on the envelope without the flag', t => {
  const { out } = invoke(['schemas', 'list'], { env: { AAT_JSON: 'true' } });
  t.notThrows(() => {
    JSON.parse(out.join('\n'));
  });
});

test('AAT_JSON with an unrecognised value is an error, not a silent false', t => {
  const { code, err } = invoke(['config', 'show'], { env: { AAT_JSON: 'off' } });
  t.is(code, ExitCode.ENVIRONMENT);
  t.true(err.join('\n').includes('CONFIG_BAD_VALUE'));
});

test('an unknown config key is rejected rather than ignored', t => {
  const { code, err } = invoke(['config', 'show'], {
    files: { [PROJECT_CONFIG]: JSON.stringify({ rpcAddr: 'https://example' }) },
  });
  t.is(code, ExitCode.ENVIRONMENT);
  const text = err.join('\n');
  t.true(text.includes('CONFIG_UNKNOWN_KEY'));
  t.true(text.includes('rpcAddr'));
});

test('a config file of the wrong shape is rejected', t => {
  const { code, err } = invoke(['config', 'show'], {
    files: { [PROJECT_CONFIG]: '[]' },
  });
  t.is(code, ExitCode.ENVIRONMENT);
  t.true(err.join('\n').includes('CONFIG_MALFORMED'));
});

test('a missing config file is not an error', t => {
  const { code } = invoke(['config', 'show'], { files: {} });
  t.is(code, ExitCode.OK);
});

// --- argument splitting ---------------------------------------------------

test('a string flag value before the subcommand is not mistaken for it', t => {
  const { code, envelope } = invokeJson(['--network', 'devnet', 'config', 'show']);
  t.is(code, ExitCode.OK);
  const config = (envelope.data as { config: Record<string, unknown> }).config;
  t.is(config.network, 'devnet');
});

test('run takes its authority as an argument', t => {
  // Not a proof, but the place someone would be tempted: nothing reaches
  // process, the filesystem or the clock except through the powers object, and
  // these tests pass no real ones.
  const { powers, out } = makePowers(['--version'], { version: '4.5.6' });
  run(powers);
  t.deepEqual(out, ['4.5.6']);
});
