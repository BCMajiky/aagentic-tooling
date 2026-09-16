// SPDX-License-Identifier: Apache-2.0

export { GLOBAL_FLAGS, buildLayers, registry, run, splitAtSubcommand } from './run.js';
export type { CliPowers } from './run.js';

export { makeRegistry } from './registry.js';
export type { CommandContext, Registry, Subcommand } from './registry.js';

export { booleanFlag, parseArgs, stringFlag } from './args.js';

export { generatedSections, renderInto } from './agents-doc.js';
export type { GeneratedSection } from './agents-doc.js';
export type { FlagKind, FlagSpec, FlagSpecs, ParsedArgs } from './args.js';
