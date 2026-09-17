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

/**
 * How a catalogue entry is recognised.
 *
 * - `literal`: the text appears verbatim in the error message.
 * - `regex`: a JavaScript regular expression source, matched against the
 *   message. Used where the message embeds values (paths, amounts, labels).
 * - `silent`: there is no error to match. The symptom is a hang, a code 0 with
 *   nothing moved, or a problem that only shows up later (at upgrade, at
 *   deploy, in review). These are the entries a model cannot self-correct
 *   from, which is why they are in the catalogue at all.
 */
export type CatalogueMatch =
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'regex'; readonly source: string }
  | { readonly kind: 'silent' };

/**
 * One entry of the Release 1 common-error catalogue (RELEASE1-BRIEF.md, "What
 * Release 1 builds"). `agoric-errors` renders from this list and the skill
 * pack's wrong snippets resolve to its codes, so a model reading a skill and a
 * human reading a terminal get the same words.
 *
 * `refs` holds pointers, in one of four forms:
 *
 * - a repository path, optionally with `#Lstart-Lend`
 * - `agoric-sdk@<commit>:<path>` for the pinned upstream clones
 * - `catalogue:<CODE>` for a related entry
 * - `sharp-edge:<n>` for `docs/context/agoric-devnet-sharp-edges.md` item n
 *
 * Codes are provisional until the v0.1 tag and are never reused after it.
 */
export interface CatalogueEntry {
  readonly code: string;
  readonly match: CatalogueMatch;
  readonly cause: string;
  readonly fix: string;
  readonly refs: readonly string[];
}

const literal = (text: string): CatalogueMatch => ({ kind: 'literal', text });
const regex = (source: string): CatalogueMatch => ({ kind: 'regex', source });
const silent: CatalogueMatch = { kind: 'silent' };

const BASELINE = 'docs/notes/baseline-2026-09/README.md';
const SKILLS = 'packages/skills/src';
const U23 = 'agoric-sdk@cc25a29';

