// SPDX-License-Identifier: Apache-2.0

// Shared test setup for the snippet corpus. Everything here is a published
// tool; nothing from the SDK's unpublished test/supports.ts is copied.

import { makeIssuerKit } from '@agoric/ertp';
import { assetOn } from '@agoric/orchestration/src/utils/asset.js';
import { setupOrchestrationTest } from '@agoric/orchestration/tools/contract-tests.ts';
import { setUpZoeForTest } from '@agoric/zoe/tools/setup-zoe.js';
import { withAmountUtils } from '@agoric/zoe/tools/test-utils.js';
import { E } from '@endo/far';

/** Absolute path of a snippet file, for bundling from a path. */
export const snippetPath = relative =>
  new URL(`../${relative}`, import.meta.url).pathname;

/**
 * Zoe with the contract bundled from its file path (not from an imported
 * module namespace, which would skip bundling: TEST_BUNDLE_BYPASS).
 */
export const startZoeWith = async relative => {
  const { zoe, bundleAndInstall } = await setUpZoeForTest();
  const installation = await bundleAndInstall(snippetPath(relative));
  return { zoe, installation };
};

/**
 * The published `setupOrchestrationTest`, plus the BLD and IST assets.
 *
 * `setupOrchestrationTest` at @agoric/orchestration 0.3.0-u23.1 creates the
 * fake bank and the `vbankAsset` name space but registers no assets, and its
 * `commonPrivateArgs` carry no `assetInfo`; the SDK's own tests get both from
 * the unpublished `commonSetup`. These lines do the same with published calls
 * only: the bank and vbankAsset registration, and `assetInfo` for contracts
 * that call `registerChainsAndAssets`.
 *
 * @param {import('ava').ExecutionContext} t
 */
export const setupOrchestrationWithAssets = async t => {
  const env = await setupOrchestrationTest({ log: t.log });
  const { bankManager, agoricNamesAdmin } = env.bootstrap;

  const bld = withAmountUtils(makeIssuerKit('BLD'));
  const ist = withAmountUtils(makeIssuerKit('IST'));
  await E(bankManager).addAsset('ubld', 'BLD', 'Staking Token', bld.issuerKit);
  await E(bankManager).addAsset('uist', 'IST', 'Inter Stable Token', ist.issuerKit);

  const vbankAssetAdmin = E(agoricNamesAdmin).lookupAdmin('vbankAsset');
  for (const [denom, kit, issuerName] of /** @type {const} */ ([
    ['uist', ist, 'IST'],
    ['ubld', bld, 'BLD'],
  ])) {
    await E(vbankAssetAdmin).update(
      denom,
      harden({
        brand: kit.brand,
        issuer: kit.issuer,
        issuerName,
        denom,
        proposedName: issuerName,
        displayInfo: { assetKind: 'nat', IOU: true },
      }),
    );
  }
  const assetInfo = harden([
    assetOn('ubld', 'agoric', bld.brand),
    assetOn('uist', 'agoric', ist.brand),
  ]);
  return {
    ...env,
    commonPrivateArgs: { ...env.commonPrivateArgs, assetInfo },
    brands: { bld, ist },
  };
};
