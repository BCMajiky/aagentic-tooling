// SPDX-License-Identifier: Apache-2.0

export {
  EVENT_KINDS,
  REQUIRED_ATTRIBUTES_BY_KIND,
  REQUIRED_STATUS_BY_KIND,
  isEventKind,
} from './kinds.js';
export type { EventKind } from './kinds.js';

export {
  ATTRIBUTES,
  ATTRIBUTE_NAMES,
  REQUIRED_ATTRIBUTES,
  isAgoricAttribute,
} from './attributes.js';
export type { AttributeSpec, AttributeType } from './attributes.js';

export { TRACE_EVENT_SCHEMA_ID, TRACE_EVENT_VERSION } from './types.js';
export type {
  AttributeValue,
  SpanStatus,
  SpanStatusCode,
  TraceEvent,
  ValidationIssue,
  ValidationResult,
} from './types.js';

export { isTraceEvent, validateTraceEvent } from './validate.js';
