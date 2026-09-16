// SPDX-License-Identifier: Apache-2.0

import {
  ErrorCode,
  ExitCode,
  NETWORK_NAMES,
  exitCodeByError,
  hints,
  networks,
} from '@dcfoundation/aat-core';
import { formats } from '@dcfoundation/aat-schemas';

import { registry } from './run.js';

/**
 * The generated sections of `AGENTS.md`.
 *
 * Plan §1.6 asks for `AGENTS.md` at the root "kept in sync with the skill pack
 * by a test that fails if they diverge". The skill pack is Release 1, so there
 * is nothing to diverge *from* yet — but the thing that will diverge is already
 * here: the facts. Subcommand names, exit codes, error codes, hint text,
 * network names and registered formats all live in code, and a document that
 * restates them by hand goes stale the first time one changes.
 *
 * So AGENTS.md carries marked blocks rendered from this module, and a test
 * fails when the file and the code disagree. At Release 1 the skill pack
 * renders from the same function, which is what makes "the hints are the same
 * text the skill pack uses" true by construction rather than by diligence.
 */
export type GeneratedSection = {
  readonly id: string;
  readonly lines: readonly string[];
};

const table = (
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string[] => [
  `| ${headers.join(' | ')} |`,
  `|${headers.map(() => '---').join('|')}|`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
];

/** Escape a cell so a pipe in hint text cannot break the table. */
const cell = (text: string) => text.replace(/\|/g, '\\|');

export const generatedSections = (): readonly GeneratedSection[] =>
  harden([
    {
      id: 'subcommands',
      lines: table(
        ['Subcommand', 'What it does'],
        registry.list().map(command => [
          `\`aat ${command.name}\``,
          cell(command.summary),
        ]),
      ),
    },
    {
      id: 'exit-codes',
      lines: table(
        ['Code', 'Name', 'Meaning'],
        [
          [String(ExitCode.OK), '`OK`', 'Ran, nothing to report.'],
          [String(ExitCode.FINDINGS), '`FINDINGS`', 'Ran correctly and has findings. Not an error.'],
          [String(ExitCode.USAGE), '`USAGE`', 'The invocation was wrong: bad flag, missing argument.'],
          [String(ExitCode.ENVIRONMENT), '`ENVIRONMENT`', 'The world is wrong: unreachable endpoint, missing binary, bad config.'],
        ],
      ),
    },
    {
      id: 'formats',
      lines: table(
        ['Format', 'Version', 'What it describes'],
        formats.map(format => [
          `\`${format.name}\``,
          format.version,
          cell(format.summary),
        ]),
      ),
    },
    {
      id: 'networks',
      lines: table(
        ['Network', 'Chain id', 'Chain id rotates?'],
        NETWORK_NAMES.map(name => [
          `\`${name}\``,
          `\`${networks[name].chainId}\``,
          networks[name].chainIdRotates ? 'yes, verify against networkConfig' : 'no',
        ]),
      ),
    },
    {
      id: 'error-hints',
      lines: table(
        ['Code', 'Exit', 'What to do'],
        Object.values(ErrorCode).map(code => [
          `\`${code}\``,
          String(exitCodeByError[code]),
          cell(hints[code]),
        ]),
      ),
    },
  ]);

export const BEGIN = (id: string) => `<!-- BEGIN GENERATED: ${id} -->`;
export const END = (id: string) => `<!-- END GENERATED: ${id} -->`;

/**
 * Replace every marked block in `document` with freshly rendered content.
 * Throws when a section has no markers, because a section that silently fails
 * to render is exactly the drift this is meant to prevent.
 */
export const renderInto = (document: string): string => {
  let out = document;
  for (const section of generatedSections()) {
    const begin = BEGIN(section.id);
    const end = END(section.id);
    const startAt = out.indexOf(begin);
    const endAt = out.indexOf(end);
    if (startAt === -1 || endAt === -1 || endAt < startAt) {
      throw Error(
        `AGENTS.md has no '${section.id}' block; expected ${begin} ... ${end}`,
      );
    }
    out = `${out.slice(0, startAt + begin.length)}\n${section.lines.join('\n')}\n${out.slice(endAt)}`;
  }
  return out;
};
