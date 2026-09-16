// SPDX-License-Identifier: Apache-2.0

import type { EventKind } from './kinds.js';

/** The constant that identifies this format and version. */
export const TRACE_EVENT_SCHEMA_ID = 'trace-event.v0';
export const TRACE_EVENT_VERSION = 'v0';

/** OpenTelemetry's three status codes, lowercased. */
export type SpanStatusCode = 'unset' | 'ok' | 'error';

export type SpanStatus = {
  readonly code: SpanStatusCode;
  /** Present only when code is 'error'; OTel says so and so do we. */
  readonly message?: string;
};

/**
 * An attribute value. Deliberately narrow: strings, finite numbers and
 * booleans. Nested objects are not allowed, because a trace that needs them is
 * a trace that will not join against anything.
 */
export type AttributeValue = string | number | boolean;

/**
 * One workflow trace event: an OpenTelemetry span with an Agoric attribute set.
 *
 * Field names follow OTLP/JSON (`traceId`, `spanId`, `parentSpanId`) so that an
 * existing viewer can render these after a shallow transform. Times are RFC
 * 3339 strings rather than OTel's `startTimeUnixNano`, for two reasons: these
 * are hand-authored and hand-read at this stage, and on a chain the
 * authoritative ordering is `agoric.block.height`, not a wall clock.
 */
export type TraceEvent = {
  /** Always `trace-event.v0`. Present so a line in a log is self-describing. */
  readonly schema: typeof TRACE_EVENT_SCHEMA_ID;
  /** 32 lowercase hex characters, as OpenTelemetry requires. */
  readonly traceId: string;
  /** 16 lowercase hex characters. */
  readonly spanId: string;
  /** 16 lowercase hex characters, or null for the root span of a trace. */
  readonly parentSpanId: string | null;
  /** Human-readable span name, e.g. `sendIt` or `ica.send delegate`. */
  readonly name: string;
  /** RFC 3339 UTC, e.g. `2026-09-16T10:04:11.000Z`. */
  readonly startTime: string;
  /** RFC 3339 UTC, or null while the span is still open. */
  readonly endTime: string | null;
  readonly status: SpanStatus;
  readonly attributes: Readonly<Record<string, AttributeValue>> & {
    readonly 'agoric.event.kind': EventKind;
  };
};

/** One thing wrong with a candidate event. */
export type ValidationIssue = {
  /** JSON Pointer to the offending member, e.g. `/attributes/agoric.denom`. */
  readonly path: string;
  /** Stable machine code, e.g. `TRACE_UNKNOWN_ATTRIBUTE`. */
  readonly code: string;
  readonly message: string;
};

export type ValidationResult =
  | { readonly valid: true; readonly event: TraceEvent }
  | { readonly valid: false; readonly issues: readonly ValidationIssue[] };
