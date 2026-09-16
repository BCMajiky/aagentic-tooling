// SPDX-License-Identifier: Apache-2.0

import { AatError } from './errors.js';
import networksDoc from './networks.json' with { type: 'json' };

/** The four networks `aat` knows by name. */
export const NETWORK_NAMES = harden([
  'local',
  'devnet',
  'emerynet',
  'mainnet',
] as const);

export type NetworkName = (typeof NETWORK_NAMES)[number];

export type NetworkEntry = {
  readonly chainId: string;
  /**
   * True for the testnets, which are redeployed under a new chain id. When
   * this is set, `chainId` is last-known rather than durable and anything
   * talking to the chain must fetch `networkConfig` and verify.
   */
  readonly chainIdRotates: boolean;
  readonly rpc: string;
  readonly api: string;
  readonly vstorage: string;
  readonly networkConfig: string | null;
  /** The IBC denom used to pay on this network, where there is a default one. */
  readonly payDenom: string | null;
  readonly explorer: string | null;
  readonly note: string;
};

const entries = networksDoc.networks as Record<string, NetworkEntry>;

/** Every known network, keyed by name. */
export const networks: Readonly<Record<NetworkName, NetworkEntry>> = harden(
  Object.fromEntries(
    NETWORK_NAMES.map(name => [name, { ...entries[name] }]),
  ) as Record<NetworkName, NetworkEntry>,
);

/** True when `value` names a network `aat` knows. */
export const isNetworkName = (value: unknown): value is NetworkName =>
  typeof value === 'string' &&
  (NETWORK_NAMES as readonly string[]).includes(value);

/**
 * Look up a network by name, or throw a `CONFIG_UNKNOWN_NETWORK` carrying the
 * list of names that would have worked.
 */
export const requireNetwork = (name: string): NetworkEntry => {
  if (!isNetworkName(name)) {
    throw new AatError(
      'CONFIG_UNKNOWN_NETWORK',
      `unknown network '${name}'; known networks are ${NETWORK_NAMES.join(', ')}`,
    );
  }
  return networks[name];
};
