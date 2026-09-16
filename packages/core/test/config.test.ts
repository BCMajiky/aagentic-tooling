// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import {
  DEFAULT_NETWORK,
  LAYER_ORDER,
  configFromEnv,
  parseConfigObject,
  resolveConfig,
} from '../src/config.js';
import type { ConfigLayer } from '../src/config.js';
import { NETWORK_NAMES, networks } from '../src/networks.js';
import { isAatError } from '../src/errors.js';

const layer = (source: string, values: ConfigLayer['values']): ConfigLayer =>
  harden({ source, values });

// --- the resolver, independent of any I/O ---------------------------------

test('with no layers at all, everything comes from the default network', t => {
  const { config, provenance } = resolveConfig([]);
  t.is(config.network, DEFAULT_NETWORK);
  t.is(config.rpc, networks[DEFAULT_NETWORK].rpc);
  t.is(config.chainId, networks[DEFAULT_NETWORK].chainId);
  t.is(config.walletAddress, null);
  t.false(config.output.json);
  t.is(provenance.network, 'defaults');
  t.is(provenance.rpc, `network '${DEFAULT_NETWORK}'`);
});

test('later layers win, key by key', t => {
  const { config, provenance } = resolveConfig([
    layer('user file', { rpc: 'https://one', api: 'https://a' }),
    layer('project file', { rpc: 'https://two' }),
  ]);
  t.is(config.rpc, 'https://two');
  t.is(provenance.rpc, 'project file');
  t.is(config.api, 'https://a');
  t.is(provenance.api, 'user file');
});

test('the resolved network seeds endpoints before explicit values apply', t => {
  const { config } = resolveConfig([
    layer('project file', { network: 'devnet' }),
    layer('flags', { rpc: 'http://0.0.0.0:26657' }),
  ]);
  t.is(config.rpc, 'http://0.0.0.0:26657');
  t.is(config.api, networks.devnet.api);
  t.is(config.chainId, networks.devnet.chainId);
});

test('a network in the last layer still seeds endpoints set in an earlier one', t => {
  // The network is resolved in its own pass, so ordering between "network here"
  // and "rpc there" does not change which endpoints the network contributes.
  const { config } = resolveConfig([
    layer('project file', { rpc: 'https://explicit' }),
    layer('flags', { network: 'mainnet' }),
  ]);
  t.is(config.network, 'mainnet');
  t.is(config.rpc, 'https://explicit');
  t.is(config.api, networks.mainnet.api);
});

test('the layer order is the one the plan specifies', t => {
  t.deepEqual(
    [...LAYER_ORDER],
    ['defaults', 'user file', 'project file', 'environment', 'flags'],
  );
});

test('the resolved config is hardened', t => {
  const { config } = resolveConfig([]);
  t.true(Object.isFrozen(config));
  t.throws(() => {
    (config as unknown as { network: string }).network = 'mainnet';
  });
});

// --- parsing a config object ----------------------------------------------

test('a valid object parses to exactly what it said', t => {
  const values = parseConfigObject(
    { network: 'devnet', rpc: 'https://r', output: { json: true } },
    'test',
  );
  t.deepEqual(values, {
    network: 'devnet',
    rpc: 'https://r',
    output: { json: true },
  });
});

test('$-prefixed keys are comments and are skipped', t => {
  const values = parseConfigObject({ $comment: 'why', network: 'devnet' }, 'test');
  t.deepEqual(values, { network: 'devnet' });
});

test('an unknown key names itself and the keys that would have worked', t => {
  const error = t.throws(() => parseConfigObject({ rpcAddr: 'x' }, 'test'));
  t.true(isAatError(error));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_UNKNOWN_KEY');
  t.true(error?.message.includes('rpcAddr'));
  t.true(error?.message.includes('walletAddress'));
});

test('an unknown output key is rejected too', t => {
  const error = t.throws(() => parseConfigObject({ output: { pretty: true } }, 'test'));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_UNKNOWN_KEY');
  t.true(error?.message.includes('output.pretty'));
});

test('a non-object is malformed, and the message says what it got', t => {
  for (const input of [[], 'a string', 42, null]) {
    const error = t.throws(() => parseConfigObject(input, 'test'));
    t.is(isAatError(error) ? error.code : undefined, 'CONFIG_MALFORMED');
  }
});

test('a wrongly typed value is a bad value, not a coercion', t => {
  const error = t.throws(() => parseConfigObject({ rpc: 26657 }, 'test'));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_BAD_VALUE');
});

