// SPDX-License-Identifier: Apache-2.0

import { test } from './prepare-test-env-ava.js';

import {
  SKILL_BODY_LIMIT_TOKENS,
  SKILL_BODY_TARGET_TOKENS,
  budgetVerdict,
  countSkillTokens,
  parseSkillFile,
} from '../src/index.js';
import { loadSkills } from './sources.js';

test('the tokenizer is o200k_base and runs under lockdown', t => {
  t.true(Object.isFrozen(Array.prototype));
  // Fixed counts for fixed text; if the encoding changes these move.
  t.is(countSkillTokens('Hello, Agoric hardened JavaScript!'), 8);
  t.is(countSkillTokens(''), 0);
});

test('budget verdicts follow D2: target 2,500, fail above 4,000', t => {
  t.is(budgetVerdict(SKILL_BODY_TARGET_TOKENS), 'within-target');
  t.is(budgetVerdict(SKILL_BODY_TARGET_TOKENS + 1), 'over-target');
  t.is(budgetVerdict(SKILL_BODY_LIMIT_TOKENS), 'over-target');
  t.is(budgetVerdict(SKILL_BODY_LIMIT_TOKENS + 1), 'over-limit');
});

for (const skill of loadSkills()) {
  test(`${skill.name}: SKILL.md body is within the token limit`, t => {
    const parsed = parseSkillFile(skill.skillMd);
    if (typeof parsed === 'string') {
      t.fail(parsed);
      return;
    }
    const tokens = countSkillTokens(parsed.body);
    const verdict = budgetVerdict(tokens);
    t.log(`${skill.name}: ${tokens} tokens (${verdict})`);
    t.not(verdict, 'over-limit', `${tokens} tokens is over ${SKILL_BODY_LIMIT_TOKENS}; move detail to references/`);
  });
}
