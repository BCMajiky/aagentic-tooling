# Zoe Contract Patterns Reference for PactPay

Source: docs.agoric.com, dapp-offer-up, agoric-sdk example contracts
Retrieved: March 2026

---

## Zoe Fundamentals

Zoe is Agoric's smart contract framework. Its core guarantee: offer safety. Every offer either gets what it asked for or gets a full refund. There is no state where assets can be lost.

Key concepts:
- **Installation**: identifies contract code on-chain
- **Instance**: a running contract created from an installation with specific terms
- **Invitation**: a capability to participate in a contract (make an offer)
- **Seat**: represents a party's position in a contract (holds escrowed assets)
- **Proposal**: what a party wants to give and get ({ give, want, exit })
- **ProposalShape**: contract-defined validation of what proposals are acceptable

---

## Contract Lifecycle

```
1. Bundle contract source        -> bundleSource()
2. Install on-chain              -> E(zoe).install(bundle)
3. Start instance with terms     -> E(zoe).startInstance(installation, issuers, terms)
4. Get publicFacet               -> E(zoe).getPublicFacet(instance)
5. Get invitation                -> E(publicFacet).makeInvitation()
6. Make offer                    -> E(zoe).offer(invitation, proposal, payments)
7. Get result/payout             -> E(seat).getOfferResult() / E(seat).getPayout(keyword)
```

---

## offer-up.contract.js (Full Source)

This is the reference contract from dapp-offer-up. It demonstrates core Zoe patterns: minting, atomic rearrangement, proposal shapes, and the publicFacet pattern.

```javascript
/** @file Contract to mint and sell a few Item NFTs at a time. */
// @ts-check

import { Far } from '@endo/far';
import { M, getCopyBagEntries } from '@endo/patterns';
import { AssetKind } from '@agoric/ertp/src/amountMath.js';

const { Fail, quote: q } = assert;

const sum = xs => xs.reduce((acc, x) => acc + x, 0n);

const bagCounts = bag => {
  const entries = getCopyBagEntries(bag);
  return entries.map(([_k, ct]) => ct);
};

/**
 * @typedef {{
 *   tradePrice: Amount;
 *   maxItems?: bigint;
 * }} OfferUpTerms
 */

/** @param {ZCF<OfferUpTerms>} zcf */
export const start = async zcf => {
  const { tradePrice, maxItems = 3n } = zcf.getTerms();

  // Create a mint for NFT items
  const itemMint = await zcf.makeZCFMint('Item', AssetKind.COPY_BAG);
  const { brand: itemBrand } = itemMint.getIssuerRecord();

  // Seat to collect payment proceeds
  const proceeds = zcf.makeEmptySeatKit().zcfSeat;

  /** @type {OfferHandler} */
  const tradeHandler = buyerSeat => {
    const { want } = buyerSeat.getProposal();

    // Validate item count
    sum(bagCounts(want.Items.value)) <= maxItems ||
      Fail`max ${q(maxItems)} items allowed: ${q(want.Items)}`;

    // Mint requested items
    const newItems = itemMint.mintGains(want);

    // Atomic rearrangement: move price and items simultaneously
    zcf.atomicRearrange(
      harden([
        [buyerSeat, proceeds, { Price: tradePrice }],  // price from buyer to proceeds
        [newItems, buyerSeat, want],                     // items to buyer
      ]),
    );

    buyerSeat.exit(true);
    newItems.exit();
    return 'trade complete';
  };

  // Define what a valid proposal looks like
  const proposalShape = harden({
    give: { Price: M.gte(tradePrice) },
    want: { Items: { brand: itemBrand, value: M.bag() } },
    exit: M.any(),
  });

  const makeTradeInvitation = () =>
    zcf.makeInvitation(tradeHandler, 'buy items', undefined, proposalShape);

  const publicFacet = Far('Items Public Facet', {
    makeTradeInvitation,
  });

  return harden({ publicFacet });
};

harden(start);
```

---

## Key Zoe APIs

### ZCF (Zoe Contract Facet) - available inside contracts

```javascript
// Get contract terms
const { myTerm } = zcf.getTerms();

// Create a mint (for issuing new assets)
const mint = await zcf.makeZCFMint('TokenName', AssetKind.NAT);

// Create an empty seat (contract-internal position)
const { zcfSeat, userSeat } = zcf.makeEmptySeatKit();

// Create an invitation
zcf.makeInvitation(offerHandler, description, customProperties, proposalShape);

// Atomic rearrangement (move assets between seats)
zcf.atomicRearrange(harden([
  [fromSeat, toSeat, { Keyword: amount }],
]));

// Save an issuer the contract needs to know about
await zcf.saveIssuer(issuer, 'Keyword');

// Shut down the contract
zcf.shutdown('reason');
```

