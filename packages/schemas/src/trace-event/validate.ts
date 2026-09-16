// SPDX-License-Identifier: Apache-2.0

import {
  ATTRIBUTES,
  ATTRIBUTE_NAMES,
  REQUIRED_ATTRIBUTES,
  isAgoricAttribute,
} from './attributes.js';
import {
  EVENT_KINDS,
  REQUIRED_ATTRIBUTES_BY_KIND,
  REQUIRED_STATUS_BY_KIND,
  isEventKind,
} from './kinds.js';
import { TRACE_EVENT_SCHEMA_ID } from './types.js';
import type {
  AttributeValue,
  SpanStatusCode,
  TraceEvent,
  ValidationIssue,
  ValidationResult,
} from './types.js';

/**
 * Why this is hand-written rather than an off-the-shelf JSON Schema validator.
 *
 * `packages/schemas` is imported by every later tool, so a runtime dependency
 * here is a dependency everywhere. Against that, the schema is small and fixed.
 * The deciding reason is the error messages: this validator reports a JSON
 * Pointer, a stable code and a sentence naming the value it objected to, which
 * is what the `--json` envelope and the skill pack need. A generic validator
 * reports "must match schema #/properties/attributes".
 *
 * The published `schemas/trace-event.v0.schema.json` remains the normative
 * artifact for anyone outside this repository, and a test asserts that the two
 * agree on the parts that can drift: the event kinds, the attribute names and
 * the required fields.
 */

const HEX_32 = /^[0-9a-f]{32}$/;
const HEX_16 = /^[0-9a-f]{16}$/;
const RFC_3339_UTC =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const DECIMAL_STRING = /^(?:0|[1-9]\d*)$/;

const STATUS_CODES: readonly SpanStatusCode[] = harden(['unset', 'ok', 'error']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Collector = {
  add: (path: string, code: string, message: string) => void;
  issues: ValidationIssue[];
};

const makeCollector = (): Collector => {
  const issues: ValidationIssue[] = [];
  return {
    issues,
    add: (path, code, message) => {
      issues.push({ path, code, message });
    },
  };
};

const show = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) return json;
  } catch {
    // A value that will not serialise still deserves a name in the message.
  }
  return Object.prototype.toString.call(value);
};

const checkIds = (candidate: Record<string, unknown>, c: Collector): void => {
  const { traceId, spanId, parentSpanId } = candidate;

  if (typeof traceId !== 'string' || !HEX_32.test(traceId)) {
    c.add(
      '/traceId',
      'TRACE_BAD_TRACE_ID',
      `traceId must be 32 lowercase hex characters, got ${show(traceId)}`,
    );
  }
  if (typeof spanId !== 'string' || !HEX_16.test(spanId)) {
    c.add(
      '/spanId',
      'TRACE_BAD_SPAN_ID',
      `spanId must be 16 lowercase hex characters, got ${show(spanId)}`,
    );
  }
  if (parentSpanId !== null) {
    if (typeof parentSpanId !== 'string' || !HEX_16.test(parentSpanId)) {
      c.add(
        '/parentSpanId',
        'TRACE_BAD_PARENT_SPAN_ID',
        `parentSpanId must be 16 lowercase hex characters or null, got ${show(parentSpanId)}`,
      );
    } else if (parentSpanId === spanId) {
      c.add(
        '/parentSpanId',
        'TRACE_SELF_PARENT',
        'parentSpanId must not equal spanId; a span cannot be its own parent',
      );
    }
  }
};

const checkTimes = (candidate: Record<string, unknown>, c: Collector): void => {
  const { startTime, endTime } = candidate;

  if (typeof startTime !== 'string' || !RFC_3339_UTC.test(startTime)) {
    c.add(
      '/startTime',
      'TRACE_BAD_START_TIME',
      `startTime must be an RFC 3339 UTC timestamp ending in Z, got ${show(startTime)}`,
    );
  }
  if (endTime !== null) {
    if (typeof endTime !== 'string' || !RFC_3339_UTC.test(endTime)) {
      c.add(
        '/endTime',
        'TRACE_BAD_END_TIME',
        `endTime must be an RFC 3339 UTC timestamp ending in Z, or null, got ${show(endTime)}`,
      );
    } else if (
      typeof startTime === 'string' &&
      RFC_3339_UTC.test(startTime) &&
      Date.parse(endTime) < Date.parse(startTime)
    ) {
      c.add(
        '/endTime',
        'TRACE_END_BEFORE_START',
        `endTime ${endTime} is before startTime ${startTime}`,
      );
    }
  }
};

