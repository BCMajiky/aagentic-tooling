# Release 1 brief for Claude Code

Working folder: `~/Desktop/Agoric-L1/aagentic-tooling/`. Plan of record: `docs/context/Agoric_L1_Opps.md` §2, as amended by `docs/context/claude_plan-amendments.md`. Stage 0 decisions in `STAGE0-BRIEF.md` and `docs/PINS.md` stand and are not reopened here. This brief resolves the four points the handoff left open, folds in the §2 amendments, and seeds the error catalogue. Where it conflicts with the plan, this brief wins. The amendments log wins over both.

Date: 17 September 2026. Covers v0.1 (week 1). v0.2 (evals) gets its own brief once the baseline run has been read.

## Decisions, resolved

**D1. The manual baseline is plan tasks 1 and 4: a fixed-price sell contract, and an orchestration flow that creates a remote account and transfers.**
Two tasks, two agents, no skill pack, one run each, four runs total. Task 1 is a Zoe contract; task 4 is an orchestration contract. Between them they touch every idiom family in the plan §2.3 (Hardened JS, ERTP, Zoe, durable state, vows and flows, testing), and each has a reference contract already in `examples/` at the pinned SDK (Offer Up, send-anywhere) with a hand-authored manifest, so the output can be checked against known-good source rather than against opinion. Task 4 is also the one the devnet work says fails silently: `E()` on an orchestration account inside a flow hangs with no error. A baseline that does not include an orchestration task would miss the class of failure a model cannot self-correct from, which is the class the pack most needs to cover. Task 5 (repair `Date.now()` and a hardened mutation) was considered and rejected for the baseline: models are good at that repair and it would tell us little. Task 2 (ephemeral to durable) was rejected because it needs a starting contract that the baseline would have to author first.

Exact prompts, reused verbatim by the v0.2 harness so baseline and eval measure the same thing:

Task 1: "Write a Zoe smart contract for Agoric that sells one kind of item for a fixed price. The price brand and amount are contract terms. A buyer offers the price and wants the item. Include ava tests that start the contract and show a successful purchase and a refused underpayment. Use the package versions already in package.json."

Task 4: "Write an Agoric orchestration contract with one invitation. The offer handler runs an orchestration flow that creates an account on the osmosis chain and transfers the offered amount to it. If the transfer fails the funds return to the offerer. Include ava tests. Use the package versions already in package.json."

