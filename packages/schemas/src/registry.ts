// SPDX-License-Identifier: Apache-2.0

/**
 * One entry in the format registry. `aat schemas list` prints this table.
 */
export type FormatDescriptor = {
  /** Stable machine name, kebab-case, no version suffix. */
  readonly name: string;
  /** Schema version. Additive changes bump minor, breaking changes bump major. */
  readonly version: string;
  /** One line, human-readable. */
  readonly summary: string;
};

/**
 * Every format this repository defines.
 *
 * Adding a format is one entry here plus a schema file under `schemas/`; the
 * `schemas list` subcommand does not change. Day 4 adds `contract-manifest v0`.
 */
export const formats: readonly FormatDescriptor[] = harden([
  {
    name: 'trace-event',
    version: 'v0',
    summary:
      'Workflow trace events: an OpenTelemetry span with an Agoric attribute set.',
  },
]);