const checkStatus = (
  candidate: Record<string, unknown>,
  c: Collector,
): SpanStatusCode | undefined => {
  const { status, endTime } = candidate;
  if (!isRecord(status)) {
    c.add(
      '/status',
      'TRACE_BAD_STATUS',
      `status must be an object with a code, got ${show(status)}`,
    );
    return undefined;
  }

  const code = status.code;
  if (typeof code !== 'string' || !STATUS_CODES.includes(code as SpanStatusCode)) {
    c.add(
      '/status/code',
      'TRACE_BAD_STATUS_CODE',
      `status.code must be one of ${STATUS_CODES.join(', ')}, got ${show(code)}`,
    );
    return undefined;
  }

  for (const key of Object.keys(status)) {
    if (key !== 'code' && key !== 'message') {
      c.add(
        `/status/${key}`,
        'TRACE_UNKNOWN_STATUS_FIELD',
        `status has no field '${key}'; it has code and message`,
      );
    }
  }

  if ('message' in status && typeof status.message !== 'string') {
    c.add(
      '/status/message',
      'TRACE_BAD_STATUS_MESSAGE',
      `status.message must be a string, got ${show(status.message)}`,
    );
  }
  if (code === 'error' && typeof status.message !== 'string') {
    c.add(
      '/status/message',
      'TRACE_MISSING_ERROR_MESSAGE',
      'status.code is error, so status.message must say what went wrong',
    );
  }
  if (code !== 'error' && 'message' in status) {
    c.add(
      '/status/message',
      'TRACE_UNEXPECTED_STATUS_MESSAGE',
      `status.message is only for code 'error', but code is '${code}'`,
    );
  }
  if (code !== 'unset' && endTime === null) {
    c.add(
      '/endTime',
      'TRACE_SETTLED_WITHOUT_END',
      `status.code is '${code}', so the span has settled and endTime must be set`,
    );
  }
  if (code === 'unset' && endTime !== null) {
    c.add(
      '/status/code',
      'TRACE_ENDED_WITHOUT_STATUS',
      'endTime is set, so status.code must be ok or error rather than unset',
    );
  }

  return code as SpanStatusCode;
};

const checkAttributeValue = (
  name: string,
  value: AttributeValue,
  c: Collector,
): void => {
  const spec = ATTRIBUTES[name];
  if (!spec) return;
  const path = `/attributes/${name}`;

  switch (spec.type) {
    case 'string':
      if (typeof value !== 'string' || value === '') {
        c.add(
          path,
          'TRACE_BAD_ATTRIBUTE_TYPE',
          `${name} must be a non-empty string, got ${show(value)}`,
        );
      }
      break;
    case 'integer':
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
      ) {
        c.add(
          path,
          'TRACE_BAD_ATTRIBUTE_TYPE',
          `${name} must be a non-negative safe integer, got ${show(value)}`,
        );
      }
      break;
    case 'decimal-string':
      if (typeof value !== 'string' || !DECIMAL_STRING.test(value)) {
        c.add(
          path,
          'TRACE_BAD_ATTRIBUTE_TYPE',
          `${name} must be a decimal string with no leading zeros (it is a bigint upstream and JSON numbers would lose it), got ${show(value)}`,
        );
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        c.add(
          path,
          'TRACE_BAD_ATTRIBUTE_TYPE',
          `${name} must be a boolean, got ${show(value)}`,
        );
      }
      break;
    default:
      break;
  }
};

