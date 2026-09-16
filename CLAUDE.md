# aagentic-tooling

Developer tooling for the Agoric L1, built to compound: every later tool is one workspace package plus one `aat` subcommand.

Start with `STAGE0-BRIEF.md`. It says what to build this week, what is already decided, and the two decisions to raise with Bob before day 4.

Reference material is in `docs/context/`. Upstream Agoric repos are pinned shallow clones at `../upstream/` (see `../upstream/UPSTREAM.md`); read them, never modify them.

Rules that apply to every file here:

- Node `^22.11 || ^24.14`, yarn 4 via corepack, ESM.
- Tests run under `@endo/ses-ava`. `@endo/init` only in entrypoints and test setup.
- Ambient authority stays in CLI entrypoints; modules take capabilities as arguments.
- Every command supports `--json`. Exit codes: 0 ok, 1 findings, 2 usage error, 3 environment error.
- No telemetry.
- Conventional commits, one concern per commit. No push until Bob confirms the remote.
- When unsure about an Agoric or Endo API, grep `../upstream/agoric-sdk` before writing code.