### Seat methods

```javascript
// Inside an offer handler, the seat represents the offering party
const { give, want } = seat.getProposal();
seat.exit();                        // Normal exit
seat.exit('reason');                // Exit with message
seat.fail(error);                   // Exit with failure
const payout = seat.getPayout('Keyword');  // (on UserSeat, not ZCFSeat)
```

### Proposal Shapes (validation via @endo/patterns)

```javascript
import { M } from '@endo/patterns';

// Exact match
M.eq(value)

// Greater than or equal (for amounts)
M.gte(amount)

// Any value
M.any()

// String
M.string()

// Record shape
M.splitRecord({ give: ..., want: ... })

// Specific structure
{ give: { Price: M.gte(minPrice) }, want: { Items: { brand: itemBrand, value: M.bag() } } }
```

### atomicRearrange

The core mechanism for moving assets between seats. All movements happen atomically. Zoe verifies conservation of assets and offer safety.

```javascript
zcf.atomicRearrange(harden([
  [fromSeat, toSeat, amountKeywordRecord],
  // Can include multiple movements
  [seatA, seatB, { Token: amount1 }],
  [seatB, seatC, { Token: amount2 }],
]));
```

---

## Example Zoe Contracts Relevant to PactPay

### Atomic Swap

Two-party exchange. Each party gives one thing and gets another. Closest simple pattern to escrow.

Location: agoric-sdk, documented at docs.agoric.com/guides/zoe/contracts/atomic-swap

Pattern:
1. Party A creates instance, makes first offer (deposits asset)
2. Gets invitation for Party B
3. Party B makes counter-offer
4. Contract atomically swaps assets between seats

### Escrow To Vote

Locks tokens in escrow, releases based on governance action. Relevant pattern for time-locked escrow.

Location: docs.agoric.com/guides/zoe/contracts/escrow-to-vote

### Covered Call

Option contract pattern. Party A deposits, gets invitation that can be exercised by Party B. If not exercised, funds return. Timer-based expiry.

Location: docs.agoric.com/guides/zoe/contracts/covered-call

---

## Durable Contract Pattern

For contracts that survive chain upgrades (PactPay needs this):

```javascript
import { M } from '@endo/patterns';
import { prepareExoClass } from '@agoric/vat-data';

// zone.makeOnce for one-time initialization
const state = zone.makeOnce('escrowState', () => ({
  status: 'pending',
}));

// zone.exo for durable remotely-accessible objects
const publicFacet = zone.exo('PactPay PF', InterfaceGuard, {
  // methods
});
```

---

## Client-Side Offer Pattern

How the frontend makes an offer to a Zoe contract:

```javascript
// 1. Get contract instance (from agoricNames or board)
const instance = await E(agoricNames).lookup('instance', 'PactPay');

// 2. Get public facet
const publicFacet = await E(zoe).getPublicFacet(instance);

// 3. Get invitation
const invitation = await E(publicFacet).makeEscrowInvitation();

// 4. Construct proposal
const proposal = {
  give: { Price: { brand: usdcBrand, value: 100000000n } },  // 100 USDC
  want: {},
  exit: { afterDeadline: { deadline: timerDeadline, timer } },
};

// 5. Make offer via smart wallet
// InvitationSpec for smart wallet:
const invitationSpec = {
  source: 'contract',
  instance,
  publicInvitationMaker: 'makeEscrowInvitation',
  invitationArgs: [escrowId],
};
```

---

## Relevance to PactPay Contract Design

### Core Zoe patterns PactPay will use:

| Pattern | Where in PactPay |
|---------|-----------------|
| `zcf.makeInvitation` | Create/fund escrow, confirm delivery, release funds |
| `proposalShape` | Validate USDC deposit amount |
| `atomicRearrange` | Move USDC between escrow seat and payer/payee seats |
| `zcf.makeEmptySeatKit` | Contract-held escrow seat |
| `seat.exit()` | Close out completed escrows |
| `Far()` publicFacet | Expose createEscrow, getEscrowStatus, etc. |
| `zone.exo` | Durable public facet that survives upgrades |
| Timer service | Escrow expiry / auto-refund |

### PactPay-specific additions beyond standard patterns:

- Multi-step offer flow (lock, confirm, release are separate offers)
- Escrow state machine (pending -> funded -> delivered -> released | disputed | expired)
- Protocol fee extraction from settlement amount
- Cross-chain deposit via Orchestration (combines Zoe + Orchestration patterns)
