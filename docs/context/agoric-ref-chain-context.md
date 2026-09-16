# Agoric Chain Context and Fast USDC Reference for PactPay

Source: docs.agoric.com, agoric-sdk releases, Agoric repos
Retrieved: March 2026

---

## Chain Overview

Agoric is a proof-of-stake chain in the Cosmos IBC ecosystem.

- **Consensus**: CometBFT (Cosmos SDK v0.47.17 as of upgrade-21)
- **Smart contracts**: Hardened JavaScript via Endo platform
- **Security model**: Object-capability based
- **Smart contract framework**: Zoe (offer safety guarantees at protocol level)
- **Cross-chain**: IBC native, Orchestration API for programmatic control
- **Staking token**: BLD
- **Stable asset**: USDC via Noble (IST has been deprecated and is being sunset)

### Current chain version

agoric-upgrade-21 is the latest release. Key changes:
- Cosmos SDK migrated to v0.47.17
- IST to BLD transitioning for Inter Protocol sunset
- Orchestration and Fast USDC improvements
- Node.js 18 no longer supported (requires ^20.9 or ^22.11)
- Requires corepack enable before building

---

## Fast USDC

Fast USDC is Agoric's product for near-instant USDC transfers over IBC. It reduces cross-chain USDC transfer times from 20+ minutes to under one minute.

### How it works

- Uses Circle's CCTP (Cross-Chain Transfer Protocol) for EVM-to-Cosmos USDC movement
- Agoric Orchestration handles the routing and settlement
- Liquidity providers on Agoric provide immediate liquidity while CCTP settlement completes
- Settlement is in native USDC via Noble

### Relevant repos

- **fast-usdc-lp-ui** (github.com/Agoric/fast-usdc-lp-ui): LP interface for Fast USDC. TypeScript. Shows how Agoric's team integrates Fast USDC in a production app.
- Fast USDC contract code lives within agoric-sdk

### PactPay integration path

PactPay's "Pay from Ethereum" flow would use Fast USDC:
1. Payer initiates USDC transfer from Ethereum
2. Fast USDC routes it through CCTP + Agoric Orchestration
3. USDC arrives on Agoric and is deposited into the escrow contract
4. From the payer's perspective: one transaction, funds appear locked

Open question from project brief: How mature is the Fast USDC integration for third-party apps? The LP UI exists but developer-facing integration docs for third-party contracts may be limited.

---

## USDC on Agoric

- USDC reaches Agoric via Noble over IBC
- Denom on Agoric: IBC denom hash of Noble USDC (ibc/...)
- The vbank registry maps denoms to brands
- Contracts query `chain.getVBankAssetInfo()` to find registered assets
- All PactPay settlements are in USDC. No other payment assets.

---

## Agoric Dapp Structure

Standard dapp layout (from dapp-offer-up and dapp-orchestration-basics):

```
project-root/
  contract/
    src/
      contract.js          # Main contract (start function)
      contract.flows.js    # Orchestration flows (if using orchestration)
      proposal.js          # CoreEval proposal for deployment
    test/
      test-contract.js     # Unit tests (ava)
    Makefile               # Build, deploy, fund commands
    package.json
  ui/
    src/
      App.tsx              # React app
      components/          # UI components
    package.json
  package.json             # Workspace root
  yarn.lock
```

### Contract deployment

Agoric uses permissioned contract deployment via CoreEval governance proposals:

1. Bundle the contract: `agoric run` or `bundleSource()`
2. Install bundles on-chain: `agd tx swingset install-bundle`
3. Submit governance proposal: `agd tx gov submit-proposal swingset-core-eval`
4. Vote and pass
5. Contract instance starts automatically

For local development:
- `yarn start:docker` starts local Agoric chain
- `yarn start:contract` deploys to local chain
- `yarn start:ui` starts frontend dev server

### Wallet connection