Baseline workspace: `~/Desktop/Agoric-L1/baseline/<task>-<agent>/`, outside the repo, so the repo's `CLAUDE.md`, `AGENTS.md` and any rendered skills cannot leak into the run. Each workspace starts as `git init` plus a `package.json` carrying the u23 pins and the resolutions block from `docs/PINS.md`, with ava, `@endo/ses-ava` and `@endo/bundle-source` as devDependencies and nothing else: no ava config, no instructions file, no skills. What the agent does with an unconfigured ava is one of the things being observed. Runs are `claude -p` and Codex's non-interactive mode (`codex exec` at the time of writing; confirm the exact invocation and output flags against the installed versions on day 1 rather than from memory) with cwd set to the workspace, thirty minutes cap per run. Record per run: prompt, full transcript, `git diff`, whether the contract bundles under SES (use the repo's smoke script against the workspace), whether the agent's own tests pass, and a correctness check of every SDK API used against the u23a clone. Tag each defect with a failure-mode code; those codes become the catalogue's keys. A run is repeated only if it failed on environment (install, auth, network), never to get a better result.

**D2. Seven skills, one per activity, prefixed `agoric-`.**
The split follows what a developer is doing at the moment the skill loads, not the SDK's package boundaries, because a skill is loaded per task and should carry only what that task needs.

| Skill | Carries | Notes |
| :-- | :-- | :-- |
| `agoric-hardened-js` | `harden`, lockdown, no ambient authority, determinism, `E()`, `Far` vs exo, `@endo/patterns` basics | Marked as Endo idioms in one line each (plan D7) so a later Endo-only release lifts them unchanged |
| `agoric-zoe-contract` | ERTP amounts, brands, issuers; proposals, seats, invitations, offer safety, `zcf.atomicRearrange`, proposal shapes, terms and `privateArgs`, facet design | Upstream POLA section lifted here with attribution |
| `agoric-durable-state` | zones, `exo` / `exoClass` / `exoClassKit`, `makeOnce`, baggage, upgrade rules, exo label freezing, id prefix on redeploy | Sharp edges 9 and 10 |
| `agoric-orchestration` | `withOrchestration`, contract and flows file split, `orch`, chain and account APIs, vows vs promises, the thirteen flow-level rules | Upstream async-flow model notes and "always return vows rather than promises" lifted here with attribution |
| `agoric-testing` | `@endo/ses-ava`, `setUpZoeForTest`, `setupOrchestrationTest` from `@agoric/orchestration/tools/contract-tests.ts`, `ibc-mocks`, what a test that passes under conditions the chain never provides looks like | The Servandum suites are the negative example |
| `agoric-deploy` | bundle, install with explicit gas, verify, core-eval, vote, verify instance, `--allow-spend`, per-network denoms, board ids change per deploy, `aat` pointers | Sharp edges 14 to 19 |
| `agoric-errors` | The error catalogue: message pattern, cause, fix | Rendered from `packages/core/src/hints.ts`, the same map the CLI uses, so a human at a terminal and a model in a skill read identical text |

Source layout: `packages/skills/src/<skill>/SKILL.md` with frontmatter `name` and `description`, plus `references/*.md` for detail. Snippets are not copied into skills; skills link to `examples/` and to `packages/skills/snippets/` by path. Each SKILL.md body targets 2,500 tokens and fails the build above 4,000; anything longer moves to `references/`. Descriptions say when the skill should load and when it should not, because both Claude Code and Codex choose skills implicitly by description.

Render targets, from one build script: `.claude/skills/<skill>/` for Claude Code; `.agents/skills/<skill>/SKILL.md` plus `agents/openai.yaml` sidecar for Codex (the sidecar is generated from the frontmatter and is the only Codex-specific artifact); `.cursor/rules/<skill>.mdc`; `.github/copilot-instructions.md`; a `docs/ai/` section for the site. Output goes to `packages/skills/dist/<target>/`, committed, with a test that re-renders and fails on drift. The repo dogfoods its own pack: `.claude/skills` and `.agents/skills` at the repo root are symlinks into `dist/`. The root `AGENTS.md` stays the contributor file rendered by `yarn agents:check`; the pack's `AGENTS.md` is a second output of the same render function with different inputs. Do not merge them.

**D3. Pack `AGENTS.md` budget: 2,000 tokens hard, 1,500 target, measured with `gpt-tokenizer` (o200k_base) in the build.**
The plan's 8k figure was set when `AGENTS.md` had to carry the idioms for Codex. Codex now loads skills on demand from `.agents/skills/`, so `AGENTS.md` is read in full on every turn and should be an index plus the rules that must hold even when no skill has loaded. Upstream's own `AGENTS.md` at a2a3de9 is 1,151 words and dense; ours has less to say. Contents, in order: what the pack is (two sentences), the pins to install, the seven skills with one line each on when to load them, and the silent-failure rules that a model must obey without loading anything: no `E()` on orchestration account methods inside a flow; `harden` everything that crosses a boundary; every test under `@endo/ses-ava`; no `Date.now()`, `Math.random()`, network or filesystem in contract code; a changed facet needs a fresh exo label. `CLAUDE.md` in the pack is a pointer under 300 tokens. `.github/copilot-instructions.md` carries the same budget as `AGENTS.md` because Copilot also loads it whole. The tokenizer is OpenAI's because Codex is the agent that reads the file whole; for Claude the same count is a conservative estimate and no second tokenizer is added.

**D4. Evals live in `packages/evals`, in-process, on the published test tools. Starship is not a v0.2 dependency.**
`multichain-testing` at u23a is a Starship environment: Kubernetes, roughly 6.5 CPU cores and 9.5 GiB requested, seven to twelve minutes to boot, and `@agoric/*` resolved by `yarn link` into the SDK monorepo. That cannot be "reproducible by anyone" (plan §2.7) and it puts the biggest schedule risk on the critical path. The published `@agoric/orchestration@0.3.0-u23.1` ships `tools/contract-tests.ts` (`setupOrchestrationTest`), `tools/ibc-mocks.ts` and `tools/network-fakes.ts`, and `@agoric/zoe@0.28.0-u23.1` ships `tools/setup-zoe.js` and `tools/prepare-test-env-ava.js`. The SDK's own `send-anywhere.test.ts` runs in-process on `test/supports.ts` (`commonSetup`, 312 lines), which is not published but is the same wiring as `tools/contract-tests.ts` (`setupOrchestrationTest`, 333 lines, published): heap zone, fake bank manager, fake board, fake bridge, mock network, manual timer, chain registration. So: every eval check is an ava test under ses-ava using those tools; tasks 4 and 8 use `setupOrchestrationTest` and the IBC mocks. Starship is recorded as the v0.3 candidate for a single end-to-end confirmation, not as a harness. One thing to confirm on day 1, through the task 4 baseline check: that `contract-tests.ts` (shipped as TypeScript source) imports cleanly from a workspace outside the SDK monorepo under our loader. If it does not, the eval brief records the loader fix; the decision does not change.

The runner (v0.2) spawns `claude -p` and `codex exec --json` in fresh temp workspaces built the same way as the baseline workspaces, with and without the pack, three runs per configuration, and writes results to `docs/evals/`. Runs happen on Bob's Mac; CI runs only the checks against committed outputs, because the agent CLIs need Bob's logins and spend money.

**D5. Review gates: correctness pass by the project session against u23a until Agoric engages.**
The plan makes Kris's review of the idioms guide a hard gate before public v0.1. Agoric has not yet engaged (the format design note is unsent as of this brief). Until it does, the project session (the Claude chat that writes these briefs) performs the review against the u23a source and records it in `docs/notes/` as "correctness pass, Agoric review pending", with the date and the commit reviewed. That wording is mandatory on every such record, and on the v0.1 tag notes, so nobody later reads a correctness pass as an Agoric endorsement. When Kris does review, the note is amended, not replaced. Same rule applies to the Stage 0 manifest reviews already done.

## What Release 1 builds

Unchanged from the plan §2.3: core idioms guide, reference snippet corpus, common-error catalogue, project conventions, packaging and generation.

Additions and clarifications:

- Snippet sources are `examples/` at the pinned SDK (Offer Up checked against u23, send-anywhere at u23a) plus `basic-flows`, `auto-stake-it` and `unbond` from `agoric-sdk-u23/packages/orchestration/src/examples/`, copied API-exact into `packages/skills/snippets/` with commit and path noted. `stake-bld`, `stake-ica` and `swap` are marked work-in-progress upstream and are excluded. Nothing from dapp-orchestration-basics. Every snippet has a test under ses-ava in CI so it cannot rot; a snippet without a test is not a snippet.
- Three sections lift from `agoric-sdk/AGENTS.md` at a2a3de9 with attribution in the text and in `NOTICE`: Capability Security & POLA, Async-Flow Model Notes, and the copilot rule on returning vows. Lift, do not paraphrase; the point is to say what upstream says.
- `packages/core/src/hints.ts` grows to hold every catalogue entry. Entry shape: `code`, `match` (a regex or literal on the error text, or `silent` when there is no error), `cause`, `fix`, `refs` (skill and snippet paths). `agoric-errors` renders from it; the CLI's error type reads it. One source.
- `aat skills install --target claude|codex|cursor|copilot|all` copies the rendered target into the current directory. That is the install path for dapp authors and it keeps "a new tool is a subcommand" true. A Claude Code plugin manifest is v0.2.
- The conventions section points at `aat` for what exists (`schemas list`, `skills install`) and at `docs/context/claude_agoric-deploy-sequence.md` for what does not yet (Doctor, Release 2).
- No npm publish in v0.1. The tag is `skills-v0.1.0`, private repo. Publishing waits on the public flip and the `@dcfoundation` org.

## Error catalogue seed entries

Written into `hints.ts` on day 4, before the baseline findings are merged. Codes are provisional.

| Code | Match | Cause | Fix |
| :-- | :-- | :-- | :-- |
| `ZOE_EXPORTED_MISSING` | `Cannot find module '@agoric/zoe/exported.js'` | The `exported.js` entry no longer exists at u23; older tutorials import it for types | Import types from `@agoric/zoe` directly; remove the import |
| `ATOMIC_REARRANGE_HELPER` | Import of `atomicRearrange` from `@agoric/zoe/src/contractSupport` | Helper deprecated in favour of the ZCF method | `zcf.atomicRearrange(harden([...]))` |
| `CUSTOM_TERMS_SHAPE_LOCATION` | `customTermsShape` ignored, terms not validated | At u23 the shape is read from the contract's exported `meta` only | Export `meta = { customTermsShape }` from the contract module |
| `ENDO_MULTIPLE_SES` | `TypeError: Cannot redefine property: sliceToImmutable` | More than one copy of `ses` in the tree because `@endo/*` versions drifted from the SDK's | Pin `@endo/*` through a `resolutions` block matching the u23 lockfile (`docs/PINS.md`) |
| `SES_HARNESS_ENDOWMENTS` | Contract fails under a local SES harness but bundles for the chain | The harness endowed less than SwingSet does | Endow exactly `console`, `assert`, `TextEncoder`, `TextDecoder`; the harness is wrong, not the contract |

The twenty-two devnet sharp edges in `docs/context/claude_agoric-devnet-sharp-edges.md` are entered in the same table on day 4, with `match: silent` where the symptom is a hang or a code 0 with nothing moved. Entries 1, 8, 9, 14 and 17 are the ones the baseline is most likely to hit; check them first when tagging.

## Day plan, week 1 (v0.1)

| Day | Work | Done when |
| :-- | :-- | :-- |
| 1 | Baseline per D1: four workspaces, four runs, transcripts and diffs saved under `docs/notes/baseline-2026-09/`, SES bundle check, correctness check against u23a, failure-mode codes assigned. Confirm `contract-tests.ts` imports from outside the monorepo. | `docs/notes/baseline-2026-09/README.md` lists every defect with a code, per agent per task, and states the D4 loader result. |
| 2 | `packages/skills` package; `agoric-hardened-js`, `agoric-zoe-contract`, `agoric-durable-state`, `agoric-orchestration` sources with the three upstream lifts; every idiom has one correct snippet reference and one wrong snippet with its error. | Four SKILL.md files under the token limit; every wrong snippet's error text is a `match` in `hints.ts` or flagged as `silent`. |
| 3 | Snippet corpus: fifteen to twenty-five snippets from the sources above, each with a ses-ava test in CI; `agoric-testing` and `agoric-deploy` sources. | Snippet tests green in Actions; six SKILL.md files. |
| 4 | `hints.ts` seeded (table above, the twenty-two sharp edges, the baseline codes); `agoric-errors` rendered from it; conventions section; build script for all targets; drift test; token budget test with `gpt-tokenizer`. | `yarn skills:build` produces every target; `yarn test` fails on a stale `dist/` and on a 2,001-token `AGENTS.md`. |
| 5 | `aat skills install`; repo dogfoods via symlinks; docs site `ai/` section; correctness pass of the idioms guide by the project session, recorded per D5; `skills-v0.1.0` tag; push. | A fresh checkout of a bare dapp can run `aat skills install --target claude` and Claude Code lists the seven skills; CI green; the D5 note exists. |

Plan §2.7's "verified by one outside developer and one Agoric team member" becomes: Dean, if he is willing, does the outside developer check in week 2; the Agoric check is pending per D5. The v0.1 tag does not wait on either.

## Rules that carry over

- Every test runs under `@endo/ses-ava`. The baseline may show agents writing tests without it; the pack must not.
- `examples/` and `packages/skills/snippets/` are API-exact upstream copies. Never improve them. A snippet that needs changing to compile at u23 gets the change and a comment naming the upstream commit it diverges from.
- No `E()` on orchestration account methods inside flows. If a snippet from upstream appears to do this, stop and check the u23a source before copying; do not "fix" upstream.
- Regenerate `yarn.lock` after adding `packages/skills` and `packages/evals`.
- Do not modify anything under `~/Desktop/Agoric-L1/upstream/`. Do not rewrite pushed history. Do not flip the repo public. Stop and ask before any action outside the repo, which includes installing or logging into the Codex CLI. Correct the record forward when something was overclaimed.

## Not in v0.1

The eval harness and results page (v0.2, own brief). Starship. npm publish. Claude Code plugin packaging. An `llms.txt` for docs.agoric.com (v0.2 side item; cheap, do it after the pack exists). Anything for dapp-orchestration-basics. Doctor.

## Open until someone answers

- Codex CLI has to be installed and logged in on the Mac before day 1 (`npm install -g @openai/codex`, then `codex login`). Bob does this; Claude Code does not.
- Whether the format design note has gone to Kris. If not, it goes with the v0.1 correctness pass note as one message, so Agoric sees the review gap explicitly.
- Whether Dean will do the week 2 outside-developer check.
