// SPDX-License-Identifier: Apache-2.0

import {
  OPTIONAL_MEMBERS,
  PARAM_ONLY_KINDS,
  PATTERN_KINDS,
  PATTERN_MEMBERS,
  isPatternKind,
} from './patterns.js';
import { CONTRACT_MANIFEST_SCHEMA_ID, FACET_GUARDS } from './types.js';
import type {
  ContractManifest,
  ManifestIssue,
  ManifestValidationResult,
} from './types.js';
import { EVENT_KINDS } from '../trace-event/kinds.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

type Collector = {
  add: (path: string, code: string, message: string) => void;
  issues: ManifestIssue[];
};

const makeCollector = (): Collector => {
  const issues: ManifestIssue[] = [];
  return {
    issues,
    add: (path, code, message) => {
      issues.push({ path, code, message });
    },
  };
};

const requireString = (
  value: unknown,
  path: string,
  c: Collector,
  what: string,
): boolean => {
  if (typeof value !== 'string' || value === '') {
    c.add(path, 'MANIFEST_BAD_VALUE', `${what} must be a non-empty string, got ${show(value)}`);
    return false;
  }
  return true;
};

/**
 * Validate one serialised pattern.
 *
 * The brief is explicit that anything outside the documented vocabulary is
 * rejected rather than guessed at, so an unknown `kind` is an error and so is
 * an unexpected member on a known kind. A manifest that renders an
 * unrecognised pattern as "any" would tell a generator that a method accepts
 * anything, which is worse than telling it nothing at all.
 */
export const validatePattern = (
  value: unknown,
  path: string,
  c: Collector,
  options: { inParams?: boolean } = {},
): void => {
  if (!isRecord(value)) {
    c.add(
      path,
      'MANIFEST_BAD_PATTERN',
      `a pattern must be an object with a 'kind', got ${show(value)}`,
    );
    return;
  }

  const { kind } = value;
  if (!isPatternKind(kind)) {
    c.add(
      path,
      'MANIFEST_UNKNOWN_PATTERN_KIND',
      `'${String(kind)}' is not a supported pattern kind for ${CONTRACT_MANIFEST_SCHEMA_ID}; the vocabulary is ${PATTERN_KINDS.join(', ')}`,
    );
    return;
  }

  if (PARAM_ONLY_KINDS.includes(kind) && !options.inParams) {
    c.add(
      path,
      'MANIFEST_PATTERN_OUT_OF_PLACE',
      `'${kind}' is only meaningful inside a method guard's parameters`,
    );
  }

  const expected = PATTERN_MEMBERS[kind];
  const optional = OPTIONAL_MEMBERS[kind] ?? [];
  for (const member of expected) {
    const isOptional = optional.includes(member);
    if (!(member in value) && !isOptional) {
      c.add(
        `${path}/${member}`,
        'MANIFEST_MISSING_PATTERN_MEMBER',
        `pattern kind '${kind}' requires a '${member}' member`,
      );
    }
  }
  for (const member of Object.keys(value)) {
    if (member === 'kind') continue;
    if (!expected.includes(member)) {
      c.add(
        `${path}/${member}`,
        'MANIFEST_UNKNOWN_PATTERN_MEMBER',
        `pattern kind '${kind}' has no '${member}' member; it has ${expected.join(', ') || 'none'}`,
      );
    }
  }

  // Recurse into whichever members hold patterns.
  const sub = (member: string, at = `${path}/${member}`) => {
    if (member in value) validatePattern(value[member], at, c, options);
  };
  const subMap = (member: string) => {
    if (!(member in value)) return;
    const map = value[member];
    if (!isRecord(map)) {
      c.add(
        `${path}/${member}`,
        'MANIFEST_BAD_PATTERN',
        `'${member}' must be an object of patterns, got ${show(map)}`,
      );
      return;
    }
    for (const [key, entry] of Object.entries(map)) {
      validatePattern(entry, `${path}/${member}/${key}`, c, options);
    }
  };

  switch (kind) {
    case 'eref':
    case 'opt':
    case 'await':
    case 'not':
    case 'gte':
      sub('of');
      break;
    case 'or':
    case 'and': {
      const of = value.of;
      if (!Array.isArray(of)) {
        c.add(
          `${path}/of`,
          'MANIFEST_BAD_PATTERN',
          `'${kind}' needs an array of patterns, got ${show(of)}`,
        );
      } else {
        if (of.length < 2) {
          c.add(
            `${path}/of`,
            'MANIFEST_BAD_PATTERN',
            `'${kind}' of fewer than two patterns is not a combination`,
          );
        }
        of.forEach((entry, index) =>
          validatePattern(entry, `${path}/of/${index}`, c, options),
        );
      }
      break;
    }
    case 'exactRecord':
      subMap('entries');
      break;
    case 'splitRecord':
      subMap('required');
      subMap('optional');
      sub('rest');
      break;
    case 'recordOf':
      sub('keys');
      sub('values');
      break;
    case 'arrayOf':
      sub('items');
      break;
    case 'remotable':
      requireString(value.label, `${path}/label`, c, 'remotable label');
      break;
    case 'ref':
      requireString(value.name, `${path}/name`, c, 'ref name');
      break;
    default:
      break;
  }
};

