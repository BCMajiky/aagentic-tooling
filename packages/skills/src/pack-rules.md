<!--
The silent-failure rules the pack AGENTS.md carries (RELEASE1-BRIEF.md D3),
as amended in docs/context/claude_plan-amendments.md on 2026-09-17: the fifth
rule replaces "a changed facet needs a fresh exo label", and the last six were
added by the day 5 correctness pass. Day 4's render reads this file; edit the
rules here, not in a rendered AGENTS.md.
-->

- In an orchestration flow, never call `E()` on an account or chain; call its methods directly and `await` them.
- `harden` everything that crosses a boundary.
- Every test runs under `@endo/ses-ava`.
- No `Date.now()`, `Math.random()`, network or filesystem in contract code.
- On upgrade, redefine every durable kind with the same facets and methods or a superset, never a subset.
- Host code that a flow waits on returns vows, not promises.
- In a flow, compute anything you will publish before the first `await`.
- vstorage path segments are ASCII alphanumerics, underscores and dashes only.
- Install bundles with explicit gas (`--gas 100000000`), then query the chain for the bundle id before relying on it.
- Wallet actions that move funds need `--allow-spend`.
- Create singletons (accounts, vow kits, anything that must exist once) with `zone.makeOnce`.
