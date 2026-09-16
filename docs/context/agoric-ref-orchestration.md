# Agoric Orchestration Reference for PactPay

Source: agoric-sdk/packages/orchestration/, docs.agoric.com, dapp-orchestration-basics
Retrieved: March 2026

---

## What Orchestration Does

Agoric's Orchestration API lets a Zoe smart contract control accounts on remote chains, move assets via IBC, and coordinate multi-chain operations. Contracts can create interchain accounts, transfer tokens, and await cross-chain responses across multiple blocks. This is what makes PactPay's "pay from anywhere" flow possible.

Three properties make this work:
- Remote account control via Interchain Accounts (ICA)
- Async/await with multi-block execution (contracts persist and resume)
- On-chain timers for scheduled operations

---

## Contract Structure Pattern

Orchestration contracts are split into two files:

### 1. Contract file (e.g., send-anywhere.contract.js)

Responsible for:
- Importing and configuring orchestration via `withOrchestration`
- Defining proposal shapes for offer validation
- Creating the `publicFacet` with invitation makers
- Setting up shared state (local accounts, logging)

### 2. Flows file (e.g., send-anywhere.flows.js)

Responsible for:
- Implementing the actual business logic as orchestration flows
- Receiving `orch` (orchestrator), `ctx` (contract context), `seat`, and `offerArgs`
- Performing chain lookups, asset transfers, and error handling

The contract binds flows to context using `orchestrateAll()`:

```javascript
const orchFns = orchestrateAll(flows, {
  log,
  sharedLocalAccountP,
  zoeTools,
});
```

---

## Key APIs

### Orchestrator (`orch`)

```javascript
const chain = await orch.getChain('agoric');    // Get chain object
const chain = await orch.getChain('osmosis');    // Remote chain
const account = await chain.makeAccount();        // Create ICA
const info = await chain.getChainInfo();          // Get chainId etc.
const assets = await chain.getVBankAssetInfo();   // Query registered assets
```

### OrchestrationAccount

```javascript
// Local account
const localAccount = await agoric.makeAccount();
await localAccount.deposit(payment);
await localAccount.transfer(destAddr, amount);

// Remote (Cosmos) account
const remoteAccount = await osmosis.makeAccount();
await remoteAccount.delegate(validator, amount);
await remoteAccount.getBalance(denom);
```

### Transfer address format

```javascript
{
  value: 'osmo1abc...',    // bech32 address
  encoding: 'bech32',
  chainId: 'osmosis-1'
}
```

### ZoeTools (provided via orchestration context)

```javascript
// Move assets from Zoe seat to local orchestration account
await localTransfer(seat, localAccount, give);

// Move assets from local orchestration account back to Zoe seat (for rollback)
await withdrawToSeat(localAccount, seat, give);
```

---

## Send Anywhere Contract (Annotated)

This is the closest existing pattern to PactPay's escrow contract.

### Contract Setup

```javascript
// Validate exactly one asset per transaction
export const SingleNatAmountRecord = M.and(
  M.recordOf(M.string(), AnyNatAmountShape, { numPropertiesLimit: 1 }),
  M.not(harden({}))
);
harden(SingleNatAmountRecord);

// Shared local account persists across incarnations
const sharedLocalAccountP = zone.makeOnce('localAccount', () =>
  makeLocalAccount()
);

// VStorage logging
const logNode = E(privateArgs.storageNode).makeChildNode('log');
const log = msg => vowTools.watch(E(logNode).setValue(msg));

// Bind flows with context
const orchFns = orchestrateAll(flows, {
  log,
  sharedLocalAccountP,
  zoeTools,
});

// Public facet using zone.exo for durability
const publicFacet = zone.exo(
  'Send PF',
  M.interface('Send PF', {
    makeSendInvitation: M.callWhen().returns(InvitationShape),
  }),
  {
    makeSendInvitation() {
      return zcf.makeInvitation(
        orchFns.sendIt,
        'send',
        undefined,
        M.splitRecord({ give: SingleNatAmountRecord }),
      );
    },
  },
);
```

