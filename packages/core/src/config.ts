// SPDX-License-Identifier: Apache-2.0

import { AatError } from './errors.js';
import { isNetworkName, networks, requireNetwork } from './networks.js';
import type { NetworkName } from './networks.js';

/** The configuration every subcommand can rely on having. */
export type AatConfig = {
  readonly network: NetworkName;
  readonly rpc: string;
  readonly api: string;
  readonly vstorage: string;
  readonly chainId: string;
  readonly walletAddress: string | null;
  readonly output: { readonly json: boolean };
};

/** What any one layer is allowed to say. Every key is optional. */
export type PartialConfig = {
  network?: NetworkName;
  rpc?: string;
  api?: string;
  vstorage?: string;
  chainId?: string;
  walletAddress?: string;
  output?: { json?: boolean };
};

/**
 * One layer of configuration, with a human-readable note about where it came
 * from. The source string ends up in `aat config show` and in error messages,
 * so it should be something the reader can act on: a path, not "file".
 */
export type ConfigLayer = {
  readonly source: string;
  readonly values: PartialConfig;
};

/** Which layer supplied each key of the resolved config. */
export type Provenance = Readonly<Record<string, string>>;

export type ResolvedConfig = {
  readonly config: AatConfig;
  readonly provenance: Provenance;
};

/**
 * The layer order, lowest precedence first. Plan §1.3:
 * defaults → ~/.aat/config.json → ./.aat.json → env vars → flags.
 *
 * Exported because the CLI builds its layers in this order and the tests assert
 * on it; nobody should be encoding the order twice.
 */
export const LAYER_ORDER = harden([
  'defaults',
  'user file',
  'project file',
  'environment',
  'flags',
] as const);

export type LayerName = (typeof LAYER_ORDER)[number];

/** The network used when nothing selects one. */
export const DEFAULT_NETWORK: NetworkName = 'local';

const CONFIG_KEYS = harden([
  'network',
  'rpc',
  'api',
  'vstorage',
  'chainId',
  'walletAddress',
  'output',
] as const);

const requireString = (value: unknown, key: string, source: string): string => {
  if (typeof value !== 'string' || value === '') {
    throw new AatError(
      'CONFIG_BAD_VALUE',
      `${source}: '${key}' must be a non-empty string, got ${JSON.stringify(value)}`,
    );
  }
  return value;
};

/**
 * Validate one parsed JSON object into a `PartialConfig`.
 *
 * Unknown keys are rejected rather than ignored. A silently ignored key is how
 * someone spends an afternoon wondering why their `rpcAddr` setting does
 * nothing.
 */
export const parseConfigObject = (
  raw: unknown,
  source: string,
): PartialConfig => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new AatError(
      'CONFIG_MALFORMED',
      `${source}: expected a JSON object, got ${Array.isArray(raw) ? 'an array' : typeof raw}`,
    );
  }

  const values: PartialConfig = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('$')) continue; // comment convention, as in networks.json
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) {
      throw new AatError(
        'CONFIG_UNKNOWN_KEY',
        `${source}: unknown key '${key}'; known keys are ${CONFIG_KEYS.join(', ')}`,
      );
    }
    switch (key) {
      case 'network': {
        const name = requireString(value, key, source);
        if (!isNetworkName(name)) {
          throw new AatError(
            'CONFIG_UNKNOWN_NETWORK',
            `${source}: unknown network '${name}'`,
          );
        }
        values.network = name;
        break;
      }
      case 'output': {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new AatError(
            'CONFIG_BAD_VALUE',
            `${source}: 'output' must be an object, got ${JSON.stringify(value)}`,
          );
        }
        const output = value as Record<string, unknown>;
        for (const outputKey of Object.keys(output)) {
          if (outputKey !== 'json') {
            throw new AatError(
              'CONFIG_UNKNOWN_KEY',
              `${source}: unknown key 'output.${outputKey}'; the only output key is 'json'`,
            );
          }
        }
        if ('json' in output) {
          if (typeof output.json !== 'boolean') {
            throw new AatError(
              'CONFIG_BAD_VALUE',
              `${source}: 'output.json' must be a boolean, got ${JSON.stringify(output.json)}`,
            );
          }
          values.output = { json: output.json };
        }
        break;
      }
      case 'rpc':
      case 'api':
      case 'vstorage':
      case 'chainId':
      case 'walletAddress':
        values[key] = requireString(value, key, source);
        break;
      default:
        throw new AatError(
          'INTERNAL',
          `${source}: key '${key}' is in CONFIG_KEYS but has no parser`,
        );
    }
  }
  return values;
};

