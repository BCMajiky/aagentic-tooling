// SPDX-License-Identifier: Apache-2.0

import {
  AatError,
  ExitCode,
  asAatError,
  configFromEnv,
  fromError,
  ok,
  parseConfigObject,
  renderHuman,
  renderJson,
  resolveConfig,
} from '@dcfoundation/aat-core';
import type {
  CommandResult,
  ConfigLayer,
  ExitCodeValue,
  PartialConfig,
} from '@dcfoundation/aat-core';

import { booleanFlag, parseArgs, stringFlag } from './args.js';
import type { FlagSpecs } from './args.js';
import { makeRegistry } from './registry.js';
import type { Registry, Subcommand } from './registry.js';
import { configCommand } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { schemasCommand } from './commands/schemas.js';

/**
 * Everything the CLI is allowed to touch. `main.ts` is the only module that may
 * read ambient authority and fill this in (CLAUDE.md: "ambient authority stays
 * in CLI entrypoints").
 */
export type CliPowers = {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Read a file, or return undefined when it does not exist. */
  readonly readFileIfExists: (path: string) => string | undefined;
  /** `~/.aat/config.json`, resolved by the entrypoint. */
  readonly userConfigPath: string;
  /** `./.aat.json`, resolved by the entrypoint. */
  readonly projectConfigPath: string;
  /** The CLI's own version, read from its package.json by the entrypoint. */
  readonly version: string;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

/** Flags every subcommand accepts, and which also work before the subcommand. */
export const GLOBAL_FLAGS: FlagSpecs = harden({
  json: { kind: 'boolean', summary: 'Emit the JSON envelope instead of human-readable output.' },
  help: { kind: 'boolean', summary: 'Show help for the command and exit.' },
  version: { kind: 'boolean', summary: 'Print the version and exit.' },
  network: { kind: 'string', summary: 'Network: local, devnet, emerynet or mainnet.' },
  rpc: { kind: 'string', summary: 'Override the Cosmos RPC endpoint.' },
  api: { kind: 'string', summary: 'Override the REST API endpoint.' },
  vstorage: { kind: 'string', summary: 'Override the vstorage query base.' },
  'chain-id': { kind: 'string', summary: 'Override the Cosmos chain id.' },
  'wallet-address': { kind: 'string', summary: 'The agoric1... address to act as.' },
  config: { kind: 'string', summary: 'Use this file as the project config instead of ./.aat.json.' },
});

export const registry: Registry = makeRegistry([
  configCommand,
  doctorCommand,
  schemasCommand,
]);

/**
 * Split `argv` at the subcommand name.
 *
 * Global flags are accepted on either side of it, so both `aat --json schemas
 * list` and `aat schemas list --json` work. Finding the split means walking the
 * global flags, because a string flag's value is a bare token that must not be
 * mistaken for the subcommand: in `aat --network devnet doctor`, `devnet` is a
 * value and `doctor` is the subcommand.
 */
export const splitAtSubcommand = (
  argv: readonly string[],
): { before: readonly string[]; name: string | undefined; after: readonly string[] } => {
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    if (token === undefined) break;

    if (!token.startsWith('--')) {
      return harden({
        before: argv.slice(0, index),
        name: token,
        after: argv.slice(index + 1),
      });
    }

    if (token === '--') break;

    const equals = token.indexOf('=');
    const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
    const spec = GLOBAL_FLAGS[name];
    // An unknown flag before the subcommand is reported by the real parse
    // below, not here; assume it takes no value so the scan can continue.
    const consumesValue = spec?.kind === 'string' && equals === -1;
    index += consumesValue ? 2 : 1;
  }
  return harden({ before: argv, name: undefined, after: [] });
};

const flagLayer = (parsed: ReturnType<typeof parseArgs>): PartialConfig => {
  const values: PartialConfig = {};
  const network = stringFlag(parsed, 'network');
  if (network !== undefined) {
    // Validated by parseConfigObject's sibling check in core; do it here so the
    // message names the flag rather than a file.
    const parsedNetwork = parseConfigObject({ network }, "flag '--network'");
    if (parsedNetwork.network !== undefined) values.network = parsedNetwork.network;
  }
  const rpc = stringFlag(parsed, 'rpc');
  if (rpc !== undefined) values.rpc = rpc;
  const api = stringFlag(parsed, 'api');
  if (api !== undefined) values.api = api;
  const vstorage = stringFlag(parsed, 'vstorage');
  if (vstorage !== undefined) values.vstorage = vstorage;
  const chainId = stringFlag(parsed, 'chain-id');
  if (chainId !== undefined) values.chainId = chainId;
  const walletAddress = stringFlag(parsed, 'wallet-address');
  if (walletAddress !== undefined) values.walletAddress = walletAddress;
  if (booleanFlag(parsed, 'json')) values.output = { json: true };
  return values;
};

