// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { catalogue } from '../src/hints.js';
import { checkRef, makeRefIo } from '../src/refs.js';

const codes = new Set(catalogue.map(e => e.code));
const io = makeRefIo({
  // Compiled tests run from packages/core/dist/test/.
  repoRoot: fileURLToPath(new URL('../../../../', import.meta.url)),
  exists: existsSync,
  readText: path => readFileSync(path, 'utf8'),
  isCatalogueCode: code => codes.has(code),
});

test('the catalogue is hardened', t => {
  t.true(Object.isFrozen(catalogue));
  for (const entry of catalogue) {
    t.true(Object.isFrozen(entry));
    t.true(Object.isFrozen(entry.refs));
  }
});

test('codes are unique and UPPER_SNAKE', t => {
  const seen = new Set<string>();
  for (const { code } of catalogue) {
    t.regex(code, /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/);
    t.false(seen.has(code), `${code} appears twice`);
    seen.add(code);
  }
});

test('every entry has a cause, a fix and at least one ref', t => {
  for (const { code, cause, fix, refs } of catalogue) {
    t.true(cause.length > 20, `${code} has a stub cause`);
    t.true(fix.length > 20, `${code} has a stub fix`);
    t.true(refs.length > 0, `${code} has no refs`);
  }
});

test('every match is a literal, a regex that compiles, or silent', t => {
  for (const { code, match } of catalogue) {
    switch (match.kind) {
      case 'literal':
        t.true(match.text.length > 5, `${code} literal is too short to match on`);
        break;
      case 'regex':
        t.notThrows(() => new RegExp(match.source), `${code} regex does not compile`);
        break;
      case 'silent':
        break;
      default:
        t.fail(`${code} has an unknown match kind`);
    }
  }
});

test('regex and literal matches accept the error text they were written from', t => {
  // One real message per non-silent entry, as reproduced or quoted in
  // docs/notes/baseline-2026-09/README.md and the u23a source. If a match is
  // edited so it no longer recognises its own error, this fails.
  const samples: Record<string, string> = {
    ZOE_EXPORTED_MISSING:
      'Cannot find file for internal module "./exported.js" (with candidates "./exported.js") in package file:///w/node_modules/@agoric/zoe/',
    ATOMIC_REARRANGE_HELPER:
      "import { atomicRearrange } from '@agoric/zoe/src/contractSupport/index.js';",
    ENDO_MULTIPLE_SES: 'TypeError: Cannot redefine property: sliceToImmutable',
    YARN_PNP_DEFAULT: "Error: EROFS: read-only filesystem, mkdir '/node_modules/bundles'",
    ENDO_ERRORS_BEFORE_SES:
      "Error: Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'",
    VATDATA_UNAVAILABLE: 'Error#1: VatData unavailable',
    OFFER_SAFETY_VIOLATION:
      'Offer safety was violated by the proposed allocation: {"Item":{}}. Proposal was {}',
    BUNDLE_UNDECLARED_DEP:
      'Failed to load module "./src/c.js" in package "file:///w/" (2 underlying failures: Cannot find external module "@endo/patterns" in package file:///w/',
    PROPOSAL_SHAPE_MISMATCH:
      '"fund Osmosis account" proposal: exit: {"onDemand":null} - Must be: {"waived":null}',
    ORCH_TEST_TOOLS_TS:
      'Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules',
    PASS_STYLE_NOT_FROZEN: 'Cannot pass non-frozen objects like {"a":1}. Use harden()',
    FAR_NON_METHOD:
      'cannot serialize Remotables with non-methods like "value" in {"get":"[Function get]","value":1}',
    PATTERN_MISMATCH: 'offerArgs: chainName: number 42 - Must be a string',
    SES_TAMED_DATE_RANDOM: 'secure mode Calling %SharedDate%.now() throws',
    OFFER_HANDLER_UNDEFINED_REASON:
      'If an offerHandler throws, it must provide a reason of type Error, but the reason was undefined.',
    DURABLE_STATESHAPE_MISMATCH: 'durable Kind stateShape mismatch (body price)',
    START_VALUES_NOT_DURABLE:
      'with "canUpgrade", values from start() must be durable {"publicFacet":false}',
    DURABLE_VALUE_NOT_DURABLE: 'value is not durable: [object Alleged: x] at slot 0 of {}',
    E_IN_FLOW:
      'guest eventual applyMethod not yet supported: [object Alleged: account].transfer -> [object Promise]',
  };
  for (const { code, match } of catalogue) {
    if (match.kind === 'silent') {
      t.false(code in samples, `${code} is silent but has a sample message`);
      continue;
    }
    const sample = samples[code];
    t.truthy(sample, `${code} has no sample message in this test`);
    if (sample === undefined) continue;
    const hit =
      match.kind === 'literal'
        ? sample.includes(match.text)
        : new RegExp(match.source).test(sample);
    t.true(hit, `${code} does not match its own sample`);
  }
});

test('overlapping codes cross-reference each other', t => {
  const byCode = new Map(catalogue.map(e => [e.code, e]));
  const pairs: Array<[string, string]> = [
    ['CUSTOM_TERMS_SHAPE_MISSING', 'CUSTOM_TERMS_SHAPE_LOCATION'],
    ['PROPOSAL_SHAPE_MISSING', 'PROPOSAL_SHAPE_MISMATCH'],
  ];
  for (const [a, b] of pairs) {
    t.true(byCode.get(a)?.refs.includes(`catalogue:${b}`), `${a} does not point at ${b}`);
    t.true(byCode.get(b)?.refs.includes(`catalogue:${a}`), `${b} does not point at ${a}`);
  }
});

test('every ref resolves', t => {
  for (const { code, refs } of catalogue) {
    for (const ref of refs) {
      t.deepEqual(checkRef(ref, io), [], `${code}: ${ref}`);
    }
  }
});