export const catalogue: readonly CatalogueEntry[] = harden([
  // --- RELEASE1-BRIEF.md seed entries -------------------------------------
  {
    code: 'ZOE_EXPORTED_MISSING',
    // The brief seeded `Cannot find module '@agoric/zoe/exported.js'`. That is
    // not what the pinned toolchain says: bundle-source 4.1.2 builds the bundle
    // and evaluation fails with the text below (reproduced 2026-09-17; see
    // docs/context/claude_plan-amendments.md).
    match: regex(
      String.raw`Cannot find file for internal module "\./exported\.js".*@agoric/zoe/`,
    ),
    cause:
      '`@agoric/zoe/exported.js` does not exist at u23; older tutorials import it for its ambient types. The bundle still builds, so the failure appears when the bundle is evaluated: on chain the install succeeds and `startInstance` fails.',
    fix: 'Delete the import. Import `ZCF`, `OfferHandler` and friends as types from `@agoric/zoe` with a JSDoc `@import`.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L57-L60',
      'examples/offer-up/README.md',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
    ],
  },
  {
    code: 'ATOMIC_REARRANGE_HELPER',
    match: regex(
      String.raw`import\s*\{[^}]*\batomicRearrange\b[^}]*\}\s*from\s*'@agoric/zoe/src/contractSupport`,
    ),
    cause:
      'The `atomicRearrange(zcf, transfers)` helper from `@agoric/zoe/src/contractSupport` is deprecated at u23 and only forwards to the ZCF method. It works; it is the old idiom. Also a baseline output defect (task 1, Claude).',
    fix: 'Call `zcf.atomicRearrange(harden([...transfers]))` and drop the import.',
    refs: [
      `${U23}:packages/zoe/src/contractSupport/atomicTransfer.js#L47-L54`,
      `${U23}:packages/orchestration/src/utils/zoe-tools.js#L81`,
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'CUSTOM_TERMS_SHAPE_LOCATION',
    match: silent,
    cause:
      'A `customTermsShape` placed anywhere other than the exported `meta` is ignored, so terms are never validated. At u23 ZCF reads it from `meta` only, and checks it lazily inside `zcf.getTerms()`.',
    fix: 'Export `meta = harden({ customTermsShape })` from the contract module. A bad term then fails `zcf.getTerms()` with `customTerms: … - Must be …`. For a shape that is missing altogether, see CUSTOM_TERMS_SHAPE_MISSING.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L88-L94',
      `${U23}:packages/zoe/src/contractFacet/zcfZygote.js#L358-L368`,
      'catalogue:CUSTOM_TERMS_SHAPE_MISSING',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
    ],
  },
  {
    code: 'ENDO_MULTIPLE_SES',
    match: literal('TypeError: Cannot redefine property: sliceToImmutable'),
    cause:
      'More than one copy of `ses` is installed because `@endo/*` versions drifted from the SDK tree, so two lockdown shims run.',
    fix: 'Pin the whole `@endo/*` tree and `ses` through `resolutions`, copied from the u23 lockfile (`docs/PINS.md`). One line from `find node_modules -type d -path "*node_modules/ses"` means it is fixed.',
    refs: ['docs/PINS.md', `${SKILLS}/agoric-deploy/SKILL.md`],
  },
  {
    code: 'SES_HARNESS_ENDOWMENTS',
    match: silent,
    cause:
      'A contract fails under a local SES harness but runs on chain, because the harness endowed less than SwingSet gives a vat (for example no `assert`).',
    fix: 'Endow exactly what SwingSet endows: `console`, `assert`, `TextEncoder`, `TextDecoder`, `URL`. The harness is wrong, not the contract.',
    refs: ['scripts/ses-smoke.mjs'],
  },

  // --- baseline output defects (docs/notes/baseline-2026-09) ---------------
  {
    code: 'CONTRACT_NOT_UPGRADABLE',
    match: silent,
    cause:
      'The contract exports `start` returning `Far` facets over closure state, with no `meta.upgradability`, no durable zone and no exos. Zoe does not refuse an upgrade, but non-durable facets are abandoned and closure state is gone, so clients lose their references and funds held in closure seats are unreachable.',
    fix: "Export `meta = harden({ upgradability: 'canUpgrade' })`, take `baggage` as the third `start` argument, build a durable zone with `makeDurableZone(baggage)` and make facets with `zone.exo`.",
    refs: [
      `${U23}:packages/zoe/src/contracts/valueVow.contract.js#L9-L37`,
      `${U23}:packages/SwingSet/docs/vat-upgrade.md#L15`,
      `${SKILLS}/agoric-durable-state/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'CUSTOM_TERMS_SHAPE_MISSING',
    match: silent,
    cause:
      'The contract exports no `meta.customTermsShape` and checks terms by hand, or not at all. Malformed terms are accepted at `startInstance`.',
    fix: 'Export `meta = harden({ customTermsShape })`. If a shape exists but is not in `meta`, see CUSTOM_TERMS_SHAPE_LOCATION.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L88-L94',
      'catalogue:CUSTOM_TERMS_SHAPE_LOCATION',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'PROPOSAL_SHAPE_MISSING',
    match: silent,
    cause:
      '`zcf.makeInvitation` is called without a `proposalShape`, so Zoe escrows any proposal and the handler has to refuse bad ones by hand after escrow.',
    fix: 'Pass a `proposalShape` as the fourth argument. Zoe checks it before escrow (`zoeService/offer/offer.js`), and a bad offer fails with `"<description>" proposal: … - Must be: …`.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L126-L130',
      'examples/offer-up/src/offer-up.contract.js#L166-L167',
      `${U23}:packages/zoe/src/zoeService/offer/offer.js#L45-L60`,
      'catalogue:PROPOSAL_SHAPE_MISMATCH',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'TEST_BUNDLE_BYPASS',
    match: silent,
    cause:
      '`bundleAndInstall(moduleNamespace)` with an imported module instead of a path goes through `bundleTestExports`: the contract is never bundled or evaluated in a compartment, so a contract that cannot bundle still passes.',
    fix: 'Pass a file path: `bundleAndInstall(new URL("../src/x.contract.js", import.meta.url).pathname)`, or bundle with `@endo/bundle-source` and `E(zoe).install(bundle)`.',
    refs: [`${U23}:packages/zoe/tools/setup-zoe.js#L69-L84`, BASELINE, `${SKILLS}/agoric-testing/SKILL.md`],
  },
  {
    code: 'TEST_IMPORT_WORKAROUND',
    match: silent,
    cause:
      'Test modules loaded through top-level `await import()` after the test-environment import, a workaround for ENDO_ERRORS_BEFORE_SES that is unnecessary once the environment import is first and the workspace uses the node-modules linker.',
    fix: 'Import `@agoric/zoe/tools/prepare-test-env-ava.js` first, then use ordinary static imports.',
    refs: ['catalogue:ENDO_ERRORS_BEFORE_SES', BASELINE, `${SKILLS}/agoric-testing/SKILL.md`],
  },
  {
    code: 'TEST_TOOLS_REIMPLEMENTED',
    match: silent,
    cause:
      'The orchestration test tools (`setupOrchestrationTest`, network fakes, IBC mocks) were hand-ported into the project instead of imported, because they ship as TypeScript. The port drifts from upstream on every SDK bump.',
    fix: 'Import them from `@agoric/orchestration/tools/*.ts` with the `ts-blank-space` loader (see ORCH_TEST_TOOLS_TS).',
    refs: ['catalogue:ORCH_TEST_TOOLS_TS', BASELINE, `${SKILLS}/agoric-testing/SKILL.md`],
  },
  {
    code: 'TEST_HAND_MOCKED_ORCHESTRATOR',
    match: silent,
    cause:
      'Tests drive the flow through a hand-built orchestrator with `Far` fakes, bypassing `withOrchestration`, ChainHub, the real account exos and the IBC mocks. Everything passes under conditions no chain provides. The Servandum suites are the same mistake.',
    fix: 'Start the real contract with `setupOrchestrationTest` from `@agoric/orchestration/tools/contract-tests.ts` and drive acknowledgements and timeouts with its `transmitVTransferEvent`.',
    refs: [
      `${SKILLS}/agoric-testing/SKILL.md`,
      `${U23}:packages/orchestration/tools/contract-tests.ts`,
      'docs/context/agoric-devnet-sharp-edges.md',
      BASELINE,
    ],
  },
  {
    code: 'OFFER_RESULT_NOT_CONTINUING',
    match: silent,
    cause:
      'A flow returns an orchestration account object as the offer result. A smart-wallet user receives a remotable with nothing to act on. Idiom confirmed from upstream; wallet-side behaviour not run.',
    fix: 'Return `account.asContinuingOffer()` so the offerer gets `invitationMakers` for the account.',
    refs: [
      `${U23}:packages/orchestration/src/examples/basic-flows.flows.js#L34`,
      `${SKILLS}/agoric-orchestration/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'EXIT_WAIVED_NO_RECOVERY',
    match: silent,
    cause:
      'The proposal shape requires `exit: { waived: null }` and the contract has no recovery facet. If the flow never settles (ICA channel never opens, relayer down, a failed activation), the offerer can never exit and the funds cannot be recovered.',
    fix: 'Do not require a waived exit unless there is a recovery path. send-anywhere constrains only `give`.',
    refs: [
      'examples/send-anywhere/src/send-anywhere.contract.js#L131-L136',
      `${SKILLS}/agoric-orchestration/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'TEST_RAW_AVA',
    match: silent,
    cause:
      "A test file uses ava's own `test` (`import test from 'ava'`) with the SES environment loaded through ava's `require`. Lockdown runs, but the test function is not wrapped by `@endo/ses-ava`, so SES error reporting is lost.",
    fix: "Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js`, which is `wrapTest` from `@endo/ses-ava`.",
    refs: [`${U23}:packages/SwingSet/tools/prepare-test-env-ava.js`, BASELINE, `${SKILLS}/agoric-testing/SKILL.md`],
  },

  // --- errors hit during the baseline runs ---------------------------------
  {
    code: 'YARN_PNP_DEFAULT',
    match: regex(
      String.raw`EROFS: read-only filesystem, mkdir '/node_modules/bundles'|Your application tried to access @endo/\S+, but it isn't declared in your dependencies`,
    ),
    cause:
      "Yarn 4 with no `.yarnrc.yml` installs with Plug'n'Play. The Zoe test tools write bundles to a real `node_modules` path and SES tooling resolves real files, so both fail.",
    fix: 'Add `nodeLinker: node-modules` to `.yarnrc.yml` and run `yarn install` again.',
    refs: ['.yarnrc.yml#L1-L3', `${SKILLS}/agoric-deploy/SKILL.md`, BASELINE],
  },
  {
    code: 'ENDO_ERRORS_BEFORE_SES',
    match: literal(
      "Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'",
    ),
    cause:
      'A module that uses `@endo/errors` was evaluated before lockdown installed `assert`.',
    fix: 'Make the SES environment the first import (in tests, `@agoric/zoe/tools/prepare-test-env-ava.js`; in scripts, `@endo/init`).',
    refs: [`${SKILLS}/agoric-testing/SKILL.md`, BASELINE],
  },
  {
    code: 'VATDATA_UNAVAILABLE',
    match: literal('VatData unavailable'),
    cause:
      'Zoe or durable-state code ran under plain lockdown without the SwingSet test environment, which provides `VatData`.',
    fix: 'Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js` rather than setting up `@endo/init` yourself.',
    refs: [`${U23}:packages/SwingSet/tools/prepare-test-env-ava.js`, BASELINE, `${SKILLS}/agoric-testing/SKILL.md`],
  },
  {
    code: 'OFFER_SAFETY_VIOLATION',
    match: literal('Offer safety was violated by the proposed allocation'),
    cause:
      'A reallocation would leave a seat with neither what it wanted nor what it gave. Zoe refuses the whole rearrangement.',
    fix: 'Move the wanted amount to the seat (mint it, or transfer it from another seat) in the same `zcf.atomicRearrange` that takes its payment.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L143-L152',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'BUNDLE_UNDECLARED_DEP',
    match: regex(String.raw`Cannot find external module "[^"]+" in package`),
    cause:
      '`@endo/bundle-source` follows only the dependencies a package declares. A package that resolves in Node because it is hoisted into `node_modules` is still missing from the bundle.',
    fix: 'Declare every package the contract imports (typically `@endo/patterns`, `@endo/errors`, `@endo/far`) in `dependencies`, at the versions in `resolutions`.',
    refs: [
      'examples/send-anywhere/package.json',
      `${SKILLS}/agoric-deploy/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'PROPOSAL_SHAPE_MISMATCH',
    match: regex(String.raw`" proposal: .* - Must be`),
    cause:
      "The offer's proposal does not match the invitation's `proposalShape`. Zoe rejects it before escrow.",
    fix: 'Make the offer match the shape, or widen the shape if the contract really accepts that proposal.',
    refs: [
      `${U23}:packages/zoe/src/zoeService/offer/offer.js#L45-L49`,
      'catalogue:PROPOSAL_SHAPE_MISSING',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
      BASELINE,
    ],
  },
  {
    code: 'ORCH_TEST_TOOLS_TS',
    match: literal('ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING'),
    cause:
      "`@agoric/orchestration/tools/*.ts` ship as TypeScript. Node refuses to strip types under `node_modules`, and the package lists `ts-blank-space` only as a devDependency, so consumers do not get the loader.",
    fix: "Add `ts-blank-space` (0.6.2, matching the package's `^0.6.2`) as a devDependency and run ava with `nodeArguments: ['--loader=ts-blank-space/register', '--no-warnings']`. Verified with 0.6.2 on Node 22 and 24 by `packages/skills/snippets/test/loader.test.js`.",
    refs: [
      `${SKILLS}/agoric-testing/SKILL.md`,
      `${U23}:packages/orchestration/package.json#L95-L98`,
      BASELINE,
    ],
  },

  // --- sharp edges 14 to 19: deploy (docs/context/agoric-devnet-sharp-edges.md)
  // Codes match the CLI's ErrorCode names where one exists, so Release 2's
  // chain errors and the catalogue share a key.
  {
    code: 'CHAIN_BUNDLE_INSTALL_UNDERGASSED',
    match: silent,
    cause:
      'A bundle install was sent with `--gas auto` or a fixed gas below 100000000. The transaction returns success and installs nothing (sharp edges 14 and 15).',
    fix: 'Install with `--gas 100000000`, then query the chain for the bundle id before submitting the CoreEval.',
    refs: ['sharp-edge:14', 'sharp-edge:15', 'docs/context/agoric-deploy-sequence.md#L15-L24', `${SKILLS}/agoric-deploy/SKILL.md`],
  },
  {
    code: 'CHAIN_PAYLOAD_TOO_LARGE',
    match: literal('413 Payload Too Large'),
    cause:
      "Public RPC rejects request bodies over about 1 MB (CometBFT `max_body_bytes`), which an uncompressed bundle exceeds (sharp edge 16). Text as reported on devnet; not reproduced here.",
    fix: 'Compress the bundle before installing; a contract still over the limit needs the multi-bundle install pattern.',
    refs: ['sharp-edge:16', 'docs/context/agoric-deploy-sequence.md#L22', `${SKILLS}/agoric-deploy/SKILL.md`],
  },
  {
    code: 'WALLET_SPEND_WITHOUT_ALLOW_SPEND',
    match: silent,
    cause:
      'A wallet action that gives payments was submitted without `--allow-spend`, so it went as `MsgWalletAction`. The transaction returns code 0, the offer is rejected, nothing moves (sharp edge 17).',
    fix: 'Submit fund-moving offers with `agd tx swingset wallet-action --allow-spend`, as the `agoric` CLI does.',
    refs: [
      'sharp-edge:17',
      `${U23}:packages/agoric-cli/src/commands/wallet.js#L180-L182`,
      `${SKILLS}/agoric-deploy/SKILL.md`,
    ],
  },
  {
    code: 'BOARD_ID_HARDCODED',
    match: silent,
    cause: 'A client hardcodes a board id or instance handle. Both change on every deploy (sharp edge 18).',
    fix: 'Look them up in `published.agoricNames` after each deploy.',
    refs: ['sharp-edge:18', 'docs/context/agoric-deploy-sequence.md#L42-L46', `${SKILLS}/agoric-deploy/SKILL.md`],
  },
  {
    code: 'PAY_DENOM_HARDCODED',
    match: silent,
    cause:
      'Contract or client code hardcodes a pay denom. It differs per network: `ibc/toyusdc` on devnet, the Noble USDC IBC denom on mainnet (sharp edge 19).',
    fix: 'Pass the denom as a term or in `assetInfo`; take the network value from `aat config show` or `networks.json` and check `published.agoricNames.vbankAsset`.',
    refs: ['sharp-edge:19', 'packages/core/src/networks.json#L30-L40', `${SKILLS}/agoric-deploy/SKILL.md`],
  },

  // --- wrong snippets in the skill pack ------------------------------------
  {
    code: 'CHAINHUB_DENOM_UNREGISTERED',
    match: literal('ensure it is registered in chainHub'),
    cause:
      "An orchestration flow looked up a denom or brand ChainHub does not know. In tests, the usual cause is that `setupOrchestrationTest`'s `commonPrivateArgs` carry no `assetInfo`; on chain, that the contract was started without the asset's `assetInfo`.",
    fix: 'Pass `assetInfo` built with `assetOn(denom, chainName, brand)` in privateArgs, so `registerChainsAndAssets` registers it; in tests also register the asset in the fake bank and `vbankAsset`.',
    refs: [
      'packages/skills/snippets/test/support.js#L39-L74',
      `${SKILLS}/agoric-testing/SKILL.md`,
    ],
  },
  {
    code: 'PASS_STYLE_NOT_FROZEN',
    match: literal('Cannot pass non-frozen objects like'),
    cause:
      'An object crossing a vat or marshal boundary (method result, offer result, stored value, argument) was not hardened.',
    fix: 'Call `harden()` on the value before it leaves the function.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L173',
      `${SKILLS}/agoric-hardened-js/SKILL.md`,
    ],
  },
  {
    code: 'FAR_NON_METHOD',
    match: literal('cannot serialize Remotables with non-methods like'),
    cause: 'A `Far` object carries a property that is not a function.',
    fix: 'Keep data out of remotables. Expose it through a method (`getPrice: () => price`) or return a copyRecord.',
    refs: [
      'examples/offer-up/src/offer-up.contract.js#L170-L172',
      `${SKILLS}/agoric-hardened-js/SKILL.md`,
    ],
  },
  {
    code: 'PATTERN_MISMATCH',
    match: regex(String.raw` - Must (be|have|not|fail|match)`),
    cause:
      'A value did not match the `@endo/patterns` shape passed to `mustMatch`, an interface guard, `customTermsShape` or a store `valueShape`. The label before the first colon says which check failed.',
    fix: 'Read the path in the message (for example `offerArgs: chainName: number 42 - Must be a string`) and fix the value or the pattern.',
    refs: [
      'examples/send-anywhere/src/send-anywhere.flows.js#L79',
      `${SKILLS}/agoric-hardened-js/SKILL.md`,
    ],
  },
  {
    code: 'SES_TAMED_DATE_RANDOM',
    match: regex(
      String.raw`secure mode Calling %SharedDate%\.now\(\) throws|secure mode %SharedMath%\.random\(\) throws`,
    ),
    cause:
      'Contract code called `Date.now()` or `Math.random()`. Under lockdown in a compartment both throw, because contract execution must be deterministic.',
    fix: 'Take time from the timer service (`E(timer).getCurrentTimestamp()`) passed in `privateArgs`. Take randomness from nowhere: design it out.',
    refs: [
      `${U23}:packages/zoe/src/contracts/priceAggregator.js#L157`,
      'scripts/ses-smoke.mjs',
      `${SKILLS}/agoric-hardened-js/SKILL.md`,
    ],
  },
  {
    code: 'PUBLIC_FACET_AUTHORITY',
    match: silent,
    cause:
      'A per-principal or administrative method sits on `publicFacet`, which anyone holding the instance can reach with `E(zoe).getPublicFacet(instance)`.',
    fix: 'Put it on `creatorFacet` or on a per-principal facet or continuing invitation. See the POLA section lifted from agoric-sdk in the zoe-contract skill.',
    refs: [
      'examples/send-anywhere/src/send-anywhere.contract.js#L66',
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
    ],
  },
  {
    code: 'OFFER_HANDLER_UNDEFINED_REASON',
    match: literal('If an offerHandler throws, it must provide a reason of type Error'),
    cause: 'An offer handler threw `undefined` (for example a bare `throw;` or a rejected promise with no reason).',
    fix: 'Throw an `Error`: `throw Fail`…`` or `throw makeError(…)`. ZCF fails the seat with it and the offerer gets a full refund.',
    refs: [
      `${U23}:packages/zoe/src/contractFacet/zcfZygote.js#L206-L214`,
      `${SKILLS}/agoric-zoe-contract/SKILL.md`,
    ],
  },
  {
    code: 'DURABLE_STATESHAPE_MISMATCH',
    match: literal('durable Kind stateShape mismatch'),
    cause:
      'An upgrade redefined a durable exo class with a `stateShape` that is not compatible with the one recorded by the previous incarnation.',
    fix: 'Keep existing state fields and their shapes. Add new fields only as optional, and migrate lazily.',
    refs: [
      `${U23}:packages/swingset-liveslots/src/virtualObjectManager.js#L270-L300`,
      `${SKILLS}/agoric-durable-state/SKILL.md`,
    ],
  },
  {
    code: 'START_VALUES_NOT_DURABLE',
    match: literal('values from start() must be durable'),
    cause:
      "A contract declares `meta.upgradability: 'canUpgrade'` but `start` returns a facet that is not durable, typically a `Far` object.",
    fix: 'Make every facet `start` returns a `zone.exo` (or another durable object) from a zone built on the baggage.',
    refs: [
      `${U23}:packages/zoe/src/contractFacet/zcfZygote.js#L452-L461`,
      'examples/send-anywhere/src/send-anywhere.contract.js#L124-L140',
      `${SKILLS}/agoric-durable-state/SKILL.md`,
    ],
  },
  {
    code: 'MAKEONCE_MISSING',
    match: silent,
    cause:
      'A long-lived object (an orchestration account, a vow kit, a singleton) is created with a plain call in contract start, so every incarnation creates a new one and the previous one, with anything it holds, is orphaned.',
    fix: "Create it with `zone.makeOnce('name', () => make())`, which runs the maker only on first start and returns the stored value after an upgrade.",
    refs: [
      'examples/send-anywhere/src/send-anywhere.contract.js#L104-L109',
      `${SKILLS}/agoric-durable-state/SKILL.md`,
    ],
  },
  {
    code: 'DURABLE_KIND_SUBSET',
    match: silent,
    cause:
      'An upgrade redefined a durable kind with fewer facets or methods than the previous incarnation. Objects of that kind already held by clients or stored durably keep their identity, and calls to the missing methods fail. Upstream forbids it; the exact error text was not reproduced at u23a.',
    fix: 'Redefine every durable kind with the same facets and methods or a superset. Retire a method by keeping it and making it throw a clear error.',
    refs: [
      `${U23}:packages/SwingSet/docs/vat-upgrade.md#L62`,
      `${SKILLS}/agoric-durable-state/SKILL.md`,
    ],
  },
  {
    code: 'EXO_METHOD_ADDED_NO_EFFECT',
    match: silent,
    cause:
      'Unverified devnet observation (sharp edge 9): a method added to a `zone.exo` public facet did nothing after redeploying under the same label, and a fresh label was used to get around it. It conflicts with the upstream upgrade rule, which allows a superset of methods, and it is not known whether the redeploy was an upgrade or a new instance. To be tested by the week 2 upgrade task.',
    fix: 'Do not rename exo labels on upgrade; follow the upstream rule (same facets and methods or a superset). If a new method seems to have no effect, check whether the contract was upgraded or a new instance was started, and record the case against this entry.',
    refs: [
      'sharp-edge:9',
      `${U23}:packages/SwingSet/docs/vat-upgrade.md#L62`,
      'catalogue:DURABLE_KIND_SUBSET',
      `${SKILLS}/agoric-durable-state/references/upgrade-rules.md`,
    ],
  },
  {
    code: 'DURABLE_VALUE_NOT_DURABLE',
    match: literal('value is not durable'),
    cause:
      'A durable store or durable exo state was given a heap object: a `Far` object, a plain closure or a promise.',
    fix: 'Store only passable data and durable objects (zone exos, other durable stores, vows). Make the `Far` object a `zone.exo`.',
    refs: [
      `${U23}:packages/swingset-liveslots/src/collectionManager.js#L61`,
      `${SKILLS}/agoric-durable-state/SKILL.md`,
    ],
  },
  {
    code: 'E_IN_FLOW',
    // The Panic string at replay-membrane.js:349. Sibling panics for
    // `E.sendOnly`, function targets and property gets (lines 307, 420, 429,
    // 439, 443) differ only in the verb.
    match: literal('guest eventual applyMethod not yet supported: '),
    cause:
      'An orchestration flow used `E()` (eventual send) on an object it received from the host, such as an orchestration account. At u23a the replay membrane does not support eventual sends from a guest, so the activation panics into the Failed state. The offerer sees an offer that never settles, seat still open; the panic is in the vat log, because async-flow\'s default panic handler rethrows it. Reported on devnet as sharp edge 1; the mechanism here is from u23a source. Not reproduced end to end.',
    fix: 'Call account and chain methods directly and `await` them: `await account.transfer(dest, amount)`. The flow runner handles the vows.',
    refs: [
      `${U23}:packages/async-flow/src/replay-membrane.js#L349`,
      `${U23}:packages/async-flow/src/async-flow.js#L195-L201`,
      `${U23}:packages/async-flow/src/async-flow.js#L58-L60`,
      `${U23}:packages/async-flow/src/async-flow.js#L313`,
      'examples/send-anywhere/src/send-anywhere.flows.js#L122-L131',
      'sharp-edge:1',
      `${SKILLS}/agoric-orchestration/SKILL.md`,
    ],
  },
  {
    code: 'FLOW_REFUND_MISSING',
    match: silent,
    cause:
      'A flow moved funds from the seat into a local account, the next step failed, and the flow exited or failed the seat without moving the funds back. The offerer is paid nothing and the funds stay in the contract account.',
    fix: 'On failure after `localTransfer`, call `withdrawToSeat(account, seat, give)` before `seat.fail(error)`.',
    refs: [
      'examples/send-anywhere/src/send-anywhere.flows.js#L101-L107',
      `${SKILLS}/agoric-orchestration/SKILL.md`,
    ],
  },
  {
    code: 'GETCHAIN_AT_START',
    match: silent,
    cause:
      "Unverified. `orch.getChain('agoric')` (or another chain lookup) was awaited during contract start rather than inside a flow. Reported on devnet to hang contract start (sharp edge 7); not reproduced at u23a.",
    fix: 'Look chains up inside the flow that needs them, and pass per-network values such as the pay denom as terms.',
    refs: [
      'examples/send-anywhere/src/send-anywhere.flows.js#L43-L45',
      'sharp-edge:7',
      `${SKILLS}/agoric-orchestration/SKILL.md`,
    ],
  },
  {
    code: 'HOST_RETURNS_PROMISE',
    match: silent,
    cause:
      'Unverified. Host-side orchestration code (an exo method or a function passed into a flow context) returned a promise instead of a vow. Promises do not survive an upgrade, so a flow waiting on one cannot be replayed. No error was found at u23a in heap-zone tests; upstream states the rule without a diagnostic.',
    fix: 'Return vows: wrap cross-vat work in `vowTools.watch(E(x).method())` or `vowTools.asVow(async () => …)`.',
    refs: [
      'examples/send-anywhere/src/send-anywhere.contract.js#L69-L71',
      `${SKILLS}/agoric-orchestration/SKILL.md`,
    ],
  },
]);
