// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ATTRIBUTES, ATTRIBUTE_NAMES, REQUIRED_ATTRIBUTES } from '../src/trace-event/attributes.js';
import { EVENT_KINDS } from '../src/trace-event/kinds.js';
import { validateTraceEvent } from '../src/trace-event/validate.js';
import { TRACE_EVENT_SCHEMA_ID } from '../src/trace-event/types.js';
import { formats } from '../src/registry.js';

// dist/test/trace-event.test.js -> the package root is two levels up.
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDir = `${packageRoot}fixtures/trace-event/v0`;
const schemaPath = `${packageRoot}schemas/trace-event.v0.schema.json`;

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

/** Just enough of the JSON Schema's shape for the agreement tests below. */
type SchemaDoc = {
  $id: string;
  properties: {
    schema: { const: string };
    attributes: {
      required: string[];
      properties: Record<string, { enum?: string[] }>;
      propertyNames: {
        not: { allOf: [unknown, { not: { enum: string[] } }] };
      };
    };
  };
};

const readSchema = (): SchemaDoc => readJson(schemaPath) as SchemaDoc;

const jsonFiles = (dir: string): string[] =>
  readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort();

type FixtureDoc = { $comment?: string; events: unknown[] };

// --- the five fixtures validate ------------------------------------------

const VALID_FIXTURES = [
  'flow-restart.json',
  'ica-send-with-ack.json',
  'multi-hop-send-anywhere.json',
  'timer-wait.json',
  'vow-rejection.json',
];

test('the five fixtures the brief names are all present', t => {
  t.deepEqual(jsonFiles(`${fixtureDir}/valid`), VALID_FIXTURES);
});

for (const name of VALID_FIXTURES) {
  test(`every event in ${name} validates`, t => {
    const doc = readJson(`${fixtureDir}/valid/${name}`) as FixtureDoc;
    t.true(Array.isArray(doc.events), 'fixture must hold an events array');
    t.true(doc.events.length > 0, 'fixture must hold at least one event');
    for (const [index, event] of doc.events.entries()) {
      const result = validateTraceEvent(event);
      if (!result.valid) {
        t.fail(
          `${name}[${index}] failed:\n${result.issues
            .map(issue => `  ${issue.path} ${issue.code}: ${issue.message}`)
            .join('\n')}`,
        );
      } else {
        t.pass();
      }
    }
  });
}

test('the fixtures form connected traces: every parent exists in its own file', t => {
  for (const name of VALID_FIXTURES) {
    const doc = readJson(`${fixtureDir}/valid/${name}`) as FixtureDoc;
    const events = doc.events as Array<{
      traceId: string;
      spanId: string;
      parentSpanId: string | null;
    }>;
    const spanIds = new Set(events.map(event => event.spanId));
    const traceIds = new Set(events.map(event => event.traceId));
    t.is(traceIds.size, 1, `${name} should be one trace`);
    const roots = events.filter(event => event.parentSpanId === null);
    t.is(roots.length, 1, `${name} should have exactly one root span`);
    for (const event of events) {
      if (event.parentSpanId !== null) {
        t.true(
          spanIds.has(event.parentSpanId),
          `${name}: span ${event.spanId} has parent ${event.parentSpanId}, which is not in the file`,
        );
      }
    }
  }
});

test('the multi-hop fixture is a send-anywhere transfer with two hops', t => {
  // STAGE0-BRIEF.md asks specifically for this, so that the fixture can be
  // checked against the real contract once examples/send-anywhere lands.
  const doc = readJson(
    `${fixtureDir}/valid/multi-hop-send-anywhere.json`,
  ) as FixtureDoc;
  const events = doc.events as Array<{
    attributes: Record<string, unknown>;
  }>;
  const kinds = events.map(event => event.attributes['agoric.event.kind']);
  t.true(kinds.includes('offer.received'));
  t.true(kinds.includes('ibc.transfer'));
  t.true(kinds.includes('ica.send'));
  t.true(kinds.includes('offer.exited'));
  const flowNames = new Set(
    events
      .map(event => event.attributes['agoric.flow.name'])
      .filter(name => name !== undefined),
  );
  t.deepEqual([...flowNames], ['sendIt']);
  const flowIds = new Set(events.map(e => e.attributes['agoric.flow.id']));
  t.is(flowIds.size, 1, 'one flow id throughout, so the hops stitch together');
});

// --- a broken fixture fails, for the stated reason ------------------------

