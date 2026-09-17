# Release 1 manual baseline, September 2026

Project session review 2026-09-17: correctness pass, Agoric review pending. Two citations corrected below.

RELEASE1-BRIEF.md D1: plan tasks 1 and 4, Claude Code and Codex, no skill pack,
one run each. Run on 2026-09-17 (Release 1 day 1).

**Correctness pass, Agoric review pending.** The API and idiom checks below
were done by the project's Claude Code session against
`upstream/agoric-sdk-u23` at cc25a29 (tag `agoric-upgrade-23a`) on 2026-09-17.
Agoric has not reviewed them. Where a finding depends on runtime behaviour
nobody ran, it is marked *plausible*, not *confirmed*.

## Baseline table

Defects in the final output of each run. Codes are provisional catalogue keys.
Errors an agent hit and fixed during a run are not defects of the output; they
are listed separately under [Errors hit during the runs](#errors-hit-during-the-runs).

| Task | Agent | SES bundle | Own tests | Defects (code, severity) |
| :-- | :-- | :-- | :-- | :-- |
| 1 fixed-price sell | Claude | pass | 2/2 pass | `ATOMIC_REARRANGE_HELPER` low · `CONTRACT_NOT_UPGRADABLE` medium · `CUSTOM_TERMS_SHAPE_MISSING` low |
| 1 fixed-price sell | Codex | pass | 2/2 pass | `TEST_BUNDLE_BYPASS` medium · `PROPOSAL_SHAPE_MISSING` low · `CONTRACT_NOT_UPGRADABLE` medium · `CUSTOM_TERMS_SHAPE_MISSING` low · `TEST_IMPORT_WORKAROUND` low |
| 4 orchestration transfer | Claude | pass | 5/5 pass | `TEST_TOOLS_REIMPLEMENTED` medium |
| 4 orchestration transfer | Codex | pass | 10/10 pass | `TEST_HAND_MOCKED_ORCHESTRATOR` high · `OFFER_RESULT_NOT_CONTINUING` medium (plausible) · `EXIT_WAIVED_NO_RECOVERY` medium · `TEST_RAW_AVA` low |

Headline: every run bundled under SES, every run's own tests passed, and none
hit sharp edge 1 (`E()` inside a flow). The defects are about idiom and test
fidelity, not about code failing. The worst one is the kind the pack most needs
to cover: in task 4, Codex's 10 green tests exercise a fake orchestrator the
contract never runs against. That is the Servandum failure mode (sharp-edges
testing note) reproduced without prompting.

## Defects

### Task 1, Claude (`task1-claude/`)

**`ATOMIC_REARRANGE_HELPER`**, low. Existing seed code.
`src/fixed-price-sale.contract.js:16` imports `atomicRearrange` from
`@agoric/zoe/src/contractSupport/index.js` and calls it at lines 64 and 76. At
u23a the helper is `@deprecated use the zcf builtin instead`
(`zoe/src/contractSupport/atomicTransfer.js:47`) and only forwards to
`zcf.atomicRearrange`. It works; it is the old idiom.

**`CONTRACT_NOT_UPGRADABLE`**, medium. `start` returns `Far` facets that close
over heap state (`itemMint`, `proceedsSeat`). There is no `prepare`, no zone, no
exo and no `meta.upgradability`, so the contract cannot be upgraded
(`zoe/src/contractFacet/zcfZygote.js:481` requires
`meta.upgradability === 'canUpgrade'`). Accumulated proceeds survive only as
long as this incarnation does. The reference contract, Offer Up, has the same
shape; the finding stands because the durable-state skill exists to teach
otherwise.

**`CUSTOM_TERMS_SHAPE_MISSING`**, low. No `export const meta = { customTermsShape }`.
`price` is checked by hand with `AmountMath.coerce(brands.Price, price)` after
start; `itemName` is not checked at all. Related to the seed code
`CUSTOM_TERMS_SHAPE_LOCATION`, which covers the misplaced case; this is the
absent case.

Not defects, checked: `buyerSeat.fail(reason); throw reason` is safe, because
ZCF fails the seat itself when a handler throws (`zcfZygote.js:206-213`) and
`fail` does nothing on a seat that has already exited (`zcfSeat.js:138`). Tests
use `@agoric/zoe/tools/prepare-test-env-ava.js`, which is `@endo/ses-ava`'s
`wrapTest` (`SwingSet/tools/prepare-test-env-ava.js`), and install from a path,
so the contract is really bundled.

### Task 1, Codex (`task1-codex/`)

**`TEST_BUNDLE_BYPASS`**, medium. `test/fixedPriceSale.test.js:11` calls
`bundleAndInstall(contract)` with the module namespace, not a path. At u23a that
goes through `bundleTestExports` (`zoe/tools/setup-zoe.js:74-82`): the contract
is never bundled or evaluated in a compartment during the tests. A contract
that fails to bundle would still pass. The SES smoke job bundled this one
independently, so there is no hidden failure here, but the tests would not catch one.

**`PROPOSAL_SHAPE_MISSING`**, low. `src/fixedPriceSale.js:65`
`zcf.makeInvitation(buy, 'buy item')` passes no `proposalShape`. Malformed
offers are escrowed and then refused by hand-written checks in the handler,
instead of being rejected by Zoe before escrow. Offer Up passes a
`proposalShape`.

**`CONTRACT_NOT_UPGRADABLE`**, medium. Same as Claude's.

**`CUSTOM_TERMS_SHAPE_MISSING`**, low. Same as Claude's; `priceBrand` and
`priceAmount` are checked by hand.

**`TEST_IMPORT_WORKAROUND`**, low. The test imports `@agoric/ertp`, `setup-zoe`,
`@endo/far` and the contract through top-level `await import()` after the
prepare-test-env import. That was Codex's fix for
`Cannot initialize @endo/errors, missing globalThis.assert` while the workspace
was still on Yarn PnP. Under `node-modules` plain static imports work (Claude's
task 1 test uses them and passes). The workaround survived into the output.

### Task 4, Claude (`task4-claude/`)

**`TEST_TOOLS_REIMPLEMENTED`**, medium. `test/tools/setup.js` (195 lines) and
`test/tools/network-fakes.js` (149 lines) are hand ports of parts of the
published `@agoric/orchestration/tools/contract-tests.ts` and
`network-fakes.ts`. Claude never tried importing them. It stated that Node will
not strip types inside `node_modules`, which is true without a loader, and
ported instead. ~~The published package ships `ts-blank-space` and the import
works with it~~ The import works with the `ts-blank-space` loader
([D4 loader check](#d4-loader-check)); the published package does not ship
that loader to consumers (correction 2 below). The port will drift from
upstream on every SDK bump.

No contract defects found. Checked against u23a: `withOrchestration(contract, { publishAccountInfo: true })`,
`orchestrateAll` (`orchestration/src/facade.js:112`), `registerChainsAndAssets`,
`chainHub.getDenom` (~~`exos/chain-hub.js:236`~~ `exos/chain-hub.js:679`, synchronous; correction 1 below),
`orch.getChain('agoric' | 'osmosis')`, `makeAccount`, `LocalOrchestrationAccount.transfer`
(`exos/local-orchestration-account.js:942`), synchronous `getAddress` on the
Cosmos account (`orchestration-api.ts:268`), `asContinuingOffer`
(`exos/cosmos-orchestration-account.js:1106`, same idiom as
`examples/basic-flows.flows.js:34`), and `zoeTools.localTransfer`, which does
return funds to the seat when a deposit fails, as the comment claims
(`utils/zoe-tools.js`). Flows are in their own file and call account methods
directly, with no `E()`. The public facet is a `zone.exo` with an `M.interface`
guard. Tests bundle from a path and drive real IBC acknowledgement, error and
timeout events.

### Task 4, Codex (`task4-codex/`)

**`TEST_HAND_MOCKED_ORCHESTRATOR`**, high. `test/support/contract.js` builds
its own orchestration facade (`makeOrchestrationFacade` with a heap zone) around
`Far` fakes for the chains and accounts. It then calls `contract()` directly,
with `privateArgs` `{}` and no `chainHub`. That bypasses `withOrchestration`,
ChainHub, `LocalOrchestrationAccount`, ICA creation and the IBC mocks. The
"IBC timeout" test (`test/osmosis.test.js:94-107`, one loop body shared with the acknowledgement-error case) is
`transfer.reject(Error('IBC timeout'))`. The only test of the production
`start` passes `Far('names', {})`-style stubs and checks the invitation
description. All 10 tests pass under conditions the chain never provides. This
is the negative example in the sharp-edges testing note, produced unprompted.

**`OFFER_RESULT_NOT_CONTINUING`**, medium, *plausible*. `src/osmosis.flows.js:32`
returns the account object itself (`return destination;`) as the offer result.
The u23a idiom for handing an account to the offerer is
`account.asContinuingOffer()` (`examples/basic-flows.flows.js:34`,
`auto-stake-it.flows.js:101`), which gives a smart-wallet user
`invitationMakers`. A raw remotable offer result gives a wallet user nothing to
act on. The idiom is confirmed from source; the wallet-side behaviour was not
run.

**`EXIT_WAIVED_NO_RECOVERY`**, medium, a design judgement. The proposal shape
requires `exit: { waived: null }` (`src/osmosis.contract.js:28`), so the offerer
can never exit. Codex's reason was to stop the offerer leaving while funds are
outside Zoe. The cost: if the flow never settles (ICA channel never opens,
relayer down, or a hang of the sharp-edge-1 class), the funds sit in the seat or
the per-offer local account with no exit and no creator facet to recover them.
send-anywhere does not waive exit.

**`TEST_RAW_AVA`**, low. `test/osmosis.test.js:1` is `import test from 'ava'`.
The SES environment comes from ava `require: ['@agoric/zoe/tools/prepare-test-env-ava.js']`,
but the `test` function is ava's own, not wrapped by `@endo/ses-ava`. That
breaks the rule "every test runs under `@endo/ses-ava`".

### Shared, not tagged

In both task 4 contracts, if `withdrawToSeat` itself fails after a failed
transfer, the funds stay in that offer's local account and nothing can recover
them. Both agents said so in their summaries. send-anywhere at u23a has the same
property, so it is not tagged as a baseline defect.

## Sharp edges checked first

| Edge | What was checked | task1-claude | task1-codex | task4-claude | task4-codex |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | `E()` or `@endo/far` import in any flows file | n/a | n/a | clean | clean |
| 8 | hand-built vstorage paths | n/a | n/a | clean (only `publishAccountInfo`, which is bech32 addresses) | clean (nothing published) |
| 9 | exo labels on a changed facet | `Far`, no exo | `Far`, no exo | first deploy, n/a | first deploy, n/a |
| 14 | bundle install gas | not exercised | not exercised | not exercised | not exercised |
| 17 | `--allow-spend` on wallet actions | not exercised | not exercised | not exercised | not exercised |

Neither prompt asks for a deploy, and no agent wrote deploy scripts, core-evals
or wallet actions. The baseline therefore says nothing about edges 14 to 19. If
v0.2 is meant to measure `agoric-deploy`, it needs a task that asks for a deploy.

No `Date.now()` or `Math.random()` in any contract source.

## Errors hit during the runs

Taken from the transcripts. Each agent fixed these before finishing, so they
are not output defects, but the exact text is what a model sees, which makes
them catalogue `match` candidates.

| Candidate code | Exact text | Run | Cause |
| :-- | :-- | :-- | :-- |
| `YARN_PNP_DEFAULT` | `EROFS: read-only filesystem, mkdir '/node_modules/bundles'` | task1-codex | Yarn 4 with no `.yarnrc.yml` means Plug'n'Play; the Zoe test tools write bundles under a virtual path |
| `YARN_PNP_DEFAULT` | `Your application tried to access @endo/errors, but it isn't declared in your dependencies` | task1-codex | same |
| `ENDO_ERRORS_BEFORE_SES` | `Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'` | task1-codex | module evaluated before lockdown (under PnP) |
| `VATDATA_UNAVAILABLE` | `VatData unavailable` | task1-codex | test ran without the Zoe/SwingSet test environment |
| `OFFER_SAFETY_VIOLATION` | `Offer safety was violated by the proposed allocation: …` | task1-codex | first draft reallocated without satisfying `want` |
| `BUNDLE_UNDECLARED_DEP` | `Failed to load module "./src/send-to-osmosis.contract.js" in package "file:///…/" (2 underlying failures: Cannot find external module "@endo/patterns" …, Cannot find external module "@endo/errors" …)` | task4-claude (task4-codex hit the same for `@endo/patterns`) | `bundle-source` only follows declared dependencies, even when the package is hoisted into `node_modules` |
| `PROPOSAL_SHAPE_MISMATCH` | `"fund Osmosis account" proposal: exit: {"onDemand":null} - Must be: {"waived":null}` | task4-codex | its own tests offered before the shape was updated |
| `ORCH_TEST_TOOLS_TS` | `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING … contract-tests.ts` | D4 check (Claude predicted it and avoided it) | see D4 below |

All four runs ended with `nodeLinker: node-modules` in `.yarnrc.yml`. Claude
wrote it before its first install in both tasks; Codex added it after a PnP
failure in task 1.

## D4 loader check

Question (RELEASE1-BRIEF.md D4): does `@agoric/orchestration/tools/contract-tests.ts`
import cleanly from a workspace outside the SDK monorepo?

**Answer: not without a loader. With the loader the SDK itself uses, yes,
on Node 22 and 24.**

The published `@agoric/orchestration@0.3.0-u23.1` ships `tools/contract-tests.ts`,
`ibc-mocks.ts` and `network-fakes.ts` as TypeScript source plus `.d.ts`, with
no compiled `.js`. `contract-tests.ts` imports its siblings by `.js` specifiers
(`@agoric/orchestration/tools/network-fakes.js`), which do not exist on disk.
~~The package declares `ts-blank-space` as a dependency, and its own ava config
at u23a uses `--loader=ts-blank-space/register`.~~ The package's own ava config
at u23a uses `--loader=ts-blank-space/register`, and it declares
`ts-blank-space ^0.6.2` under `devDependencies` only, so consumers do not get it
(correction 2 below).

Run in `~/Desktop/Agoric-L1/baseline/task4-claude` (installed tree, `node-modules`
linker) with a one-test ava file that calls `setupOrchestrationTest({ log })`
and imports `buildVTransferEvent` from `tools/ibc-mocks.ts`. Test file, config
and output are in `d4-loader-check/`. The scratch directory was removed from the
workspace afterwards; the workspace status still matches `task4-claude/status.txt`.

| Node | Loader | Result |
| :-- | :-- | :-- |
| 24.19.0 | none | `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING: Stripping types is currently unsupported for files under node_modules` |
| 22.23.2 | none | same |
| 24.19.0 | `--loader=ts-blank-space/register` (0.4.4, from the installed tree) | 1 test passed |
| 22.23.2 | `--loader=ts-blank-space/register` | 1 test passed |

Loader fix for the eval brief: `packages/evals` ava config adds
`nodeArguments: ['--loader=ts-blank-space/register', '--no-warnings']` and pins
~~`ts-blank-space` to 0.4.4~~ `ts-blank-space` to 0.6.2 (correction 2 below) as a devDependency rather than relying on it being
hoisted. The D4 decision does not change. **Not verified:** how that loader
combines with the repo's `@ava/typescript` `rewritePaths` setup (`packages/*`
compile tests with `tsc` first). Check that when `packages/evals` is created.
`--loader` is also deprecated in favour of `--import` plus `register()`; that
worked here, but expect a future Node to warn or drop it.

### Corrections, 2026-09-17 (project session correctness pass)

Recorded forward. The struck text above is what was first published.

1. **`chainHub.getDenom` citation.** It said `exos/chain-hub.js:236`. At
   cc25a29 line 236 is the `getDenom` entry in the ChainHub interface guard
   (`M.call(BrandShape).returns(M.or(M.string(), M.undefined()))`); the method
   itself is at line 679. The finding (synchronous, returns a denom or
   `undefined`) does not change.
2. **`ts-blank-space` version and provenance.** The proposed pin said 0.4.4,
   and two sentences above said the published package declares or ships
   `ts-blank-space`. Both overclaimed.
   - `@agoric/orchestration@0.3.0-u23.1` declares `ts-blank-space ^0.6.2`, and
     so do `@agoric/client-utils` and `@agoric/portfolio-api`, but all three
     list it under `devDependencies`, which are not installed for consumers.
   - The 0.4.4 in the baseline workspace was hoisted from
     `@endo/bundle-source@4.1.2`, which declares `ts-blank-space ^0.4.1` as a
     runtime dependency (`yarn why ts-blank-space` in this repo gives the same
     single path). There is no 0.6.x copy anywhere in that workspace.
   - So the loader check passed on 0.4.4, a version the SDK does not test its
     own tools with. The proposed pin is now **0.6.2**, which satisfies `^0.6.2`
     and is what `agoric-sdk-u23/yarn.lock` resolves it to.
   - **To be rerun when `packages/evals` is created**, with 0.6.2 declared
     there. Also check which copy `--loader=ts-blank-space/register` resolves
     to once both 0.4.4 (for bundle-source) and 0.6.2 are in the tree, because
     the loader resolves from the working directory, not from the orchestration
     package.

## How the runs were set up

### Workspaces

`~/Desktop/Agoric-L1/baseline/<task>-<agent>/`, each `git init` (branch `main`)
plus one commit by `baseline-setup` containing only `package.json`:

- `dependencies`: the seven `@agoric/*` packages at the versions in `docs/PINS.md`.
- `devDependencies`: `ava` 6.4.1, `@endo/ses-ava` 1.3.2, `@endo/bundle-source` 4.1.2.
- `resolutions`: the `@endo/*` and `ses` block copied from the repo root `package.json`.
- Also `name`, `private: true` and `packageManager: "yarn@4.17.1"`.

No `.yarnrc.yml`, ava config, `CLAUDE.md`, `AGENTS.md` or skills. The
workspaces are outside the repo. Codex's run went looking for `AGENTS.md` in the
parent directory and found none.

### Agents and flags

| | Claude Code | Codex |
| :-- | :-- | :-- |
| Binary | `~/.local/bin/claude` 2.1.274 | `/Applications/ChatGPT.app/Contents/Resources/codex`, codex-cli 0.153.4 |
| Model (as reported, not pinned) | `claude-opus-5[1m]` both runs | task 1 `gpt-5.6-sol`, task 4 `gpt-6-astra` |
| Isolation | `--safe-mode` | `--ignore-user-config` |
| Permissions / sandbox | `--permission-mode bypassPermissions`, no sandbox, cwd set to the workspace | `-s workspace-write -c sandbox_workspace_write.network_access=true -c approval_policy="never"`, `-C <workspace>` |
| Output | `-p --output-format stream-json --verbose` | `exec --json -o last-message.txt` |

The baseline did not pin models, and Codex's default changed between its two
runs. The task 1 and task 4 Codex results therefore come from different models
and should not be compared as one agent's behaviour.

**Decided for v0.2 (Bob, 2026-09-17): models are pinned.** The harness passes
an explicit model flag to both agents (`--model` for Claude Code, `-m` for
Codex) and records the model id, CLI version and binary path for every run.

Vendor built-in defaults remain and differ between the agents: each vendor's
system prompt, built-in tools and Codex's `.system` skills. Stripping user
config removes Bob's plugins, hooks and MCP servers, nothing more.

The Codex sandbox was chosen per Bob's instruction: use a workspace-write
network option if the installed version has one, and the bypass flag only if it
does not. The key `sandbox_workspace_write.network_access` is in 0.153.4's
config schema. The effective policy, read back from Codex's session rollout
files for both runs, was
`{"type":"workspace-write","network_access":true,"exclude_tmpdir_env_var":false,"exclude_slash_tmp":false}`
with `approval_policy: never`. The bypass flag was not used.

The npm-installed Codex CLI (`@openai/codex` 0.118.0 under nvm Node 20) is
broken: its native binary is missing. Bob chose the app-bundled binary instead.

### Runner and caps

`run-baseline.sh <task> <agent>` holds the prompts verbatim from D1 and the
flags above, enforces a 30-minute cap by killing the process group, and saves
the output. The two task 1 runs went concurrently, then the two task 4 runs.
None came close to the cap and none was repeated.

| Run | Started (UTC) | Duration | Exit | Activity | Diff lines |
| :-- | :-- | :-- | :-- | :-- | :-- |
| task1-claude | 09:05:38 | 2m03s | 0 | 11 tool calls, 12 turns, $0.67 | 265 |
| task1-codex | 09:05:38 | 4m38s | 0 | 25 commands (8 non-zero) | 214 |
| task4-claude | 09:10:24 | 4m39s | 0 | 24 tool calls, 25 turns, $1.87 | 755 |
| task4-codex | 09:10:24 | 5m30s | 0 | 24 commands (5 non-zero) | 437 |

### Per-run files

| File | What |
| :-- | :-- |
| `prompt.txt` | the prompt, verbatim |
| `transcript.jsonl` | a `baseline_header` line (task, agent, version, isolation and permission flags, full argv, base commit), then the agent's full JSON event stream |
| `stderr.txt`, `last-message.txt` (Codex) | as emitted |
| `diff.patch` | `git diff <setup commit>` including new files, excluding `node_modules`, `.yarn`, `.pnp.*` and `yarn.lock` |
| `status.txt` | `git status --short`, which lists `yarn.lock` |
| `run.json` | start, finish, exit status, timed out |
| `ses-smoke.txt` | `node scripts/ses-smoke.mjs <contract entry>` from the repo |
| `own-tests.txt` | `yarn test` in the workspace after the run |
| `ses-copies.txt` | every `ses` copy in `node_modules`; one line (1.14.0) in all four |

The SES smoke script gained optional entry-path arguments for this (commit
90ccd89); discovery under `examples/` is unchanged. It bundles with the repo's
pinned `@endo/bundle-source` 4.1.2 and resolves imports from the workspace's
own `node_modules`.

### Other things observed

- Writes outside the workspace. task4-claude ran `cp … /tmp/flows.bak`
  (no sandbox under bypassPermissions). task4-codex wrote `/tmp/task4-tests.log`
  (workspace-write leaves `/tmp` writable unless `exclude_slash_tmp` is set).
  Neither touched anything else outside its workspace. v0.2 should give both
  agents a per-run `TMPDIR` and set `exclude_slash_tmp`.
- task4-codex set `enableGlobalCache: false` in `.yarnrc.yml`, because the
  sandbox cannot write Yarn's global cache under `~/.yarn`. This is a side
  effect of the sandbox, not an agent choice to evaluate.
- task4-codex added a `README.md` nobody asked for.
- Neither agent used the published `setupOrchestrationTest`. Claude ported it;
  Codex built its own fake.
- Claude checked its refund tests by deleting the refund call, confirming the
  tests failed, and restoring it.
