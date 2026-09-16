# Upstream Agoric repos: pinned index and findings

Clones live at `~/Desktop/Agoric-L1/upstream/` on Bob's Mac Studio (shallow, depth 1, cloned 2026-09-15). `UPSTREAM.md` in that folder records the pins. Re-clone to update rather than pulling in place; the Cowork mount cannot run git write operations, so pulls have to happen from a native terminal.

| Repo | Commit | Commit date |
|---|---|---|
| Agoric/agoric-sdk | a2a3de9 | 2026-09-11 |
| Agoric/dapp-offer-up | 4ea27c5 | 2025-04-05 |
| Agoric/dapp-orchestration-basics | ebed14f | 2025-03-01 |
| Agoric/documentation | d89bd22 | 2026-04-28 |

## Paths, verified against the clones

Stage 0 format B (manifest) inputs:
- `dapp-offer-up/contract/src/offer-up.contract.js` (plus `offer-up-proposal.js`)
- `dapp-orchestration-basics/contract/src/orca.contract.js`, `orca.flows.js`, `orca.proposal.js`, `types.js`
- `agoric-sdk/packages/orchestration/src/examples/send-anywhere.contract.js` and `.flows.js`
- `agoric-sdk/packages/zoe/src/typeGuards.js` (proposal, invitation and offer shapes)
- `agoric-sdk/packages/orchestration/src/exos/exo-interfaces.ts` (the interface guards for orchestration exos, the closest upstream thing to a manifest source)

Release 1 idioms and snippet corpus:
- `agoric-sdk/packages/orchestration/USAGE.md` and `README.md`
- `agoric-sdk/packages/orchestration/src/examples/` with its own README. Current: basic-flows, send-anywhere, auto-stake-it, unbond. Marked work-in-progress upstream and not snippet material: stake-bld, stake-ica, swap. Also present: axelar-gmp, swap-anything, staking-combinations, shared.flows.js.
- `agoric-sdk/packages/zone/README.md`, `packages/vow/README.md`, `packages/async-flow/README.md`
- `agoric-sdk/packages/async-flow/docs/async-flow-states.md` (the activation lifecycle: Running, Sleeping, Replaying, Failed, Done)
- `agoric-sdk/packages/zoe/tools/setup-zoe.js` (`setUpZoeForTest`)
- `agoric-sdk/packages/orchestration/src/exos/` (chain-hub, orchestrator, local and cosmos orchestration accounts, ica-account-kit, icq-connection-kit, ibc-packet, local-chain-facade, remote-chain-facade) for trace event kinds in format A

Eval harness:
- `agoric-sdk/multichain-testing/` with Makefile, README and per-suite ava configs (fusdc, queries, rest, staking, xcs, ymd)

Docs contribution:
- `documentation/main/` (guides, reference, glossary, e2e-testing.md, what-is-agoric.md). No `llms.txt` anywhere in the repo as of d89bd22.

## Findings that affect the plan

**Upstream already has agent instructions, aimed at SDK maintainers.** `agoric-sdk/AGENTS.md` (83 lines, last touched 2026-09-11) and `.github/copilot-instructions.md` (27 lines). Content is repo mechanics: yarn workspaces, dprint, lint:types via tsgo, prepack workflow, A3P container notes, commit conventions. Three sections transfer directly to the Release 1 idioms guide and should be lifted with attribution rather than rewritten: the Capability Security and POLA section (facet placement, per-principal dispatch, narrowed capabilities, read-only first), the Async-Flow Model Notes (replay determinism, `Done` semantics, interleaving hazards), and the copilot rule "always return vows rather than promises in orchestration code." Nothing upstream teaches contract authoring from outside the SDK. The gap Release 1 fills is real.

**Codex has a skill format now.** `agoric-sdk/.agents/skills/` holds six skills, each a `SKILL.md` with an `agents/openai.yaml` sidecar (display_name, short_description, icons, brand_color). The plan's §2.2 assumption that Codex reads only `AGENTS.md` and has no skill format is out of date. Consequence: one SKILL.md source can target both Claude Code and Codex, with the YAML sidecar generated. The `AGENTS.md` size budget still matters but it no longer has to carry everything. The six upstream skills are all infrastructure (four Depot CI skills, dependency patching, Endo sync); none is for contract authors, so no overlap with Release 1.

**The two dapp repos are stale relative to the SDK.** dapp-offer-up pins `@agoric/zoe ^0.26.3-u16.1`; dapp-orchestration-basics pins zoe `^0.26.3-u17.1` and a patched dev build of `@agoric/orchestration` (0.2.0-upgrade-17-dev). Neither has moved in over a year. The SDK at a2a3de9 has zoe at 0.26.2 and orchestration at 0.1.0 in-tree (workspace versions, not the published `-uNN` tags). Before either dapp is used as a snippet source or a manifest subject, its contract has to be checked against current APIs. The send-anywhere example inside the SDK is the safer orchestration reference because it moves with the SDK.

**`packages/portfolio-contract/src/portfolio.exo.ts`** is what upstream AGENTS.md points at as the textbook POLA facet split (reader, reporter, manager, planner, evmHandler). Worth a read when writing the ocap idiom, and it is the same package the stale Servandum `agoric-sdk-ref` copy was taken from.