### Flow: sendIt

```javascript
// Parameters: orch, ctx, seat, offerArgs

// 1. Validate offer args
mustMatch(offerArgs, harden({ chainName: M.scalar(), destAddr: M.string() }));
const { chainName, destAddr } = offerArgs;

// 2. Extract proposal
const { give } = seat.getProposal();
const [[_kw, amt]] = entries(give);

// 3. Verify asset is registered on local chain
const agoric = await orch.getChain('agoric');
const assets = await agoric.getVBankAssetInfo();
const { denom } = NonNullish(
  assets.find(a => a.brand === amt.brand),
  `${amt.brand} not registered in vbank`
);

// 4. Get destination chain info
const chain = await orch.getChain(chainName);
const info = await chain.getChainInfo();
const { chainId } = info;

// 5. Transfer: seat -> local account -> remote
const sharedLocalAccount = await sharedLocalAccountP;
await localTransfer(seat, sharedLocalAccount, give);

try {
  await sharedLocalAccount.transfer(
    { value: destAddr, encoding: 'bech32', chainId },
    { denom, value: amt.value }
  );
} catch (e) {
  // 6. Rollback on failure
  await withdrawToSeat(sharedLocalAccount, seat, give);
  const errorMsg = `IBC Transfer failed ${q(e)}`;
  seat.exit(errorMsg);
  throw makeError(errorMsg);
}
```

---

## Example Orchestration Contracts in agoric-sdk

Location: `packages/orchestration/src/examples/`

| Contract | What it demonstrates |
|----------|---------------------|
| basic-flows.contract.js | Account creation, query sending |
| send-anywhere.contract.js | Cross-chain token transfers |
| auto-stake-it.contract.js | Auto-stake received tokens via IBC hooks |
| unbond.contract.js | Cross-chain unbonding and transfer |
| stake-bld.contract.js | BLD staking on Agoric (WIP) |
| stake-ica.contract.js | ICA creation for remote staking (WIP) |

### APIs used by each example

**send-anywhere**: orch.getChain(), chain.getVBankAssetInfo(), chain.makeAccount(), localAccount.deposit(), localAccount.transfer(), zoeTools.localTransfer()

**auto-stake-it**: orch.getChain(), chain.makeAccount(), localOrchAccount.monitorTransfers(), cosmosOrchAccount.delegate()

**basic-flows**: orch.getChain(), chain.makeAccount() (local + remote), interchain queries

---

## Relevance to PactPay

### What PactPay borrows from send-anywhere:
- `withOrchestration` wrapper pattern
- Local account as intermediate holding (escrow account)
- `localTransfer` from seat to contract-held account
- Asset validation against vbank registry
- Error rollback with `withdrawToSeat`

### What PactPay adds:
- Two-party escrow (payer locks, both confirm to release)
- Timer-based expiry (funds return if no action)
- Dispute resolution state machine
- Protocol fee deduction at settlement
- Cross-chain funding via Fast USDC (Ethereum -> Agoric)

### Mapping to PactPay contract design:

| send-anywhere concept | PactPay equivalent |
|----------------------|-------------------|
| sharedLocalAccountP | escrow holding account |
| sendIt flow | lockFunds / releaseFunds / refundFunds flows |
| Single transfer | Lock on create, release on confirm |
| Immediate send | Hold until both parties confirm or timer expires |
| One publicFacet method | Multiple: createEscrow, confirmDelivery, confirmRelease, dispute |

---

## dapp-orchestration-basics Structure

Repo: github.com/Agoric/dapp-orchestration-basics

```
dapp-orchestration-basics/
  contract/
    src/           # Contract source
    Makefile       # Build, deploy, fund commands
    package.json
  ui/              # React frontend
  api/             # API layer
  e2e-testing/     # End-to-end tests
  package.json     # Workspace root
```

Key commands:
- `make fund` - Fund test accounts
- `make e2e` - Build and deploy contract
- `yarn dev` (in ui/) - Start frontend

This is the template structure PactPay should follow.
