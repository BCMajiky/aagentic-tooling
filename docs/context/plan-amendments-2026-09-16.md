## 2026-09-16, Stage 0 decisions (append to claude_plan-amendments.md)

**§1.5 manifest subjects, decided.** Schema v0 carries `facets.<name>.guard` with values `interface` and `none`. Offer Up stays as the first subject with `guard: none`. Second subject is the SDK's `send-anywhere` at agoric-upgrade-23a, not orca. dapp-orchestration-basics is out of Stage 0.

**§2.3 toolchain pins, corrected.** Agoric packages pin to the `agoric-upgrade-23` dist-tag (zoe 0.28.0-u23.1, orchestration 0.3.0-u23.1), which is the current mainnet line, rather than the master clone's versions. Endo pins are read from the u23 dependency tree on day 1. Node 22 primary with 24 in the test matrix; yarn 4.17.1 via corepack. A second shallow clone of agoric-sdk at tag agoric-upgrade-23a is added under `upstream/` so read source matches installed packages.

**§1.2 npm scope.** `@dcfoundation` is the default, checked with `npm org ls dcfoundation` on day 1. Fallback `@aagentic`. All packages `private: true` through Stage 0.

**§1.7 and §1.8 remote and CI.** Private GitHub remote created day 1, CI verified in Actions, repo flipped to public and Pages enabled when §1.8 is met.

**Licence.** Apache-2.0 with a NOTICE file listing upstream sources and commits.
