import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { setupOrchestrationTest } from '@agoric/orchestration/tools/contract-tests.ts';
import { buildVTransferEvent } from '@agoric/orchestration/tools/ibc-mocks.ts';

test('setupOrchestrationTest runs from a workspace outside the SDK monorepo', async t => {
  const { bootstrap, commonPrivateArgs, utils } = await setupOrchestrationTest({ log: t.log });
  t.truthy(bootstrap.cosmosInterchainService);
  t.truthy(commonPrivateArgs.localchain);
  t.is(typeof utils.transmitVTransferEvent, 'function');
  t.is(typeof buildVTransferEvent, 'function');
});
