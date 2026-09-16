// SPDX-License-Identifier: Apache-2.0

/**
 * The serialised subset of the `@endo/patterns` vocabulary.
 *
 * STAGE0-BRIEF.md, "Format B notes": cover the subset actually seen in the two
 * subjects and in `agoric-sdk-u23/packages/zoe/src/typeGuards.js`, list the
 * supported vocabulary in the spec, and **reject anything outside it rather
 * than guessing**. Guessing is the failure mode that matters: a manifest that
 * silently renders an unknown pattern as `any` tells a code generator that a
 * method accepts anything, which is worse than telling it nothing.
 *
 * Every kind below was counted in one of those three sources. The counts from
 * `zoe/src/typeGuards.js` at cc25a29 are in the comments, so that adding a kind
 * is a decision someone has to justify rather than a reflex.
 */
export const PATTERN_KINDS = harden([
  // --- leaves ---
  'any', // M.any(), 16 in zoe typeGuards
  'string', // M.string(), 26
  'boolean', // M.boolean(), 1
  'bigint', // M.bigint(), offer-up meta.customTermsShape
  'scalar', // M.scalar(), send-anywhere.flows.js offerArgs
  'error', // M.error(), 1
  'pattern', // M.pattern(), 8 — "any pattern", used for proposalShape params
  'bag', // M.bag(), offer-up want.Items.value
  'literal', // a bare value used as a pattern, e.g. M.not(harden({}))

  // --- references ---
  'remotable', // M.remotable('Brand'), 23
  'ref', // a named shape imported from elsewhere, e.g. InvitationShape

  // --- wrappers ---
  'promise', // M.promise(), 19
  'eref', // M.eref(x), 16
  'opt', // M.opt(x), 3
  'await', // M.await(x), 8 — only valid inside a method guard's params
  'not', // M.not(x), send-anywhere SingleNatAmountRecord

  // --- collections ---
  'record', // M.record(), 4 — any copyRecord
  'exactRecord', // a plain object literal used as a pattern
  'splitRecord', // M.splitRecord({...}, {...}, rest), 14
  'recordOf', // M.recordOf(k, v, limits), 8
  'arrayOf', // M.arrayOf(x, limits), 6

  // --- combinators ---
  'or', // M.or(...), 2
  'and', // M.and(...), 1

  // --- comparison ---
  // Only `gte`. The rest of the family (lt, lte, gt) is deliberately absent:
  // M.gte is the one the two subjects use, and the brief says to reject what
  // is outside the observed vocabulary rather than guess at it. Adding the
  // siblings is an additive v0.1 change whenever a real contract needs them.
  'gte', // M.gte(tradePrice), offer-up proposalShape give.Price
] as const);

export type PatternKind = (typeof PATTERN_KINDS)[number];

export const isPatternKind = (value: unknown): value is PatternKind =>
  typeof value === 'string' &&
  (PATTERN_KINDS as readonly string[]).includes(value);

/**
 * Kinds that are only meaningful inside a method guard's parameter list.
 * `M.await` in a return position is not a thing, and a manifest that claims it
 * is would mislead a generator.
 */
export const PARAM_ONLY_KINDS: readonly PatternKind[] = harden(['await']);

/** Which extra members each kind carries. */
export const PATTERN_MEMBERS: Readonly<
  Record<PatternKind, readonly string[]>
> = harden({
  any: [],
  string: [],
  boolean: [],
  bigint: [],
  scalar: [],
  error: [],
  pattern: [],
  bag: [],
  literal: ['value'],
  remotable: ['label'],
  ref: ['name', 'module'],
  promise: [],
  eref: ['of'],
  opt: ['of'],
  await: ['of'],
  not: ['of'],
  record: [],
  exactRecord: ['entries'],
  splitRecord: ['required', 'optional', 'rest'],
  recordOf: ['keys', 'values', 'limits'],
  arrayOf: ['items', 'limits'],
  or: ['of'],
  and: ['of'],
  gte: ['of'],
});

/** Members that may be omitted. */
export const OPTIONAL_MEMBERS: Readonly<
  Partial<Record<PatternKind, readonly string[]>>
> = harden({
  ref: ['module'],
  splitRecord: ['required', 'optional', 'rest'],
  recordOf: ['limits'],
  arrayOf: ['limits'],
});

/** A serialised pattern. */
export type SerialisedPattern =
  | { kind: 'any' | 'string' | 'boolean' | 'bigint' | 'scalar' | 'error' | 'pattern' | 'bag' | 'promise' | 'record' }
  | { kind: 'literal'; value: unknown }
  | { kind: 'remotable'; label: string }
  | { kind: 'ref'; name: string; module?: string }
  | { kind: 'eref' | 'opt' | 'await' | 'not' | 'gte'; of: SerialisedPattern }
  | { kind: 'or' | 'and'; of: readonly SerialisedPattern[] }
  | { kind: 'exactRecord'; entries: Readonly<Record<string, SerialisedPattern>> }
  | {
      kind: 'splitRecord';
      required?: Readonly<Record<string, SerialisedPattern>>;
      optional?: Readonly<Record<string, SerialisedPattern>>;
      rest?: SerialisedPattern;
    }
  | {
      kind: 'recordOf';
      keys: SerialisedPattern;
      values: SerialisedPattern;
      limits?: Readonly<Record<string, number>>;
    }
  | {
      kind: 'arrayOf';
      items: SerialisedPattern;
      limits?: Readonly<Record<string, number>>;
    };