test('an empty string is a bad value, not an override to nothing', t => {
  const error = t.throws(() => parseConfigObject({ rpc: '' }, 'test'));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_BAD_VALUE');
});

test('output.json must be a boolean', t => {
  const error = t.throws(() => parseConfigObject({ output: { json: 'yes' } }, 'test'));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_BAD_VALUE');
});

test('an unknown network names the ones that exist', t => {
  const error = t.throws(() => parseConfigObject({ network: 'testnet' }, 'test'));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_UNKNOWN_NETWORK');
});

test('the source string appears in every message, so the reader knows which file', t => {
  const error = t.throws(() =>
    parseConfigObject({ nope: 1 }, 'project file (/work/.aat.json)'),
  );
  t.true(error?.message.includes('/work/.aat.json'));
});

// --- the environment layer ------------------------------------------------

test('an empty environment says nothing', t => {
  t.deepEqual(configFromEnv({}), {});
});

test('an empty string says nothing, so an unset variable in CI is not an override', t => {
  t.deepEqual(configFromEnv({ AAT_RPC: '' }), {});
});

test('every config key has an environment variable', t => {
  const values = configFromEnv({
    AAT_NETWORK: 'devnet',
    AAT_RPC: 'https://r',
    AAT_API: 'https://a',
    AAT_VSTORAGE: 'https://v',
    AAT_CHAIN_ID: 'agoricdev-99',
    AAT_WALLET_ADDRESS: 'agoric1xyz',
    AAT_JSON: '1',
  });
  t.deepEqual(values, {
    network: 'devnet',
    rpc: 'https://r',
    api: 'https://a',
    vstorage: 'https://v',
    chainId: 'agoricdev-99',
    walletAddress: 'agoric1xyz',
    output: { json: true },
  });
});

test('AAT_JSON accepts the obvious spellings in either case', t => {
  for (const on of ['1', 'true', 'TRUE', 'yes', 'Yes']) {
    t.deepEqual(configFromEnv({ AAT_JSON: on }).output, { json: true }, on);
  }
  for (const off of ['0', 'false', 'FALSE', 'no', 'No']) {
    t.deepEqual(configFromEnv({ AAT_JSON: off }).output, { json: false }, off);
  }
});

test('AAT_JSON rejects anything else rather than defaulting to false', t => {
  const error = t.throws(() => configFromEnv({ AAT_JSON: 'off' }));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_BAD_VALUE');
});

test('AAT_NETWORK rejects an unknown network', t => {
  const error = t.throws(() => configFromEnv({ AAT_NETWORK: 'testnet' }));
  t.is(isAatError(error) ? error.code : undefined, 'CONFIG_UNKNOWN_NETWORK');
});

// --- networks.json --------------------------------------------------------

test('all four networks are present and hardened', t => {
  t.deepEqual([...NETWORK_NAMES], ['local', 'devnet', 'emerynet', 'mainnet']);
  t.true(Object.isFrozen(networks));
  for (const name of NETWORK_NAMES) {
    t.true(Object.isFrozen(networks[name]), name);
  }
});

test('every network has the endpoints a later tool will need', t => {
  for (const name of NETWORK_NAMES) {
    const entry = networks[name];
    t.is(typeof entry.chainId, 'string', name);
    t.true(entry.rpc.startsWith('http'), name);
    t.true(entry.api.startsWith('http'), name);
    t.true(entry.vstorage.startsWith('http'), name);
    t.is(typeof entry.chainIdRotates, 'boolean', name);
  }
});

test('the testnets are marked as having rotating chain ids', t => {
  // The chainId in networks.json is last-known, not durable. Anything that
  // actually talks to these chains has to fetch networkConfig and verify.
  t.true(networks.devnet.chainIdRotates);
  t.true(networks.emerynet.chainIdRotates);
  t.false(networks.local.chainIdRotates);
  t.false(networks.mainnet.chainIdRotates);
  t.is(typeof networks.devnet.networkConfig, 'string');
  t.is(typeof networks.emerynet.networkConfig, 'string');
});

test('devnet carries its pay denom, and mainnet deliberately does not', t => {
  t.is(networks.devnet.payDenom, 'ibc/toyusdc');
  t.is(networks.mainnet.payDenom, null);
});

test('mainnet is agoric-3 and local is agoriclocal', t => {
  t.is(networks.mainnet.chainId, 'agoric-3');
  t.is(networks.local.chainId, 'agoriclocal');
});
