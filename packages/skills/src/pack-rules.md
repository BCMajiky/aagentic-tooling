<!--
The silent-failure rules the pack AGENTS.md carries (RELEASE1-BRIEF.md D3),
as amended in docs/context/claude_plan-amendments.md on 2026-09-17: the fifth
rule replaces "a changed facet needs a fresh exo label". Day 4's render reads
this file; edit the rules here, not in a rendered AGENTS.md.
-->

- In an orchestration flow, never call `E()` on an account or chain; call its methods directly and `await` them.
- `harden` everything that crosses a boundary.
- Every test runs under `@endo/ses-ava`.
- No `Date.now()`, `Math.random()`, network or filesystem in contract code.
- On upgrade, redefine every durable kind with the same facets and methods or a superset, never a subset.
