// SPDX-License-Identifier: Apache-2.0

export {
  SKILL_BODY_LIMIT_TOKENS,
  SKILL_BODY_TARGET_TOKENS,
  budgetVerdict,
  countSkillTokens,
} from './budget.js';
export type { BudgetVerdict } from './budget.js';

export {
  findIdioms,
  findLifts,
  findMalformedWrongFences,
  findWrongSnippets,
  parseSkillFile,
} from './skill-source.js';
export type { Idiom, Lift, SkillFrontmatter, WrongSnippet } from './skill-source.js';

/** The skills that exist so far. agoric-errors is rendered from the catalogue on day 4. */
export const SKILL_NAMES = harden([
  'agoric-hardened-js',
  'agoric-zoe-contract',
  'agoric-durable-state',
  'agoric-orchestration',
  'agoric-testing',
  'agoric-deploy',
] as const);

export {
  AGENTS_MD_LIMIT_TOKENS,
  AGENTS_MD_WARN_TOKENS,
  PACKAGE_AGENTS_MD_LIMIT_TOKENS,
} from './budget.js';
export { loadRenderInputs, parsePins } from './inputs.js';
export type { SourceIo } from './inputs.js';
export { DIST, DOCS, ERRORS_SKILL, RENDER_ROOTS, orderCatalogue, renderPack, topicFile, topicOf } from './render.js';
export type { RenderInputs, RenderedFile, SkillSource } from './render.js';