const readConfigFile = (
  powers: CliPowers,
  path: string,
  layerName: string,
): PartialConfig | undefined => {
  const text = powers.readFileIfExists(path);
  if (text === undefined) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new AatError(
      'CONFIG_MALFORMED',
      `${layerName} (${path}): not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
  return parseConfigObject(raw, `${layerName} (${path})`);
};

/** Build the configuration layers, lowest precedence first. */
export const buildLayers = (
  powers: CliPowers,
  parsed: ReturnType<typeof parseArgs>,
): readonly ConfigLayer[] => {
  const layers: ConfigLayer[] = [];

  const userValues = readConfigFile(powers, powers.userConfigPath, 'user file');
  if (userValues) layers.push({ source: 'user file', values: userValues });

  const projectPath = stringFlag(parsed, 'config') ?? powers.projectConfigPath;
  const projectValues = readConfigFile(powers, projectPath, 'project file');
  if (projectValues) layers.push({ source: 'project file', values: projectValues });

  const envValues = configFromEnv(powers.env);
  if (Object.keys(envValues).length > 0) {
    layers.push({ source: 'environment', values: envValues });
  }

  const flagValues = flagLayer(parsed);
  if (Object.keys(flagValues).length > 0) {
    layers.push({ source: 'flags', values: flagValues });
  }

  return harden(layers);
};

const topLevelHelp = (): readonly string[] => {
  const lines = [
    'aat — developer tooling for the Agoric L1.',
    '',
    'Usage: aat [global flags] <subcommand> [arguments]',
    '',
    'Subcommands:',
  ];
  const commands = registry.list();
  const width = Math.max(...commands.map(c => c.name.length));
  for (const command of commands) {
    lines.push(`  ${command.name.padEnd(width)}  ${command.summary}`);
  }
  lines.push('', 'Global flags:');
  const flagNames = Object.keys(GLOBAL_FLAGS);
  const flagWidth = Math.max(...flagNames.map(n => n.length));
  for (const name of flagNames) {
    const spec = GLOBAL_FLAGS[name];
    if (spec) lines.push(`  --${name.padEnd(flagWidth)}  ${spec.summary}`);
  }
  lines.push(
    '',
    'Exit codes: 0 ok, 1 findings, 2 usage error, 3 environment error.',
    'Every subcommand supports --json.',
  );
  return harden(lines);
};

const subcommandHelp = (subcommand: Subcommand): readonly string[] => {
  const lines = [...(subcommand.help ?? [`Usage: aat ${subcommand.name}`])];
  const flags = subcommand.flags;
  if (flags && Object.keys(flags).length > 0) {
    lines.push('', 'Flags:');
    const names = Object.keys(flags);
    const width = Math.max(...names.map(n => n.length));
    for (const name of names) {
      const spec = flags[name];
      if (spec) lines.push(`  --${name.padEnd(width)}  ${spec.summary}`);
    }
  }
  return harden(lines);
};

/**
 * The CLI body. Returns the exit code; it never calls `process.exit`, so it is
 * testable and so buffered output is not truncated.
 */
export const run = (powers: CliPowers): ExitCodeValue => {
  // Output mode has to be decided before the first thing that can fail, so that
  // an error in argument parsing still respects --json.
  const wantsJson =
    powers.argv.includes('--json') ||
    powers.argv.includes('--json=true') ||
    ['1', 'true', 'yes'].includes((powers.env.AAT_JSON ?? '').toLowerCase());

  const body: string[] = [];
  const print = (line: string) => body.push(line);

  const emit = (result: CommandResult): ExitCodeValue => {
    if (wantsJson) {
      powers.stdout(renderJson(result));
    } else {
      for (const line of body) powers.stdout(line);
      for (const line of renderHuman(result)) {
        if (result.ok) powers.stdout(line);
        else powers.stderr(line);
      }
    }
    return result.code;
  };

  try {
    const { before, name, after } = splitAtSubcommand(powers.argv);

    if (name === undefined) {
      const globalArgs = parseArgs(before, GLOBAL_FLAGS);
      if (booleanFlag(globalArgs, 'version')) {
        print(powers.version);
        return emit(ok(harden({ version: powers.version })));
      }
      if (booleanFlag(globalArgs, 'help')) {
        for (const line of topLevelHelp()) print(line);
        return emit(ok(harden({ subcommands: registry.list().map(c => c.name) })));
      }
      throw new AatError('USAGE_NO_SUBCOMMAND', 'no subcommand given');
    }

    const subcommand = registry.require(name);
    const specs: FlagSpecs = harden({ ...GLOBAL_FLAGS, ...subcommand.flags });
    const parsed = parseArgs([...before, ...after], specs);

    if (booleanFlag(parsed, 'help')) {
      for (const line of subcommandHelp(subcommand)) print(line);
      return emit(ok(harden({ subcommand: subcommand.name, help: true })));
    }

    const { config, provenance } = resolveConfig(buildLayers(powers, parsed));

    const result = subcommand.run(
      harden({ args: parsed, config, provenance, print }),
    );
    return emit(result);
  } catch (thrown) {
    const error = asAatError(thrown);
    // Help is the right answer to a usage error, but only the pointer to it:
    // dumping the full help over the mistake buries it.
    if (error.exitCode === ExitCode.USAGE && !wantsJson) {
      body.length = 0;
    }
    return emit(fromError(error));
  }
};
