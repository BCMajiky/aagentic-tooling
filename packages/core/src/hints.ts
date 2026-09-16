// SPDX-License-Identifier: Apache-2.0

import type { ErrorCodeValue } from './codes.js';

/**
 * What to do about each error, in one or two sentences.
 *
 * STAGE0-BRIEF.md: this map is the mechanism behind "hints are the same text
 * the skill pack uses". Release 1's error catalogue imports this module rather
 * than restating the advice, so a human reading a terminal, a model reading the
 * skill pack, and a script reading `--json` all get the same words. Change the
 * text here and every consumer changes with it.
 *
 * House style for a hint:
 *
 * - Say what to do, not what went wrong. The message already said that.
 * - Name the exact command, flag, file or value where there is one.
 * - Where a wrong answer looks like success, say so. Several of the chain
 *   hints exist only because the failure is silent.
 */
export const hints = harden({
  USAGE_UNKNOWN_SUBCOMMAND:
    'Run `aat --help` for the list of subcommands.',
  USAGE_NO_SUBCOMMAND:
    'Run `aat --help` for the list of subcommands, or `aat <subcommand> --help` for one of them.',
  USAGE_UNKNOWN_FLAG:
    'Run `aat <subcommand> --help` for the flags that subcommand accepts. Every subcommand also accepts `--json`.',
  USAGE_FLAG_NEEDS_VALUE:
    'Supply the value as `--flag value` or `--flag=value`.',
  USAGE_UNEXPECTED_ARGUMENT:
    'Run `aat <subcommand> --help` to see what that subcommand expects.',

  CONFIG_UNREADABLE:
    'Check the file exists and is readable. Configuration is optional: delete the file and `aat` falls back to the defaults for the selected network.',
  CONFIG_MALFORMED:
    'The file must be a JSON object. Validate it with `node --eval "JSON.parse(require(\'fs\').readFileSync(process.argv[1],\'utf8\'))" <file>`.',
  CONFIG_UNKNOWN_NETWORK:
    'Use one of `local`, `devnet`, `emerynet` or `mainnet`, or set `rpc`, `api` and `chainId` explicitly to point at something else.',
  CONFIG_UNKNOWN_KEY:
    'Run `aat config keys` for the keys this version understands. An unknown key is usually a typo or a key from a newer version.',
  CONFIG_BAD_VALUE:
    'Check the value against the type the key expects.',

  ENV_RPC_UNREACHABLE:
    'Check the endpoint with `curl <rpc>/status`. For a local chain, confirm it is running and that you are on the right port; the default is 26657.',
  ENV_BINARY_MISSING:
    'Install the missing binary and make sure it is on PATH. `agd` ships in the agoric-sdk Docker image if you do not want to build it.',
  ENV_NODE_VERSION:
    'Use Node ^22.11 or ^24.14. `nvm use` reads the .nvmrc in this repository.',

  CHAIN_BUNDLE_INSTALL_UNDERGASSED:
    'Reinstall with explicit `--gas 100000000`. `--gas auto` and lower fixed values return a success code and install nothing, so a transaction hash is not proof that the bundle landed.',
  CHAIN_BUNDLE_NOT_FOUND:
    'Query the chain for the bundle id before going further. A successful install transaction is not proof; the install silently fails when under-gassed.',
  CHAIN_PAYLOAD_TOO_LARGE:
    'Compress the bundle before installing. Public RPC rejects bodies over about 1MB with HTTP 413; a contract still over that compressed needs the multi-bundle install pattern.',
  CHAIN_ACCOUNT_SEQUENCE_MISMATCH:
    'The previous transaction is not in a block yet. Wait for the next block and retry.',
  CHAIN_DENOM_UNKNOWN:
    'List what the chain knows with `agd query vstorage data published.agoricNames.vbankAsset`. The pay denom differs per network — devnet is `ibc/toyusdc` — so keep it a contract term rather than hardcoding it.',

  INTERNAL:
    'This is a bug in aat. Please report it with the command you ran and the full output.',
} as const satisfies Record<ErrorCodeValue, string>);
