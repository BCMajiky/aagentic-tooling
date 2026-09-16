# examples

Minimal Agoric contracts used by tests, snippets and the SES smoke job.

Nothing here yet. Stage 0 adds two, and both are `@agoric` API-exact copies of
upstream code — do not "improve" them:

| Example | Source | Arrives |
|---|---|---|
| `offer-up` | dapp-offer-up at 4ea27c5, checked against `@agoric/zoe 0.28.0-u23.1` | day 4 |
| `send-anywhere` | agoric-sdk at cc25a29 (tag `agoric-upgrade-23a`), contract and flows | day 5 |

They are the subjects of both the SES smoke job and the hand-authored contract
interface manifests (format B). Between them they exercise both `guard` values:
Offer Up's public facet is a bare `Far()` (`guard: "none"`), send-anywhere uses
`zone.exo` with `M.interface` (`guard: "interface"`).

Rules for anything added here: no `Date.now()`, no `Math.random()`, no network,
no filesystem. The SES smoke job exists to catch exactly that.