const EXPECTED_FAILURES: Readonly<Record<string, string>> = {
  'bad-trace-id.json': 'TRACE_BAD_TRACE_ID',
  'end-before-start.json': 'TRACE_END_BEFORE_START',
  'error-without-message.json': 'TRACE_MISSING_ERROR_MESSAGE',
  'extra-top-level-field.json': 'TRACE_UNKNOWN_FIELD',
  'missing-required-attribute.json': 'TRACE_MISSING_ATTRIBUTE',
  'nested-attribute.json': 'TRACE_BAD_ATTRIBUTE_VALUE',
  'rejected-but-ok.json': 'TRACE_STATUS_CONTRADICTS_KIND',
  'self-parent.json': 'TRACE_SELF_PARENT',
  'sequence-as-number.json': 'TRACE_BAD_ATTRIBUTE_TYPE',
  'settled-without-end.json': 'TRACE_SETTLED_WITHOUT_END',
  'unknown-attribute.json': 'TRACE_UNKNOWN_ATTRIBUTE',
  'unknown-event-kind.json': 'TRACE_UNKNOWN_EVENT_KIND',
};

test('every invalid fixture is accounted for in the expected-failure table', t => {
  t.deepEqual(
    jsonFiles(`${fixtureDir}/invalid`),
    Object.keys(EXPECTED_FAILURES).sort(),
  );
});

for (const [name, code] of Object.entries(EXPECTED_FAILURES)) {
  test(`${name} fails with ${code}`, t => {
    const event = readJson(`${fixtureDir}/invalid/${name}`);
    const result = validateTraceEvent(event);
    t.false(result.valid, `${name} should not validate`);
    if (result.valid) return;
    const codes = result.issues.map(issue => issue.code);
    t.true(
      codes.includes(code),
      `expected ${code}, got ${codes.join(', ') || '(no issues)'}`,
    );
  });
}

// --- the schema file and the validator must agree -------------------------

test('the JSON Schema enum matches the event kind list', t => {
  const schema = readSchema();
  const enumerated =
    schema.properties.attributes.properties['agoric.event.kind']?.enum;
  t.deepEqual(enumerated, [...EVENT_KINDS]);
});

test('the JSON Schema knows exactly the registered attribute names', t => {
  // The closed agoric.* namespace is expressed twice, once in TypeScript and
  // once in JSON Schema. This is the test that stops them drifting.
  const schema = readSchema();
  const listed = schema.properties.attributes.propertyNames.not.allOf[1].not.enum;
  t.deepEqual([...listed].sort(), [...ATTRIBUTE_NAMES]);
});

test('the JSON Schema requires the same attributes on every event', t => {
  const schema = readSchema();
  t.deepEqual(
    [...schema.properties.attributes.required].sort(),
    [...REQUIRED_ATTRIBUTES].sort(),
  );
});

test('the JSON Schema declares the same $id version as the code', t => {
  const schema = readSchema();
  t.is(schema.properties.schema.const, TRACE_EVENT_SCHEMA_ID);
  t.true(String(schema.$id).endsWith('trace-event.v0.schema.json'));
});

test('every registered attribute is documented with its upstream source', t => {
  for (const [name, spec] of Object.entries(ATTRIBUTES)) {
    t.true(spec.source.length > 5, `${name} has no upstream source recorded`);
    t.true(spec.summary.length > 10, `${name} has a stub summary`);
  }
});

// --- the registry ---------------------------------------------------------

test('aat schemas list will show trace-event v0', t => {
  const entry = formats.find(format => format.name === 'trace-event');
  t.truthy(entry);
  t.is(entry?.version, 'v0');
});

// --- validator behaviour --------------------------------------------------

const wellFormed = () => ({
  schema: 'trace-event.v0',
  traceId: 'abcdef0123456789abcdef0123456789',
  spanId: '0000000000000001',
  parentSpanId: null,
  name: 'sendIt',
  startTime: '2026-09-16T14:00:00.000Z',
  endTime: '2026-09-16T14:00:01.000Z',
  status: { code: 'ok' },
  attributes: {
    'agoric.event.kind': 'custom',
    'agoric.chain.id': 'agoriclocal',
    'agoric.block.height': 210000,
  },
});

test('a well-formed event validates and comes back hardened', t => {
  const result = validateTraceEvent(wellFormed());
  t.true(result.valid);
  t.true(Object.isFrozen(result));
});

test('a failed result is hardened too', t => {
  const result = validateTraceEvent({});
  t.false(result.valid);
  t.true(Object.isFrozen(result));
});

test('validation collects every issue rather than stopping at the first', t => {
  const result = validateTraceEvent({
    schema: 'trace-event.v1',
    traceId: 'nope',
    spanId: 'nope',
    parentSpanId: null,
    name: '',
    startTime: 'yesterday',
    endTime: null,
    status: { code: 'fine' },
    attributes: {},
  });
  t.false(result.valid);
  if (result.valid) return;
  t.true(result.issues.length >= 6, 'expected several issues at once');
});

