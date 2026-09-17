// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { checkRef, parseRef } from '../src/refs.js';
import type { RefIo } from '../src/refs.js';

const io: RefIo = harden({
  repoPath: path => `/repo/${path}`,
  upstreamPath: (folder, path) => (folder === 'agoric-sdk-u23' ? `/up/${folder}/${path}` : undefined),
  exists: path => ['/repo/a.js', '/up/agoric-sdk-u23/b.js'].includes(path),
  lineCount: () => 10,
  isCatalogueCode: code => code === 'KNOWN_CODE',
});

test('parseRef reads each form', t => {
  t.deepEqual(parseRef('a.js#L2-L4'), { kind: 'repo', path: 'a.js', lines: { start: 2, end: 4 } });
  t.deepEqual(parseRef('a.js#L3'), { kind: 'repo', path: 'a.js', lines: { start: 3, end: 3 } });
  t.deepEqual(parseRef('agoric-sdk@cc25a29:b.js'), { kind: 'upstream', commit: 'cc25a29', path: 'b.js' });
  t.deepEqual(parseRef('catalogue:KNOWN_CODE'), { kind: 'catalogue', code: 'KNOWN_CODE' });
  t.deepEqual(parseRef('sharp-edge:22'), { kind: 'sharp-edge', n: 22 });
});

test('parseRef rejects malformed refs with a reason', t => {
  for (const bad of ['a.js#12', 'a.js#L4-L2', 'agoric-sdk@1234567:b.js', 'agoric-sdk@cc25a29', 'sharp-edge:23', 'catalogue:lower']) {
    t.is(typeof parseRef(bad), 'string', bad);
  }
});

test('checkRef resolves files, ranges and codes', t => {
  t.deepEqual(checkRef('a.js#L1-L10', io), []);
  t.is(checkRef('a.js#L1-L11', io).length, 1);
  t.is(checkRef('missing.js', io).length, 1);
  t.deepEqual(checkRef('agoric-sdk@cc25a29:b.js', io), []);
  t.is(checkRef('agoric-sdk@cc25a29:missing.js', io).length, 1);
  t.deepEqual(checkRef('catalogue:KNOWN_CODE', io), []);
  t.is(checkRef('catalogue:OTHER_CODE', io).length, 1);
});

test('checkRef skips upstream refs when the clone is absent, as in CI', t => {
  t.deepEqual(checkRef('agoric-sdk@a2a3de9:anything.md#L1-L9999', io), []);
});