const validateFacet = (
  name: string,
  facet: unknown,
  c: Collector,
): void => {
  const path = `/facets/${name}`;
  if (!isRecord(facet)) {
    c.add(path, 'MANIFEST_BAD_FACET', `facet must be an object, got ${show(facet)}`);
    return;
  }

  const guard = facet.guard;
  if (typeof guard !== 'string' || !FACET_GUARDS.includes(guard as never)) {
    c.add(
      `${path}/guard`,
      'MANIFEST_BAD_GUARD',
      `facet guard must be one of ${FACET_GUARDS.join(', ')}, got ${show(guard)}`,
    );
    return;
  }
  if ('label' in facet) {
    requireString(facet.label, `${path}/label`, c, 'facet label');
  }

  const methods = facet.methods;
  if (!isRecord(methods)) {
    c.add(
      `${path}/methods`,
      'MANIFEST_BAD_FACET',
      `facet methods must be an object, got ${show(methods)}`,
    );
    return;
  }
  if (Object.keys(methods).length === 0) {
    c.add(
      `${path}/methods`,
      'MANIFEST_EMPTY_FACET',
      'a facet with no methods is not worth recording; omit it instead',
    );
  }

  for (const [methodName, entry] of Object.entries(methods)) {
    const at = `${path}/methods/${methodName}`;
    if (!isRecord(entry)) {
      c.add(at, 'MANIFEST_BAD_METHOD', `method must be an object, got ${show(entry)}`);
      continue;
    }

    const known = [
      'callKind',
      'params',
      'optionalParams',
      'restParams',
      'returns',
      'summary',
    ];
    for (const member of Object.keys(entry)) {
      if (!known.includes(member)) {
        c.add(
          `${at}/${member}`,
          'MANIFEST_UNKNOWN_METHOD_MEMBER',
          `a method entry has no '${member}' member; it has ${known.join(', ')}`,
        );
      }
    }

    // This is the heart of D2. An unguarded facet knows method names and
    // nothing else, so claiming a pattern for one is claiming knowledge that
    // does not exist.
    if (guard === 'none') {
      for (const member of ['callKind', 'params', 'optionalParams', 'restParams', 'returns']) {
        if (member in entry) {
          c.add(
            `${at}/${member}`,
            'MANIFEST_GUARDLESS_FACET_HAS_PATTERNS',
            `facet '${name}' has guard 'none', so its methods are names only; '${member}' claims knowledge the contract does not declare`,
          );
        }
      }
      continue;
    }

    const callKind = entry.callKind;
    if (callKind !== 'call' && callKind !== 'callWhen') {
      c.add(
        `${at}/callKind`,
        'MANIFEST_BAD_CALL_KIND',
        `callKind must be 'call' or 'callWhen', got ${show(callKind)}`,
      );
    }
    if (!('returns' in entry)) {
      c.add(
        `${at}/returns`,
        'MANIFEST_MISSING_RETURNS',
        `facet '${name}' has guard 'interface', so every method must state its return pattern`,
      );
    } else {
      validatePattern(entry.returns, `${at}/returns`, c);
    }

    for (const listName of ['params', 'optionalParams']) {
      if (!(listName in entry)) continue;
      const list = entry[listName];
      if (!Array.isArray(list)) {
        c.add(
          `${at}/${listName}`,
          'MANIFEST_BAD_METHOD',
          `'${listName}' must be an array of patterns, got ${show(list)}`,
        );
        continue;
      }
      list.forEach((param, index) =>
        validatePattern(param, `${at}/${listName}/${index}`, c, { inParams: true }),
      );
    }
    if ('restParams' in entry) {
      validatePattern(entry.restParams, `${at}/restParams`, c, { inParams: true });
    }
    if (!('params' in entry)) {
      c.add(
        `${at}/params`,
        'MANIFEST_MISSING_PARAMS',
        `facet '${name}' has guard 'interface', so every method must state its parameters, even as an empty array`,
      );
    }
  }
};

