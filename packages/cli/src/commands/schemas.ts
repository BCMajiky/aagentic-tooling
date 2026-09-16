// SPDX-License-Identifier: Apache-2.0

import { AatError, ok } from '@dcfoundation/aat-core';
import { formats } from '@dcfoundation/aat-schemas';

import type { Subcommand } from '../registry.js';

/**
 * `aat schemas list` — print the registered shared formats and their versions.
 *
 * Day 3 registers `trace-event v0` and day 4 `contract-manifest v0`; this
 * command does not change when they do, which is the point of the registry.
 */
export const schemasCommand: Subcommand = harden({
  name: 'schemas',
  summary: 'List the shared formats this build knows.',
  help: harden([
    'Usage: aat schemas list [--json]',
    '',
    'Prints each registered format with its version and a one-line summary.',
    'Formats are versioned additively: an additive change bumps the minor',
    'version, a breaking change bumps the major and the old schema file stays',
    'in the tree.',
  ]),
  run: ({ args, print }) => {
    const [action, ...rest] = args.positional;

    if (action === undefined) {
      throw new AatError(
        'USAGE_NO_SUBCOMMAND',
        "schemas needs an action; the only one is 'list'",
      );
    }
    if (action !== 'list') {
      throw new AatError(
        'USAGE_UNKNOWN_SUBCOMMAND',
        `unknown action 'schemas ${action}'; the only action is 'list'`,
      );
    }
    if (rest.length > 0) {
      throw new AatError(
        'USAGE_UNEXPECTED_ARGUMENT',
        `'schemas list' takes no arguments, got '${rest.join(' ')}'`,
      );
    }

    const data = harden({
      formats: formats.map(format => ({
        name: format.name,
        version: format.version,
        summary: format.summary,
      })),
    });

    if (formats.length === 0) {
      print('No formats registered yet.');
    } else {
      const width = Math.max(...formats.map(format => format.name.length));
      for (const format of formats) {
        print(
          `${format.name.padEnd(width)}  ${format.version}  ${format.summary}`,
        );
      }
    }

    return ok(data);
  },
});
