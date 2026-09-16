// SPDX-License-Identifier: Apache-2.0
//
// Copied from Agoric/agoric-sdk at commit cc25a29 (tag agoric-upgrade-23a),
// packages/orchestration/src/examples/shared.flows.js.
//
// The only change is to the intra-package relative imports: paths that pointed
// at sibling modules inside @agoric/orchestration now name the package
// explicitly. @agoric/orchestration has no "exports" field and ships src/, so
// the deep paths resolve. Nothing else has been touched; this is a format B
// and SES smoke subject and is meant to be @agoric API-exact.

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
