// SPDX-License-Identifier: Apache-2.0

/**
 * The curated `agoric.*` attribute namespace.
 *
 * STAGE0-BRIEF.md, "Format A notes for day 3": take span attribute names from
 * the exos in `agoric-sdk-u23/packages/orchestration/src/exos/` so that when
 * VowScope instruments them the names already line up. Every entry below
 * records the upstream field it was taken from, at commit cc25a29
 * (tag agoric-upgrade-23a).
 *
 * Three conventions, and the reasons for them:
 *
 * - **Dotted lowercase**, as OpenTelemetry attributes are, even where upstream
 *   is camelCase. `transferChannel.channelId` becomes `agoric.channel.id`.
 * - **Numbers that are `Nat` or `bigint` upstream are decimal strings here.**
 *   JSON has one number type and it is a double; a sequence number or a
 *   timeout timestamp in nanoseconds does not survive it.
 * - **Unknown `agoric.*` attributes are rejected** by the validator. The point
 *   of the namespace is that a name means the same thing everywhere; an
 *   emitter that writes `agoric.chainId` should hear about it rather than
 *   quietly producing traces nothing can join. Anything outside the `agoric.`
 *   prefix is free-form and passes through untouched.
 */
export type AttributeType = 'string' | 'integer' | 'decimal-string' | 'boolean';

export type AttributeSpec = {
  readonly type: AttributeType;
  /** Where the name comes from upstream. */
  readonly source: string;
  readonly summary: string;
};

/** Required on every event, whatever its kind. */
export const REQUIRED_ATTRIBUTES = harden([
  'agoric.event.kind',
  'agoric.chain.id',
  'agoric.block.height',
] as const);