test('a non-object is rejected without throwing', t => {
  for (const input of [null, 42, 'a string', [], undefined]) {
    const result = validateTraceEvent(input);
    t.false(result.valid);
    if (!result.valid) t.is(result.issues[0]?.code, 'TRACE_NOT_AN_OBJECT');
  }
});

test('issues carry a JSON Pointer to the offending member', t => {
  const event = wellFormed();
  (event.attributes as Record<string, unknown>)['agoric.nope'] = 'x';
  const result = validateTraceEvent(event);
  t.false(result.valid);
  if (result.valid) return;
  const issue = result.issues.find(i => i.code === 'TRACE_UNKNOWN_ATTRIBUTE');
  t.is(issue?.path, '/attributes/agoric.nope');
});

test('attributes outside the agoric. prefix are free-form', t => {
  const event = wellFormed();
  (event.attributes as Record<string, unknown>)['myapp.correlation'] = 'abc-123';
  (event.attributes as Record<string, unknown>)['myapp.retries'] = 3;
  t.true(validateTraceEvent(event).valid);
});

test('an open span is valid: endTime null with status unset', t => {
  const open = { ...wellFormed(), endTime: null, status: { code: 'unset' } };
  t.true(validateTraceEvent(open).valid);
});

test('a root span may have a null parent, and a child may not point at itself', t => {
  t.true(validateTraceEvent(wellFormed()).valid);
  const selfParented = { ...wellFormed(), parentSpanId: '0000000000000001' };
  t.false(validateTraceEvent(selfParented).valid);
});

test('validating hardens the event, so a validated event cannot be edited after', t => {
  // A consequence of the repo rule that validators return hardened values: the
  // returned event is the input object, so the input is hardened too. Callers
  // that want to keep mutating should validate a copy.
  const event = wellFormed();
  const result = validateTraceEvent(event);
  t.true(result.valid);
  t.true(Object.isFrozen(event));
  t.throws(() => {
    (event as unknown as { name: string }).name = 'something else';
  });
});

test('a decimal string attribute rejects leading zeros', t => {
  const event = wellFormed();
  event.attributes['agoric.event.kind'] = 'ibc.ack';
  (event.attributes as Record<string, unknown>)['agoric.channel.id'] = 'channel-8';
  (event.attributes as Record<string, unknown>)['agoric.packet.sequence'] = '007';
  const result = validateTraceEvent(event);
  t.false(result.valid);
  if (result.valid) return;
  t.true(result.issues.some(i => i.code === 'TRACE_BAD_ATTRIBUTE_TYPE'));
});

test('each kind that requires attributes says so when they are missing', t => {
  const cases: Array<[string, string[]]> = [
    ['timer.fired', ['agoric.timer.abs.value']],
    ['ica.send', ['agoric.chain.address']],
    ['icq.query', ['agoric.connection.id']],
    ['ibc.transfer', ['agoric.channel.id', 'agoric.denom']],
    ['offer.received', ['agoric.offer.id']],
  ];
  for (const [kind, required] of cases) {
    const event = wellFormed();
    event.attributes['agoric.event.kind'] = kind;
    const result = validateTraceEvent(event);
    t.false(result.valid, `${kind} should require ${required.join(', ')}`);
    if (result.valid) continue;
    t.true(
      result.issues.some(i => i.code === 'TRACE_MISSING_ATTRIBUTE'),
      `${kind} should report a missing attribute`,
    );
  }
});

test('timer.set accepts either the absolute or the relative time', t => {
  for (const key of ['agoric.timer.abs.value', 'agoric.timer.rel.value']) {
    const event = wellFormed();
    event.attributes['agoric.event.kind'] = 'timer.set';
    (event.attributes as Record<string, unknown>)[key] = '1789574651000000000';
    t.true(validateTraceEvent(event).valid, `${key} alone should suffice`);
  }
});

test('status.message is required for error and forbidden otherwise', t => {
  const okWithMessage = { ...wellFormed(), status: { code: 'ok', message: 'fine' } };
  t.false(validateTraceEvent(okWithMessage).valid);

  const errorNoMessage = { ...wellFormed(), status: { code: 'error' } };
  t.false(validateTraceEvent(errorNoMessage).valid);

  const errorWithMessage = {
    ...wellFormed(),
    status: { code: 'error', message: 'it broke' },
  };
  t.true(validateTraceEvent(errorWithMessage).valid);
});
