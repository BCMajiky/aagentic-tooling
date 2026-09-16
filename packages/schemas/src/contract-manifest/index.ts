// SPDX-License-Identifier: Apache-2.0

export {
  OPTIONAL_MEMBERS,
  PARAM_ONLY_KINDS,
  PATTERN_KINDS,
  PATTERN_MEMBERS,
  isPatternKind,
} from './patterns.js';
export type { PatternKind, SerialisedPattern } from './patterns.js';

export {
  CONTRACT_MANIFEST_SCHEMA_ID,
  CONTRACT_MANIFEST_VERSION,
  FACET_GUARDS,
} from './types.js';
export type {
  CallKind,
  ContractIdentity,
  ContractManifest,
  Facet,
  FacetGuard,
  Invitation,
  ManifestIssue,
  ManifestValidationResult,
  MethodEntry,
  ProposalShape,
  PublishedPath,
} from './types.js';

export {
  isContractManifest,
  validateContractManifest,
} from './validate.js';
