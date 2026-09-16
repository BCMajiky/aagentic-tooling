// SPDX-License-Identifier: Apache-2.0

import type { SerialisedPattern } from './patterns.js';

export const CONTRACT_MANIFEST_SCHEMA_ID = 'contract-manifest.v0';
export const CONTRACT_MANIFEST_VERSION = 'v0';

/**
 * How a facet states its interface.
 *
 * D2: format B accepts unguarded facets. Offer Up's public facet is a bare
 * `Far()` with no `M.interface` guard, and that is not a reason to drop it: it
 * is the contract every tutorial starts from, and a generator that fails on
 * `Far()` facets fails on most contracts in the wild.
 *
 * - `interface` — methods projected from an `M.interface` guard, with parameter
 *   and return patterns.
 * - `none` — method names only, taken from the object literal. Patterns are
 *   absent, and a consumer must not invent them.
 */
export type FacetGuard = 'interface' | 'none';

export const FACET_GUARDS: readonly FacetGuard[] = harden(['interface', 'none']);

/** `M.call` produces a synchronous guard; `M.callWhen` awaits its arguments. */
export type CallKind = 'call' | 'callWhen';

export type MethodEntry = {
  /** Absent when the facet's guard is `none`. */
  readonly callKind?: CallKind;
  /** Required positional parameters. Absent when the guard is `none`. */
  readonly params?: readonly SerialisedPattern[];
  /** Parameters declared with `.optional(...)`. */
  readonly optionalParams?: readonly SerialisedPattern[];
  /** The `.rest(...)` pattern, when there is one. */
  readonly restParams?: SerialisedPattern;
  /** The `.returns(...)` pattern. Absent when the guard is `none`. */
  readonly returns?: SerialisedPattern;
  /** One line of prose. The only member a human writes by hand. */
  readonly summary?: string;
};

export type Facet = {
  readonly guard: FacetGuard;
  /**
   * The `M.interface` label, or the `Far` tag for an unguarded facet. Worth
   * carrying either way: it is what appears in runtime error messages.
   */
  readonly label?: string;
  readonly methods: Readonly<Record<string, MethodEntry>>;
};

/**
 * What an invitation's proposal must look like.
 *
 * Two forms, and a manifest uses exactly one of them.
 *
 * The **projected** form — `give`, `want`, `exit`, `open` — is for the common
 * case where the proposal shape names its keywords, as Offer Up's does with
 * `Price` and `Items`. It is what a client or a generator wants to read.
 *
 * The **raw** form — `shape` — carries the serialised proposal shape whole, for
 * the case where there are no fixed keywords to project. send-anywhere's shape
 * is `M.splitRecord({ give: SingleNatAmountRecord })`, which says "exactly one
 * give keyword, whatever it is called, holding any nat amount". Projecting that
 * into a keyword map would mean inventing a keyword.
 *
 * Both together is rejected: they would be two statements that can disagree.
 */
export type ProposalShape =
  | {
      readonly give?: Readonly<Record<string, SerialisedPattern>>;
      readonly want?: Readonly<Record<string, SerialisedPattern>>;
      readonly exit?: SerialisedPattern;
      /** True when the shape permits keywords beyond those listed. */
      readonly open?: boolean;
      readonly shape?: never;
    }
  | { readonly shape: SerialisedPattern };

export type Invitation = {
  /** The description string passed to `zcf.makeInvitation`. */
  readonly description: string;
  /** Which facet method hands this invitation out. */
  readonly maker: string;
  readonly proposal?: ProposalShape;
  readonly offerArgs?: SerialisedPattern;
  readonly summary?: string;
};

export type PublishedPath = {
  /** A vstorage path, with `{placeholders}` for the variable segments. */
  readonly path: string;
  readonly valueSchema?: SerialisedPattern;
  readonly summary?: string;
};

export type ContractIdentity = {
  readonly name: string;
  readonly version: string;
  /** The `b1-...` bundle id, or null when the contract has not been bundled. */
  readonly bundleId: string | null;
  /** Where the source came from, for anything copied from upstream. */
  readonly source?: {
    readonly repo: string;
    readonly commit: string;
    readonly path: string;
  };
};

/**
 * A contract interface manifest: a machine-readable description of what a
 * contract does, what it accepts, and what it publishes.
 *
 * The non-negotiable principle from plan §1.5 is that the manifest is *derived*
 * from what the contract already declares, not written alongside it. Stage 0
 * delivers the format only; the generator that reads guards and produces these
 * is Release 6. Hand-authoring two of them first is how we find out whether the
 * format is sufficient before investing in a generator.
 */
export type ContractManifest = {
  readonly schema: typeof CONTRACT_MANIFEST_SCHEMA_ID;
  readonly contract: ContractIdentity;
  readonly facets: Readonly<Record<string, Facet>>;
  readonly invitations: Readonly<Record<string, Invitation>>;
  readonly published: readonly PublishedPath[];
  readonly terms: Readonly<Record<string, SerialisedPattern>>;
  readonly privateArgs: Readonly<Record<string, SerialisedPattern>>;
  /** Trace event kinds this contract emits. Links format B to format A. */
  readonly traces?: readonly string[];
  /** Free prose. The one place a human is expected to write for a human. */
  readonly notes?: readonly string[];
};

export type ManifestIssue = {
  readonly path: string;
  readonly code: string;
  readonly message: string;
};

export type ManifestValidationResult =
  | { readonly valid: true; readonly manifest: ContractManifest }
  | { readonly valid: false; readonly issues: readonly ManifestIssue[] };