Agoric uses Keplr wallet. The ui-kit repo (github.com/Agoric/ui-kit) provides:
- Wallet connection components
- Offer signing and submission
- VStorage querying utilities

Client dapps interact via the Smart Wallet architecture:
- Format an offer with InvitationSpec
- Sign and broadcast via Keplr
- walletFactory routes to smartWallet
- smartWallet calls E(zoe).offer()

---

## Key Agoric Repos

| Repo | Purpose | Relevance to PactPay |
|------|---------|---------------------|
| agoric-sdk | Core platform monorepo | Contract framework, Orchestration API, Zoe |
| dapp-orchestration-basics | Orchestration sample dapp | Template for cross-chain contract + UI structure |
| dapp-offer-up | Simple marketplace dapp | Template for Zoe contract + UI integration |
| dapp-agoric-basics | Three example contracts | Zoe patterns: sell, swap, postal service |
| ui-kit | UI component library | Wallet connection, offer submission |
| fast-usdc-lp-ui | Fast USDC LP interface | Fast USDC frontend integration patterns |
| agoric-dev-mcp | MCP server for Agoric dev | Potential direct integration with Claude |
| documentation | docs.agoric.com source | Authoritative docs |

---

## Hardened JavaScript Notes

Agoric contracts run in Hardened JavaScript (SES - Secure ECMAScript):

- All objects must be hardened: `harden({})` 
- No ambient authority (no `fetch`, no `fs`, no `Math.random`)
- `Far()` marks objects as remotely accessible
- `E()` for eventual sends to remote objects
- No nested awaits in contract code (use vows/vowTools instead)
- `assert`, `Fail`, and `q()` for error handling

```javascript
import { Far } from '@endo/far';
import { E } from '@endo/eventual-send';

// Far marks object as pass-by-reference (remotely accessible)
const publicFacet = Far('MyFacet', { myMethod() { ... } });

// E() for calling methods on remote objects
const result = await E(remoteObj).someMethod(args);

// Assertions
const { Fail, quote: q } = assert;
amount > 0n || Fail`amount must be positive: ${q(amount)}`;
```

---

## Object-Capability Security

Authority in Agoric is passed as object references, not checked through access control lists.

- If you have a reference to an object, you can call its methods
- If you don't have the reference, you can't access it
- Contracts receive only the capabilities they need via `privateArgs`
- `zone.exo()` creates durable objects with interface guards

This means PactPay's escrow contract only exposes what it should:
- publicFacet: createEscrow, getStatus (anyone can call)
- creatorFacet: admin functions (only deployer has this reference)
- Invitation capabilities: only holders of specific invitations can confirm/release

---

## Timer Service

Contracts can use the on-chain timer for:
- Deadline-based exit conditions on offers
- Scheduled wake-ups for automated actions
- Expiry logic

```javascript
// In offer proposal (client side)
exit: {
  afterDeadline: {
    deadline: TimeMath.addAbsRel(currentTime, RelativeTime(7n * 24n * 60n * 60n)),
    timer: chainTimerService,
  }
}
```

PactPay needs timers for:
- Escrow expiry (auto-refund after N days)
- Dispute resolution windows
- Potential recurring/subscription payments (future)

---

## What to Upload to Project Files

Priority files to retrieve from GitHub and add to this project:

### Must have (blocks contract development without them):
1. `send-anywhere.contract.js` + `send-anywhere.flows.js` from agoric-sdk orchestration examples
2. `USAGE.md` from agoric-sdk/packages/orchestration/

### Very helpful (accelerates development):
3. `dapp-orchestration-basics/contract/src/` main contract file
4. `dapp-offer-up/contract/src/offer-up.contract.js` (full source included in 02-zoe-contract-patterns.md)

### Worth investigating:
5. `agoric-dev-mcp` repo contents (could plug into Claude workflow directly)
6. Fast USDC contract source from agoric-sdk (for third-party integration patterns)
