// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PATTERN_KINDS } from '../src/contract-manifest/patterns.js';
import { validateContractManifest } from '../src/contract-manifest/validate.js';
import { CONTRACT_MANIFEST_SCHEMA_ID } from '../src/contract-manifest/types.js';
import { formats } from '../src/registry.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDir = `${packageRoot}fixtures/contract-manifest/v0`;

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

const jsonFiles = (dir: string): string[] =>
  readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort();

// --- the hand-authored manifest ------------------------------------------

test('the Offer Up manifest validates', t => {
  const manifest = readJson(`${fixtureDir}/valid/offer-up.json`);
  const result = validateContractManifest(manifest);
  if (!result.valid) {
    t.fail(
      `offer-up.json failed:\n${result.issues
        .map(issue => `  ${issue.path} ${issue.code}: ${issue.message}`)
        .join('\n')}`,
    );
    return;
  }
  t.pass();
});

test('the Offer Up manifest records an unguarded public facet', t => {
  // D2. This is the whole reason Offer Up is a subject: its public facet is a
  // bare Far() and the format has to describe it honestly rather than refuse.
  const manifest = readJson(`${fixtureDir}/valid/offer-up.json`) as {
    facets: Record<string, { guard: string; label: string; methods: Record<string, unknown> }>;
  };
  const pub = manifest.facets.public;
  t.is(pub?.guard, 'none');
  t.is(pub?.label, 'Items Public Facet');
  t.deepEqual(Object.keys(pub?.methods ?? {}), ['makeTradeInvitation']);
});

test('the Offer Up manifest has a fully populated invitations section', t => {
  // The point D2 makes: an unguarded facet still yields a complete offer
  // surface, because proposalShape is declared even when the facet is not.
  const manifest = readJson(`${fixtureDir}/valid/offer-up.json`) as {
    invitations: Record<
      string,
      { description: string; proposal: { give: object; want: object; exit: object } }
    >;
  };
  const invitation = manifest.invitations.makeTradeInvitation;
  t.is(invitation?.description, 'buy items');
  t.deepEqual(Object.keys(invitation?.proposal.give ?? {}), ['Price']);
  t.deepEqual(Object.keys(invitation?.proposal.want ?? {}), ['Items']);
  t.truthy(invitation?.proposal.exit);
});

test('the Offer Up manifest carries the bundle id the SES smoke job computed', t => {
  const manifest = readJson(`${fixtureDir}/valid/offer-up.json`) as {
    contract: { bundleId: string | null };
  };
  t.regex(manifest.contract.bundleId ?? '', /^b1-[0-9a-f]{128}$/);
});

// --- broken manifests fail, for the stated reason -------------------------

const EXPECTED_FAILURES: Readonly<Record<string, string>> = {
  'bad-bundle-id.json': 'MANIFEST_BAD_BUNDLE_ID',
  'bad-zoe-keyword.json': 'MANIFEST_BAD_KEYWORD',
  'guardless-facet-with-patterns.json': 'MANIFEST_GUARDLESS_FACET_HAS_PATTERNS',
  'interface-facet-missing-returns.json': 'MANIFEST_MISSING_RETURNS',
  'invitation-maker-not-a-method.json': 'MANIFEST_UNKNOWN_MAKER',
  'pattern-missing-member.json': 'MANIFEST_MISSING_PATTERN_MEMBER',
  'published-path-without-prefix.json': 'MANIFEST_BAD_VSTORAGE_PATH',
  'unknown-pattern-kind.json': 'MANIFEST_UNKNOWN_PATTERN_KIND',
  'unknown-trace-kind.json': 'MANIFEST_UNKNOWN_TRACE_KIND',
};

test('every invalid manifest is accounted for in the expected-failure table', t => {
  t.deepEqual(
    jsonFiles(`${fixtureDir}/invalid`),
    Object.keys(EXPECTED_FAILURES).sort(),
  );
});

for (const [name, code] of Object.entries(EXPECTED_FAILURES)) {
  test(`${name} fails with ${code}`, t => {
    const result = validateContractManifest(readJson(`${fixtureDir}/invalid/${name}`));
    t.false(result.valid, `${name} should not validate`);
    if (result.valid) return;
    const codes = result.issues.map(issue => issue.code);
    t.true(
      codes.includes(code),
      `expected ${code}, got ${codes.join(', ') || '(no issues)'}`,
    );
  });
}

// --- the vocabulary is closed --------------------------------------------

test('the pattern vocabulary is exactly what the subjects and zoe use', t => {
  // Locked deliberately. Adding a kind should be a visible decision with a
  // source, not a reflex, so this test fails when the list changes.
  t.deepEqual(
    [...PATTERN_KINDS].sort(),
    [
      'and',
      'any',
      'arrayOf',
      'await',
      'bag',
      'bigint',
      'boolean',
      'eref',
      'error',
      'exactRecord',
      'gte',
      'literal',
      'not',
      'opt',
      'or',
      'pattern',
      'promise',
      'record',
      'recordOf',
      'ref',
      'remotable',
      'scalar',
      'splitRecord',
      'string',
    ],
  );
});

