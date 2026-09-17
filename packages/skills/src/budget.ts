// SPDX-License-Identifier: Apache-2.0

import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';

/**
 * RELEASE1-BRIEF.md D2: each SKILL.md body targets 2,500 tokens and fails the
 * build above 4,000; anything longer moves to `references/`. Counted with
 * OpenAI's o200k_base (D3), because Codex is the agent that reads files whole;
 * for Claude the same count is a conservative estimate.
 *
 * The body is everything after the frontmatter. The frontmatter is budgeted
 * separately by the agents that load it, and is short.
 */
export const SKILL_BODY_TARGET_TOKENS = 2500;
export const SKILL_BODY_LIMIT_TOKENS = 4000;

export type BudgetVerdict = 'within-target' | 'over-target' | 'over-limit';

export const countSkillTokens = (body: string): number => countTokens(body);

export const budgetVerdict = (tokens: number): BudgetVerdict => {
  if (tokens > SKILL_BODY_LIMIT_TOKENS) return 'over-limit';
  if (tokens > SKILL_BODY_TARGET_TOKENS) return 'over-target';
  return 'within-target';
};

/**
 * RELEASE1-BRIEF.md D3 as set on day 4: the pack AGENTS.md (and the Copilot
 * instructions, which Copilot also loads whole) warns above 1,600 tokens and
 * fails above 2,000. Per-package AGENTS.md files fail above 500.
 */
export const AGENTS_MD_WARN_TOKENS = 1600;
export const AGENTS_MD_LIMIT_TOKENS = 2000;
export const PACKAGE_AGENTS_MD_LIMIT_TOKENS = 500;