const validateInvitation = (
  name: string,
  invitation: unknown,
  facets: Record<string, unknown>,
  c: Collector,
): void => {
  const path = `/invitations/${name}`;
  if (!isRecord(invitation)) {
    c.add(path, 'MANIFEST_BAD_INVITATION', `invitation must be an object, got ${show(invitation)}`);
    return;
  }

  requireString(invitation.description, `${path}/description`, c, 'invitation description');

  const maker = invitation.maker;
  if (requireString(maker, `${path}/maker`, c, 'invitation maker')) {
    // The maker has to be a method that actually exists, or the manifest is
    // describing a way to get an invitation that nobody can follow.
    const found = Object.entries(facets).some(([, facet]) => {
      if (!isRecord(facet)) return false;
      const methods = facet.methods;
      return isRecord(methods) && typeof maker === 'string' && maker in methods;
    });
    if (!found) {
      c.add(
        `${path}/maker`,
        'MANIFEST_UNKNOWN_MAKER',
        `'${String(maker)}' is not a method on any facet in this manifest`,
      );
    }
  }

  if ('proposal' in invitation) {
    const proposal = invitation.proposal;
    if (!isRecord(proposal)) {
      c.add(
        `${path}/proposal`,
        'MANIFEST_BAD_INVITATION',
        `proposal must be an object, got ${show(proposal)}`,
      );
    } else {
      for (const member of Object.keys(proposal)) {
        if (!['give', 'want', 'exit', 'open'].includes(member)) {
          c.add(
            `${path}/proposal/${member}`,
            'MANIFEST_UNKNOWN_PROPOSAL_MEMBER',
            `a proposal shape has no '${member}' member; it has give, want, exit, open`,
          );
        }
      }
      for (const side of ['give', 'want']) {
        if (!(side in proposal)) continue;
        const keywords = proposal[side];
        if (!isRecord(keywords)) {
          c.add(
            `${path}/proposal/${side}`,
            'MANIFEST_BAD_INVITATION',
            `'${side}' must be an object keyed by keyword, got ${show(keywords)}`,
          );
          continue;
        }
        for (const [keyword, pattern] of Object.entries(keywords)) {
          if (!/^[A-Z][a-zA-Z0-9_]*$/.test(keyword)) {
            c.add(
              `${path}/proposal/${side}/${keyword}`,
              'MANIFEST_BAD_KEYWORD',
              `'${keyword}' is not a valid Zoe keyword: keywords are ASCII identifiers starting with an upper-case letter`,
            );
          }
          validatePattern(pattern, `${path}/proposal/${side}/${keyword}`, c);
        }
      }
      if ('exit' in proposal) {
        validatePattern(proposal.exit, `${path}/proposal/exit`, c);
      }
      if ('open' in proposal && typeof proposal.open !== 'boolean') {
        c.add(
          `${path}/proposal/open`,
          'MANIFEST_BAD_VALUE',
          `proposal.open must be a boolean, got ${show(proposal.open)}`,
        );
      }
    }
  }

  if ('offerArgs' in invitation) {
    validatePattern(invitation.offerArgs, `${path}/offerArgs`, c);
  }
};

const TOP_LEVEL = harden([
  'schema',
  'contract',
  'facets',
  'invitations',
  'published',
  'terms',
  'privateArgs',
  'traces',
  'notes',
]);

const REQUIRED_TOP_LEVEL = harden([
  'schema',
  'contract',
  'facets',
  'invitations',
  'published',
  'terms',
  'privateArgs',
]);

/**
 * Validate a candidate contract manifest.
 *
 * Collects every issue, and the result is hardened. As with format A, a
 * successfully validated manifest is the input object, so it is hardened too.
 */
