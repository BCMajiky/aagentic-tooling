// SPDX-License-Identifier: Apache-2.0

import { AatError, ok } from '@dcfoundation/aat-core';

import type { Subcommand } from '../registry.js';

const KEY_SUMMARIES: Readonly<Record<string, string>> = harden({
  network: 'Which network to talk to: local, devnet, emerynet or mainnet.',
  rpc: 'Cosmos RPC endpoint. Defaults from the selected network.',
  api: 'REST API endpoint. Defaults from the selected network.',
  vstorage: 'vstorage query base. Defaults from the selected network.',
  chainId: 'Cosmos chain id. Defaults from the selected network, but the testnet ids rotate.',
  walletAddress: 'The agoric1... address to act as. No default.',
  'output.json': 'Emit the JSON envelope instead of human-readable output.',
});

/**
 * `aat config show` and `aat config keys`.
 *
 * `show` exists because layered configuration is otherwise guesswork: it prints
 * not just the resolved value of every key but which layer supplied it, so
 * "why is it talking to devnet" has an answer that does not involve reading
 * four files in the right order.
 */
export const configCommand: Subcommand = harden({
  name: 'config',
  summary: 'Show the resolved configuration and where each value came from.',
  help: harden([
    'Usage: aat config show [--json]',
    '       aat config keys [--json]',
    '',
    'Configuration is layered, lowest precedence first:',
    '',
    '  defaults            built in, and from the selected network',
    '  user file           ~/.aat/config.json',
    '  project file        ./.aat.json, or the path given to --config',
    '  environment         AAT_NETWORK, AAT_RPC, AAT_API, AAT_VSTORAGE,',
    '                      AAT_CHAIN_ID, AAT_WALLET_ADDRESS, AAT_JSON',
    '  flags               --network, --rpc, --api, --vstorage, --chain-id,',
    '                      --wallet-address, --json',
    '',
    'The selected network seeds rpc, api, vstorage and chainId before any',
    'explicit endpoint value is applied, so --network mainnet overrides an rpc',
    'set in a lower layer, while --network mainnet --rpc http://localhost:26657',
    'keeps the explicit rpc.',
  ]),
  run: ({ args, config, provenance, print }) => {
    const [action, ...rest] = args.positional;

    if (action === undefined) {
      throw new AatError(
        'USAGE_NO_SUBCOMMAND',
        "config needs an action; try 'show' or 'keys'",
      );
    }
    if (action !== 'show' && action !== 'keys') {
      throw new AatError(
        'USAGE_UNKNOWN_SUBCOMMAND',
        `unknown action 'config ${action}'; the actions are 'show' and 'keys'`,
      );
    }
    if (rest.length > 0) {
      throw new AatError(
        'USAGE_UNEXPECTED_ARGUMENT',
        `'config ${action}' takes no arguments, got '${rest.join(' ')}'`,
      );
    }

    if (action === 'keys') {
      const width = Math.max(...Object.keys(KEY_SUMMARIES).map(k => k.length));
      for (const [key, summary] of Object.entries(KEY_SUMMARIES)) {
        print(`${key.padEnd(width)}  ${summary}`);
      }
      return ok(harden({ keys: { ...KEY_SUMMARIES } }));
    }

    const rows: Array<[string, string]> = [
      ['network', config.network],
      ['rpc', config.rpc],
      ['api', config.api],
      ['vstorage', config.vstorage],
      ['chainId', config.chainId],
      ['walletAddress', config.walletAddress ?? '(unset)'],
      ['output.json', String(config.output.json)],
    ];
    const width = Math.max(...rows.map(([key]) => key.length));
    for (const [key, value] of rows) {
      print(`${key.padEnd(width)}  ${value}  [${provenance[key] ?? 'defaults'}]`);
    }

    return ok(
      harden({
        config: {
          network: config.network,
          rpc: config.rpc,
          api: config.api,
          vstorage: config.vstorage,
          chainId: config.chainId,
          walletAddress: config.walletAddress,
          output: { json: config.output.json },
        },
        provenance: { ...provenance },
      }),
    );
  },
});
