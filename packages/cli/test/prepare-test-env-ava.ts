// SPDX-License-Identifier: Apache-2.0

// See packages/core/test/prepare-test-env-ava.ts for why this file exists.

import { wrapTest } from '@endo/ses-ava';
import rawTest from 'ava';

export const test = wrapTest(rawTest);
