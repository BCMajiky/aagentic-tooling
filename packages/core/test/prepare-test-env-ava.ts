// SPDX-License-Identifier: Apache-2.0

// Test setup is one of the two places `@endo/init` is allowed (the other is a
// CLI entrypoint). It is loaded by ava's `require` config, before this module,
// so `harden` and a locked-down intrinsic set are already in place here.
//
// Derived from agoric-sdk packages/base-zone/test/prepare-test-env-ava.js
// at commit cc25a29 (tag agoric-upgrade-23a).

import { wrapTest } from '@endo/ses-ava';
import rawTest from 'ava';

export const test = wrapTest(rawTest);