const checkAttributes = (
  candidate: Record<string, unknown>,
  c: Collector,
  statusCode: SpanStatusCode | undefined,
): void => {
  const { attributes } = candidate;
  if (!isRecord(attributes)) {
    c.add(
      '/attributes',
      'TRACE_BAD_ATTRIBUTES',
      `attributes must be an object, got ${show(attributes)}`,
    );
    return;
  }

  for (const [name, value] of Object.entries(attributes)) {
    const path = `/attributes/${name}`;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      c.add(
        path,
        'TRACE_BAD_ATTRIBUTE_VALUE',
        `${name} must be a string, number or boolean; nested values do not join across traces, got ${show(value)}`,
      );
      continue;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      c.add(
        path,
        'TRACE_BAD_ATTRIBUTE_VALUE',
        `${name} must be a finite number, got ${show(value)}`,
      );
      continue;
    }
    if (isAgoricAttribute(name) && !ATTRIBUTES[name]) {
      c.add(
        path,
        'TRACE_UNKNOWN_ATTRIBUTE',
        `'${name}' is not in the agoric.* attribute registry for ${TRACE_EVENT_SCHEMA_ID}; known names are ${ATTRIBUTE_NAMES.join(', ')}`,
      );
      continue;
    }
    checkAttributeValue(name, value, c);
  }

  for (const name of REQUIRED_ATTRIBUTES) {
    if (!(name in attributes)) {
      c.add(
        `/attributes/${name}`,
        'TRACE_MISSING_ATTRIBUTE',
        `every event must carry ${name} (${ATTRIBUTES[name]?.summary ?? ''})`,
      );
    }
  }

  const kind = attributes['agoric.event.kind'];
  if (kind !== undefined && !isEventKind(kind)) {
    c.add(
      '/attributes/agoric.event.kind',
      'TRACE_UNKNOWN_EVENT_KIND',
      `${show(kind)} is not an event kind; the kinds are ${EVENT_KINDS.join(', ')}`,
    );
    return;
  }
  if (!isEventKind(kind)) return;

  for (const group of REQUIRED_ATTRIBUTES_BY_KIND[kind]) {
    if (!group.some(name => name in attributes)) {
      c.add(
        '/attributes',
        'TRACE_MISSING_ATTRIBUTE',
        group.length === 1
          ? `event kind '${kind}' requires ${group[0]}`
          : `event kind '${kind}' requires at least one of ${group.join(', ')}`,
      );
    }
  }

  const requiredStatus = REQUIRED_STATUS_BY_KIND[kind];
  if (requiredStatus && statusCode !== undefined && statusCode !== requiredStatus) {
    c.add(
      '/status/code',
      'TRACE_STATUS_CONTRADICTS_KIND',
      `event kind '${kind}' must have status.code '${requiredStatus}', got '${statusCode}'`,
    );
  }
};

const KNOWN_FIELDS = harden([
  'schema',
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'startTime',
  'endTime',
  'status',
  'attributes',
]);

/**
 * Validate a candidate trace event.
 *
 * Collects every issue rather than stopping at the first, because the caller is
 * usually a person or a model fixing a fixture and one problem at a time is
 * needlessly slow.
 *
 * The result is hardened, per the repo rule that a validator returns hardened
 * values. On success the returned `event` *is* the input object, so the input
 * is hardened too: a caller that means to keep editing should validate a copy.
 * That is deliberate — a validated event that someone can still mutate is a
 * validated event in name only.
 */
export const validateTraceEvent = (input: unknown): ValidationResult => {
  const c = makeCollector();

  if (!isRecord(input)) {
    return harden({
      valid: false,
      issues: [
        {
          path: '',
          code: 'TRACE_NOT_AN_OBJECT',
          message: `a trace event must be a JSON object, got ${show(input)}`,
        },
      ],
    });
  }

  if (input.schema !== TRACE_EVENT_SCHEMA_ID) {
    c.add(
      '/schema',
      'TRACE_BAD_SCHEMA_ID',
      `schema must be '${TRACE_EVENT_SCHEMA_ID}', got ${show(input.schema)}`,
    );
  }

  for (const field of KNOWN_FIELDS) {
    if (!(field in input)) {
      c.add(
        `/${field}`,
        'TRACE_MISSING_FIELD',
        `a trace event must have a '${field}' field`,
      );
    }
  }
  for (const field of Object.keys(input)) {
    if (!KNOWN_FIELDS.includes(field)) {
      c.add(
        `/${field}`,
        'TRACE_UNKNOWN_FIELD',
        `'${field}' is not a field of ${TRACE_EVENT_SCHEMA_ID}; per-event detail belongs in attributes`,
      );
    }
  }

  if (typeof input.name !== 'string' || input.name === '') {
    c.add(
      '/name',
      'TRACE_BAD_NAME',
      `name must be a non-empty string, got ${show(input.name)}`,
    );
  }

  checkIds(input, c);
  checkTimes(input, c);
  const statusCode = checkStatus(input, c);
  checkAttributes(input, c, statusCode);

  if (c.issues.length > 0) {
    return harden({ valid: false, issues: [...c.issues] });
  }
  return harden({ valid: true, event: input as unknown as TraceEvent });
};

/** True when `input` is a valid trace event. */
export const isTraceEvent = (input: unknown): input is TraceEvent =>
  validateTraceEvent(input).valid;
