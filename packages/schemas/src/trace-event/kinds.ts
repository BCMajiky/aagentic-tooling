// SPDX-License-Identifier: Apache-2.0

/**
 * The enumerated event kinds, exactly as fixed by the plan table (§1.4) and
 * confirmed by STAGE0-BRIEF.md ("Event kinds in the plan table stand").
 *
 * This list is the single source of truth: the JSON Schema's enum is checked
 * against it by a test, so the two cannot drift.
 */
export const EVENT_KINDS = harden([
  'timer.set',
  'timer.fired',
  'vow.pending',
  'vow.resolved',
  'vow.rejected',
  'ica.send',
  'ica.ack',
  'icq.query',
  'icq.result',
  'ibc.transfer',
  'ibc.ack',
  'ibc.timeout',
  'offer.received',
  'offer.exited',
  'flow.restarted',
  'custom',
] as const);

export type EventKind = (typeof EVENT_KINDS)[number];

export const isEventKind = (value: unknown): value is EventKind =>
  typeof value === 'string' && (EVENT_KINDS as readonly string[]).includes(value);

/**
 * Attributes each kind must carry beyond the ones every event carries.
 *
 * An entry of `[['a', 'b']]` means "at least one of a or b". Kept deliberately
 * small: only what is definitional for the kind. A span that cannot say which
 * channel an IBC packet went down is not describing an IBC transfer, but a
 * transfer that does not yet know its sequence number is perfectly ordinary,
 * which is why `agoric.packet.sequence` is required on the acknowledgement and
 * the timeout but not on the send.
 */
export const REQUIRED_ATTRIBUTES_BY_KIND: Readonly<
  Record<EventKind, readonly (readonly string[])[]>
> = harden({
  'timer.set': [['agoric.timer.abs.value', 'agoric.timer.rel.value']],
  'timer.fired': [['agoric.timer.abs.value']],
  'vow.pending': [],
  'vow.resolved': [],
  'vow.rejected': [],
  'ica.send': [['agoric.chain.address']],
  'ica.ack': [['agoric.chain.address']],
  'icq.query': [['agoric.connection.id']],
  'icq.result': [['agoric.connection.id']],
  'ibc.transfer': [['agoric.channel.id'], ['agoric.denom']],
  'ibc.ack': [['agoric.channel.id'], ['agoric.packet.sequence']],
  'ibc.timeout': [['agoric.channel.id'], ['agoric.packet.sequence']],
  'offer.received': [['agoric.offer.id']],
  'offer.exited': [['agoric.offer.id']],
  'flow.restarted': [['agoric.flow.id'], ['agoric.flow.state']],
  custom: [],
});

/**
 * Kinds that describe a settled outcome, and the status they must carry.
 *
 * `vow.rejected` with `status.code: "ok"` is not a lint-level nitpick; it is a
 * trace that will mislead whoever reads it at three in the morning.
 */
export const REQUIRED_STATUS_BY_KIND: Readonly<
  Partial<Record<EventKind, 'ok' | 'error'>>
> = harden({
  'vow.resolved': 'ok',
  'vow.rejected': 'error',
  'ibc.timeout': 'error',
});