test('a pattern kind outside the vocabulary is rejected, not guessed at', t => {
  const result = validateContractManifest({
    schema: CONTRACT_MANIFEST_SCHEMA_ID,
    contract: { name: 'x', version: '0.0.0', bundleId: null },
    facets: { public: { guard: 'none', methods: { m: {} } } },
    invitations: {},
    published: [],
    terms: { t: { kind: 'lte', of: { kind: 'any' } } },
    privateArgs: {},
  });
  t.false(result.valid);
  if (result.valid) return;
  const issue = result.issues.find(i => i.code === 'MANIFEST_UNKNOWN_PATTERN_KIND');
  t.truthy(issue);
  t.true(issue?.message.includes('gte'), 'the message should list the vocabulary');
});

test('M.await is rejected outside a parameter list', t => {
  const result = validateContractManifest({
    schema: CONTRACT_MANIFEST_SCHEMA_ID,
    contract: { name: 'x', version: '0.0.0', bundleId: null },
    facets: {
      public: {
        guard: 'interface',
        methods: {
          m: { callKind: 'call', params: [], returns: { kind: 'await', of: { kind: 'any' } } },
        },
      },
    },
    invitations: {},
    published: [],
    terms: {},
    privateArgs: {},
  });
  t.false(result.valid);
  if (result.valid) return;
  t.true(result.issues.some(i => i.code === 'MANIFEST_PATTERN_OUT_OF_PLACE'));
});

test('M.await is accepted inside a parameter list', t => {
  const result = validateContractManifest({
    schema: CONTRACT_MANIFEST_SCHEMA_ID,
    contract: { name: 'x', version: '0.0.0', bundleId: null },
    facets: {
      public: {
        guard: 'interface',
        methods: {
          m: {
            callKind: 'callWhen',
            params: [{ kind: 'await', of: { kind: 'any' } }],
            returns: { kind: 'any' },
          },
        },
      },
    },
    invitations: {},
    published: [],
    terms: {},
    privateArgs: {},
  });
  t.true(result.valid);
});

// --- general validator behaviour -----------------------------------------

test('a non-object is rejected without throwing', t => {
  for (const input of [null, 42, 'x', [], undefined]) {
    const result = validateContractManifest(input);
    t.false(result.valid);
    if (!result.valid) t.is(result.issues[0]?.code, 'MANIFEST_NOT_AN_OBJECT');
  }
});

test('results are hardened', t => {
  t.true(Object.isFrozen(validateContractManifest({})));
  t.true(
    Object.isFrozen(validateContractManifest(readJson(`${fixtureDir}/valid/offer-up.json`))),
  );
});

test('bundleId must be present, and null is different from missing', t => {
  const withNull = {
    schema: CONTRACT_MANIFEST_SCHEMA_ID,
    contract: { name: 'x', version: '0.0.0', bundleId: null },
    facets: { public: { guard: 'none', methods: { m: {} } } },
    invitations: {},
    published: [],
    terms: {},
    privateArgs: {},
  };
  t.true(validateContractManifest(withNull).valid);

  const { contract, ...rest } = withNull;
  const { bundleId: _dropped, ...contractWithout } = contract;
  const result = validateContractManifest({ ...rest, contract: contractWithout });
  t.false(result.valid);
  if (result.valid) return;
  t.true(result.issues.some(i => i.code === 'MANIFEST_MISSING_FIELD'));
});

test('a facet with no methods is rejected', t => {
  const result = validateContractManifest({
    schema: CONTRACT_MANIFEST_SCHEMA_ID,
    contract: { name: 'x', version: '0.0.0', bundleId: null },
    facets: { creator: { guard: 'none', methods: {} } },
    invitations: {},
    published: [],
    terms: {},
    privateArgs: {},
  });
  t.false(result.valid);
  if (result.valid) return;
  t.true(result.issues.some(i => i.code === 'MANIFEST_EMPTY_FACET'));
});

test('validation collects every issue rather than stopping at the first', t => {
  const result = validateContractManifest({
    schema: 'contract-manifest.v1',
    contract: { name: '', version: 1, bundleId: 'nope' },
    facets: {},
    invitations: {},
    published: 'no',
    terms: {},
    privateArgs: {},
    somethingElse: true,
  });
  t.false(result.valid);
  if (result.valid) return;
  t.true(result.issues.length >= 5);
});

// --- the schema file and the validator must agree -------------------------

test('the JSON Schema pattern enum matches the code vocabulary', t => {
  const schema = readJson(
    `${packageRoot}schemas/contract-manifest.v0.schema.json`,
  ) as { $defs: { pattern: { properties: { kind: { enum: string[] } } } } };
  t.deepEqual(schema.$defs.pattern.properties.kind.enum, [...PATTERN_KINDS].sort());
});

test('the JSON Schema declares the same version as the code', t => {
  const schema = readJson(
    `${packageRoot}schemas/contract-manifest.v0.schema.json`,
  ) as { $id: string; properties: { schema: { const: string } } };
  t.is(schema.properties.schema.const, CONTRACT_MANIFEST_SCHEMA_ID);
  t.true(schema.$id.endsWith('contract-manifest.v0.schema.json'));
});

// --- the registry ---------------------------------------------------------

test('aat schemas list will show both Stage 0 formats', t => {
  t.deepEqual(
    formats.map(format => `${format.name} ${format.version}`),
    ['trace-event v0', 'contract-manifest v0'],
  );
});