/**
 * Read a `PartialConfig` out of environment variables.
 *
 * `AAT_JSON` is a flag rather than a value: anything in `1`, `true`, `yes` (case
 * insensitive) turns it on, anything in `0`, `false`, `no` turns it off, and an
 * unset variable says nothing. A variable set to an unrecognised value is an
 * error rather than a silent `false`, because `AAT_JSON=off` quietly meaning
 * "on" is exactly the kind of thing that ruins an afternoon.
 */
export const configFromEnv = (
  env: Readonly<Record<string, string | undefined>>,
): PartialConfig => {
  const source = 'environment';
  const values: PartialConfig = {};

  const readString = (name: string) => {
    const raw = env[name];
    return raw === undefined || raw === '' ? undefined : raw;
  };

  const network = readString('AAT_NETWORK');
  if (network !== undefined) {
    if (!isNetworkName(network)) {
      throw new AatError(
        'CONFIG_UNKNOWN_NETWORK',
        `${source}: AAT_NETWORK is '${network}'; known networks are ${Object.keys(networks).join(', ')}`,
      );
    }
    values.network = network;
  }

  const rpc = readString('AAT_RPC');
  if (rpc !== undefined) values.rpc = rpc;
  const api = readString('AAT_API');
  if (api !== undefined) values.api = api;
  const vstorage = readString('AAT_VSTORAGE');
  if (vstorage !== undefined) values.vstorage = vstorage;
  const chainId = readString('AAT_CHAIN_ID');
  if (chainId !== undefined) values.chainId = chainId;
  const walletAddress = readString('AAT_WALLET_ADDRESS');
  if (walletAddress !== undefined) values.walletAddress = walletAddress;

  const json = readString('AAT_JSON');
  if (json !== undefined) {
    const normalised = json.toLowerCase();
    if (['1', 'true', 'yes'].includes(normalised)) {
      values.output = { json: true };
    } else if (['0', 'false', 'no'].includes(normalised)) {
      values.output = { json: false };
    } else {
      throw new AatError(
        'CONFIG_BAD_VALUE',
        `${source}: AAT_JSON is '${json}'; expected one of 1, true, yes, 0, false, no`,
      );
    }
  }

  return values;
};

/**
 * Fold the layers into one configuration, lowest precedence first.
 *
 * The one subtlety worth knowing: `network` is resolved across every layer
 * *first*, and the winning network seeds `rpc`, `api`, `vstorage` and
 * `chainId`. Only then are explicit endpoint values applied. So
 * `aat --network mainnet` in flags overrides an `rpc` set by a project file —
 * the network is the more specific statement of intent — while
 * `aat --network mainnet --rpc http://localhost:26657` keeps the explicit rpc,
 * because it is at the same precedence and endpoints are applied after.
 */
export const resolveConfig = (
  layers: readonly ConfigLayer[],
): ResolvedConfig => {
  const provenance: Record<string, string> = {};

  // Pass 1: the network, which decides the endpoint defaults.
  let network: NetworkName = DEFAULT_NETWORK;
  provenance.network = 'defaults';
  for (const layer of layers) {
    if (layer.values.network !== undefined) {
      network = layer.values.network;
      provenance.network = layer.source;
    }
  }

  const entry = requireNetwork(network);
  let rpc = entry.rpc;
  let api = entry.api;
  let vstorage = entry.vstorage;
  let chainId = entry.chainId;
  const networkSource = `network '${network}'`;
  provenance.rpc = networkSource;
  provenance.api = networkSource;
  provenance.vstorage = networkSource;
  provenance.chainId = networkSource;

  let walletAddress: string | null = null;
  provenance.walletAddress = 'defaults';
  let json = false;
  provenance['output.json'] = 'defaults';

  // Pass 2: everything else, in precedence order.
  for (const layer of layers) {
    const { values, source } = layer;
    if (values.rpc !== undefined) {
      rpc = values.rpc;
      provenance.rpc = source;
    }
    if (values.api !== undefined) {
      api = values.api;
      provenance.api = source;
    }
    if (values.vstorage !== undefined) {
      vstorage = values.vstorage;
      provenance.vstorage = source;
    }
    if (values.chainId !== undefined) {
      chainId = values.chainId;
      provenance.chainId = source;
    }
    if (values.walletAddress !== undefined) {
      walletAddress = values.walletAddress;
      provenance.walletAddress = source;
    }
    if (values.output?.json !== undefined) {
      json = values.output.json;
      provenance['output.json'] = source;
    }
  }

  return harden({
    config: {
      network,
      rpc,
      api,
      vstorage,
      chainId,
      walletAddress,
      output: { json },
    },
    provenance,
  });
};
