// SPDX-License-Identifier: Apache-2.0

import { ok } from '@dcfoundation/aat-core';

import type { Subcommand } from '../registry.js';

/**
 * `aat doctor` — a stub.
 *
 * STAGE0-BRIEF.md puts the implementation in Release 2 and only `--help` in
 * Stage 0. It is registered now so that the help text, the flags and the
 * config keys it will need are settled before anything is built on them, and
 * so `aat --help` shows the shape of the tool rather than growing a surprise.
 *
 * Running it without `--help` reports that it is not implemented, as a finding
 * rather than an error: nothing went wrong, there is just nothing here yet.
 */
export const doctorCommand: Subcommand = harden({
  name: 'doctor',
  summary: 'Check that this machine can build and deploy Agoric contracts. (Release 2)',
  flags: harden({
    network: {
      kind: 'string',
      summary: 'Which network to check against. One of local, devnet, emerynet, mainnet.',
    },
  }),
  help: harden([
    'Usage: aat doctor [--network <name>] [--json]',
    '',
    'Not implemented yet: doctor arrives in Release 2. This is a stub so that',
    'its interface is fixed before anything depends on it.',
    '',
    'What it will check:',
    '  - Node and yarn versions against the range this toolchain supports',
    '  - that agd is on PATH, and its version against the target network',
    '  - that the configured RPC endpoint answers, and at what block height',
    '  - that the chain id the endpoint reports matches the configured one,',
    '    which matters because the testnet chain ids rotate',
    '  - that the pay denom the target network expects is in vbankAsset',
    '',
    'It will not submit transactions or spend gas.',
  ]),
  run: ({ config, print }) => {
    print('doctor is not implemented yet; it arrives in Release 2.');
    print(`Configured network: ${config.network} (${config.chainId})`);
    print(`RPC: ${config.rpc}`);
    print('Run `aat doctor --help` for what it will check.');
    return ok(
      harden({
        implemented: false,
        release: 2,
        network: config.network,
        chainId: config.chainId,
        rpc: config.rpc,
      }),
    );
  },
});
