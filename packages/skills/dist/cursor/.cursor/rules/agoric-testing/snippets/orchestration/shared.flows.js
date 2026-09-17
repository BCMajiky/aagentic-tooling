// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/shared.flows.js
//
// Changed from upstream: the 1 relative import of another @agoric/orchestration
// module (`'../x'`) names the package (`'@agoric/orchestration/src/x'`), because
// this copy lives outside the package. Nothing else differs.

/**
 * @file Flows shared by multiple examples
 *
 *   A module with flows can be used be reused across multiple contracts. They are
 *   bound to a particular contract's context via orchestrateAll. See
 *   ./send-anywhere.contract.js for example usage.
 */
/**
 * @import {Orchestrator, OrchestrationFlow, LocalAccountMethods} from '@agoric/orchestration/src/types.js';
 */

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @returns {Promise<LocalAccountMethods>}
 */
export const makeLocalAccount = async orch => {
  const agoricChain = await orch.getChain('agoric');
  return agoricChain.makeAccount();
};
harden(makeLocalAccount);
