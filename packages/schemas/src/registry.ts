// SPDX-License-Identifier: Apache-2.0

/**
 * One entry in the format registry. `aat schemas list` (day 2) prints this
 * table; day 3 registers `trace-event v0` and day 4 registers
 * `contract-manifest v0`.
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
 * Every format this repository defines. Deliberately empty at the end of day 1:
 * the registry exists so that adding a format is a one-line change here plus a
 * schema file, and nothing else.
 */
export const formats: readonly FormatDescriptor[] = harden([]);