export const ATTRIBUTES: Readonly<Record<string, AttributeSpec>> = harden({
  // --- required on every event ---
  'agoric.event.kind': {
    type: 'string',
    source: 'plan §1.4 event kind table',
    summary: 'Which of the enumerated event kinds this span is.',
  },
  'agoric.chain.id': {
    type: 'string',
    source: 'CosmosChainAddress.chainId (typeGuards.js); ChainInfo.chainId',
    summary: 'The chain this span acts on. Not necessarily Agoric.',
  },
  'agoric.block.height': {
    type: 'integer',
    source: 'plan §1.4',
    summary:
      'Block in which the event was observed or emitted. The authoritative ordering key; wall-clock time is advisory.',
  },

  // --- contract and flow identity ---
  'agoric.contract.instance': {
    type: 'string',
    source: 'plan §1.4',
    summary: 'Board id or instance handle of the emitting contract.',
  },
  'agoric.flow.id': {
    type: 'string',
    source: 'async-flow.js, the flow exo identity',
    summary:
      'Async-flow instance identity, so restarts and upgrades stitch together.',
  },
  'agoric.flow.name': {
    type: 'string',
    source: 'the exported flow function, e.g. sendIt in send-anywhere.flows.js',
    summary: 'Name of the orchestration flow function.',
  },
  'agoric.flow.state': {
    type: 'string',
    source: "async-flow.js getFlowState(): 'Running' | 'Sleeping' | 'Replaying' | 'Failed' | 'Done'",
    summary: 'The flow state, spelled exactly as getFlowState returns it.',
  },
  'agoric.retry.attempt': {
    type: 'integer',
    source: 'plan §1.4',
    summary: 'Zero-based attempt number for a retried operation.',
  },
  'agoric.vat.incarnation': {
    type: 'integer',
    source: "the vat's incarnation number, which increments on each vat upgrade",
    summary:
      'Which incarnation of the vat the span ran in. Distinguishes a trace that spans an upgrade from one that spans a restart within a single incarnation.',
  },

  // --- exo identity. Facet KEYS, not M.interface labels: upstream has several
  // mismatches (pickDataWatcher is labelled 'pickArrayDataWatcher', and the
  // local account's transferWithMetaWatcher is labelled 'transferWatcher',
  // colliding with its sibling). Keys are unique; labels are not.
  'agoric.exo.label': {
    type: 'string',
    source: "zone.exoClassKit first argument, e.g. 'Local Orchestration Account Kit'",
    summary: 'The exo class kit label.',
  },
  'agoric.exo.facet': {
    type: 'string',
    source: 'facet key in the exoClassKit behavior record, e.g. holder, transferWatcher',
    summary: 'Which facet ran. The key, never the M.interface label.',
  },
  'agoric.exo.method': {
    type: 'string',
    source: "method name, e.g. transfer, sendThenWaitForAck, executeEncodedTx",
    summary: 'The method invoked on the facet.',
  },
  'agoric.operation': {
    type: 'string',
    source: "opName in ibc-packet.js, used in its timeout error message",
    summary: 'Caller-supplied name for the operation a packet belongs to.',
  },

  // --- chain and account addressing ---
  'agoric.chain.name': {
    type: 'string',
    source: "ChainHub key passed to orch.getChain(), e.g. 'agoric', 'noble'",
    summary: 'The ChainHub name of the chain, which is not its chain id.',
  },
  'agoric.chain.address': {
    type: 'string',
    source: 'CosmosChainAddress.value (typeGuards.js)',
    summary: 'The account address, e.g. the bech32 string.',
  },
  'agoric.chain.address.encoding': {
    type: 'string',
    source: "CosmosChainAddress.encoding, e.g. 'bech32'",
    summary: 'How agoric.chain.address is encoded.',
  },
  'agoric.account.id': {
    type: 'string',
    source: 'namespace, reference and address joined by colons, in send-anywhere.flows.js',
    summary: 'CAIP-style fully qualified account id.',
  },

  // --- IBC. Upstream spells these three ways depending on layer:
  // portId/channelId (ChainHub transferChannel), portID/channelID (the ICA
  // traffic entry), and source_port/source_channel (the raw packet). This
  // format normalises to one spelling; the spec records the other two.
  'agoric.connection.id': {
    type: 'string',
    source: 'IBCConnectionInfo.id; controllerConnectionId (exo-interfaces.ts)',
    summary: 'IBC connection id, self side.',
  },
  'agoric.channel.id': {
    type: 'string',
    source: 'transferChannel.channelId; MsgTransfer sourceChannel',
    summary: 'IBC channel id, self side.',
  },
  'agoric.port.id': {
    type: 'string',
    source: 'transferChannel.portId; MsgTransfer sourcePort',
    summary: 'IBC port id, self side.',
  },
  'agoric.counterparty.channel.id': {
    type: 'string',
    source: 'IBCChannelInfo.counterPartyChannelId',
    summary: 'IBC channel id, counterparty side.',
  },
  'agoric.counterparty.port.id': {
    type: 'string',
    source: 'IBCChannelInfo.counterPartyPortId',
    summary: 'IBC port id, counterparty side.',
  },
  'agoric.ibc.local.address': {
    type: 'string',
    source: 'localAddress (LocalIbcAddress) in ica-account-kit.js',
    summary: 'Local IBC address of the connection.',
  },
  'agoric.ibc.remote.address': {
    type: 'string',
    source: 'remoteAddress (RemoteIbcAddress) in ica-account-kit.js',
    summary: 'Remote IBC address of the connection.',
  },

  // --- packets ---
  'agoric.packet.sequence': {
    type: 'decimal-string',
    source: 'sequence, a bigint, in cosmos-orchestration-account.js fillSequenceWatcher',
    summary: 'IBC packet sequence number.',
  },
  'agoric.packet.timeout.height': {
    type: 'decimal-string',
    source: 'timeoutHeight in MsgTransfer',
    summary: 'Packet timeout expressed as a block height.',
  },
  'agoric.packet.timeout.timestamp': {
    type: 'decimal-string',
    source: 'timeoutTimestamp in MsgTransfer, nanoseconds',
    summary: 'Packet timeout expressed as a timestamp in nanoseconds.',
  },
  'agoric.packet.ack': {
    type: 'string',
    source: "packet 'acknowledgement' field in ibc-packet.js",
    summary:
      'The raw acknowledgement string. For ICS20 success this is ICS20_TRANSFER_SUCCESS_RESULT.',
  },

  // --- assets ---
  'agoric.denom': {
    type: 'string',
    source: 'DenomAmount.denom (typeGuards.js DenomAmountShape)',
    summary: 'The denom moved or queried, e.g. ibc/toyusdc.',
  },
  'agoric.denom.base': {
    type: 'string',
    source: 'DenomInfo.baseDenom',
    summary: 'The base denom behind an IBC-traced denom.',
  },
  'agoric.amount.value': {
    type: 'decimal-string',
    source: 'DenomAmount.value, a Nat',
    summary: 'The amount, as a decimal string because it is a bigint.',
  },

  // --- timers ---
  'agoric.timer.abs.value': {
    type: 'decimal-string',
    source: 'TimestampRecord.absValue (@agoric/time typeGuards.js)',
    summary: 'Absolute time a timer is set for or fired at.',
  },
  'agoric.timer.rel.value': {
    type: 'decimal-string',
    source: 'RelativeTimeRecord.relValue (@agoric/time typeGuards.js)',
    summary: 'Relative delay a timer was set with.',
  },

  // --- Zoe ---
  'agoric.offer.id': {
    type: 'string',
    source: 'offer id in the smart wallet offer record',
    summary: 'The offer this span belongs to.',
  },
});

/** Every attribute name this version of the format knows. */
export const ATTRIBUTE_NAMES: readonly string[] = harden(
  Object.keys(ATTRIBUTES).sort(),
);

/** True for a name inside the curated namespace. */
export const isAgoricAttribute = (name: string): boolean =>
  name.startsWith('agoric.');