export const validateContractManifest = (
  input: unknown,
): ManifestValidationResult => {
  const c = makeCollector();

  if (!isRecord(input)) {
    return harden({
      valid: false,
      issues: [
        {
          path: '',
          code: 'MANIFEST_NOT_AN_OBJECT',
          message: `a contract manifest must be a JSON object, got ${show(input)}`,
        },
      ],
    });
  }

  if (input.schema !== CONTRACT_MANIFEST_SCHEMA_ID) {
    c.add(
      '/schema',
      'MANIFEST_BAD_SCHEMA_ID',
      `schema must be '${CONTRACT_MANIFEST_SCHEMA_ID}', got ${show(input.schema)}`,
    );
  }
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in input)) {
      c.add(`/${field}`, 'MANIFEST_MISSING_FIELD', `a manifest must have a '${field}' field`);
    }
  }
  for (const field of Object.keys(input)) {
    if (!TOP_LEVEL.includes(field)) {
      c.add(
        `/${field}`,
        'MANIFEST_UNKNOWN_FIELD',
        `'${field}' is not a field of ${CONTRACT_MANIFEST_SCHEMA_ID}`,
      );
    }
  }

  const contract = input.contract;
  if (isRecord(contract)) {
    requireString(contract.name, '/contract/name', c, 'contract name');
    requireString(contract.version, '/contract/version', c, 'contract version');
    if (!('bundleId' in contract)) {
      c.add(
        '/contract/bundleId',
        'MANIFEST_MISSING_FIELD',
        "contract.bundleId is required; use null when the contract has not been bundled, so that 'unknown' and 'forgot to record it' are different states",
      );
    } else if (contract.bundleId !== null) {
      if (typeof contract.bundleId !== 'string' || !/^b1-[0-9a-f]{128}$/.test(contract.bundleId)) {
        c.add(
          '/contract/bundleId',
          'MANIFEST_BAD_BUNDLE_ID',
          `bundleId must be null or 'b1-' followed by 128 lowercase hex characters, got ${show(contract.bundleId)}`,
        );
      }
    }
  } else if ('contract' in input) {
    c.add('/contract', 'MANIFEST_BAD_VALUE', `contract must be an object, got ${show(contract)}`);
  }

  const facets = isRecord(input.facets) ? input.facets : {};
  if (isRecord(input.facets)) {
    if (Object.keys(facets).length === 0) {
      c.add('/facets', 'MANIFEST_NO_FACETS', 'a contract with no facets cannot be called');
    }
    for (const [name, facet] of Object.entries(facets)) {
      validateFacet(name, facet, c);
    }
  } else if ('facets' in input) {
    c.add('/facets', 'MANIFEST_BAD_VALUE', `facets must be an object, got ${show(input.facets)}`);
  }

  if (isRecord(input.invitations)) {
    for (const [name, invitation] of Object.entries(input.invitations)) {
      validateInvitation(name, invitation, facets, c);
    }
  } else if ('invitations' in input) {
    c.add(
      '/invitations',
      'MANIFEST_BAD_VALUE',
      `invitations must be an object, got ${show(input.invitations)}`,
    );
  }

  if (Array.isArray(input.published)) {
    input.published.forEach((entry, index) => {
      const path = `/published/${index}`;
      if (!isRecord(entry)) {
        c.add(path, 'MANIFEST_BAD_VALUE', `published entry must be an object, got ${show(entry)}`);
        return;
      }
      if (requireString(entry.path, `${path}/path`, c, 'published path')) {
        if (!String(entry.path).startsWith('published.')) {
          c.add(
            `${path}/path`,
            'MANIFEST_BAD_VSTORAGE_PATH',
            `a vstorage path must start with 'published.', got ${show(entry.path)}`,
          );
        }
      }
      if ('valueSchema' in entry) {
        validatePattern(entry.valueSchema, `${path}/valueSchema`, c);
      }
    });
  } else if ('published' in input) {
    c.add(
      '/published',
      'MANIFEST_BAD_VALUE',
      `published must be an array, got ${show(input.published)}`,
    );
  }

  for (const section of ['terms', 'privateArgs']) {
    const value = input[section];
    if (isRecord(value)) {
      for (const [key, pattern] of Object.entries(value)) {
        validatePattern(pattern, `/${section}/${key}`, c);
      }
    } else if (section in input) {
      c.add(`/${section}`, 'MANIFEST_BAD_VALUE', `${section} must be an object, got ${show(value)}`);
    }
  }

  if ('traces' in input) {
    const traces = input.traces;
    if (!Array.isArray(traces)) {
      c.add('/traces', 'MANIFEST_BAD_VALUE', `traces must be an array, got ${show(traces)}`);
    } else {
      traces.forEach((kind, index) => {
        // This is the join between format B and format A. A manifest naming an
        // event kind that format A does not define links to nothing.
        if (typeof kind !== 'string' || !(EVENT_KINDS as readonly string[]).includes(kind)) {
          c.add(
            `/traces/${index}`,
            'MANIFEST_UNKNOWN_TRACE_KIND',
            `${show(kind)} is not a trace-event.v0 event kind; the kinds are ${EVENT_KINDS.join(', ')}`,
          );
        }
      });
    }
  }

  if ('notes' in input) {
    const notes = input.notes;
    if (!Array.isArray(notes) || notes.some(note => typeof note !== 'string')) {
      c.add('/notes', 'MANIFEST_BAD_VALUE', 'notes must be an array of strings');
    }
  }

  if (c.issues.length > 0) {
    return harden({ valid: false, issues: [...c.issues] });
  }
  return harden({ valid: true, manifest: input as unknown as ContractManifest });
};

/** True when `input` is a valid contract manifest. */
export const isContractManifest = (input: unknown): input is ContractManifest =>
  validateContractManifest(input).valid;
