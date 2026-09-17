// SPDX-License-Identifier: Apache-2.0

/**
 * Reading a skill source: `src/<skill>/SKILL.md` plus `references/*.md`
 * (RELEASE1-BRIEF.md D2).
 *
 * The conventions below are what the checks in `test/` enforce, and what the
 * day 4 render step will rely on.
 *
 * - Frontmatter carries `name` and `description`, one line each.
 * - Every idiom is a `### ` section under `## Idioms` or `## Project setup`
 *   with at least one
 *   `**Correct:**` line whose code spans are refs (see `@dcfoundation/aat-core`
 *   `parseRef`), and at least one wrong snippet.
 * - A wrong snippet is a fenced block whose info string is `<lang> wrong=<CODE>`,
 *   followed by a `**Produces:**` line giving the error text or starting with
 *   `silent`. CODE must be in the catalogue in `packages/core/src/hints.ts`.
 * - Text lifted word for word from upstream sits between
 *   `<!-- lift: <upstream ref> -->` and `<!-- /lift -->`.
 */

export interface SkillFrontmatter {
  readonly name: string;
  readonly description: string;
}

export interface WrongSnippet {
  readonly code: string;
  readonly lang: string;
  /** 1-based line of the opening fence. */
  readonly line: number;
  /** The text after `**Produces:**`, or undefined if the line is missing. */
  readonly produces: string | undefined;
}

export interface Idiom {
  readonly title: string;
  readonly line: number;
  readonly correctRefs: readonly string[];
  readonly wrongSnippets: readonly WrongSnippet[];
}

export interface Lift {
  readonly ref: string;
  readonly line: number;
  readonly text: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

/** Split a SKILL.md into frontmatter fields and body. */
export const parseSkillFile = (
  text: string,
): { frontmatter: SkillFrontmatter; body: string } | string => {
  const m = FRONTMATTER.exec(text);
  if (!m) return 'missing frontmatter';
  const fields = new Map<string, string>();
  for (const raw of (m[1] ?? '').split('\n')) {
    const f = /^([a-z-]+):\s*(.*)$/.exec(raw);
    if (!f) return `unreadable frontmatter line: ${raw}`;
    const [, key = '', value = ''] = f;
    fields.set(key, value.startsWith('"') ? String(JSON.parse(value)) : value);
  }
  const name = fields.get('name');
  const description = fields.get('description');
  if (!name) return 'frontmatter has no name';
  if (!description) return 'frontmatter has no description';
  return harden({ frontmatter: { name, description }, body: text.slice(m[0].length) });
};

const WRONG_FENCE = /^```(\w+) wrong=([A-Z][A-Z0-9_]*)\s*$/;

/** Every wrong snippet in a markdown text, with its `**Produces:**` line. */
export const findWrongSnippets = (markdown: string): readonly WrongSnippet[] => {
  const lines = markdown.split('\n');
  const found: WrongSnippet[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = WRONG_FENCE.exec(lines[i] ?? '');
    if (!m) continue;
    let close = i + 1;
    while (close < lines.length && lines[close] !== '```') close += 1;
    let next = close + 1;
    while (next < lines.length && (lines[next] ?? '').trim() === '') next += 1;
    const produced = /^\*\*Produces:\*\*\s+(.+)$/.exec(lines[next] ?? '');
    found.push({
      code: m[2] ?? '',
      lang: m[1] ?? '',
      line: i + 1,
      produces: produced?.[1],
    });
    i = close;
  }
  return harden(found);
};

/** Fenced blocks that look like wrong snippets but are malformed. */
export const findMalformedWrongFences = (markdown: string): readonly number[] =>
  harden(
    markdown
      .split('\n')
      .map((line, i) => [line, i + 1] as const)
      .filter(([line]) => /^```.*wrong/.test(line) && !WRONG_FENCE.test(line))
      .map(([, n]) => n),
  );

const codeSpans = (line: string) => [...line.matchAll(/`([^`]+)`/g)].map(m => m[1] ?? '');

/** Sections whose `### ` subsections are idioms and must follow the rules. */
const IDIOM_SECTIONS = ['## Idioms', '## Project setup'];

/** The `### ` sections under `## Idioms` and `## Project setup`. */
export const findIdioms = (markdown: string): readonly Idiom[] => {
  const lines = markdown.split('\n');
  const idioms: Idiom[] = [];
  let inIdioms = false;
  let current: { title: string; line: number; start: number } | undefined;
  const flush = (end: number) => {
    if (!current) return;
    const section = lines.slice(current.start, end).join('\n');
    idioms.push({
      title: current.title,
      line: current.line,
      correctRefs: section
        .split('\n')
        .filter(l => l.startsWith('**Correct:**'))
        .flatMap(codeSpans),
      wrongSnippets: findWrongSnippets(section),
    });
    current = undefined;
  };
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    if (line.startsWith('## ')) {
      flush(i);
      inIdioms = IDIOM_SECTIONS.includes(line.trim());
    } else if (inIdioms && line.startsWith('### ')) {
      flush(i);
      current = { title: line.slice(4).trim(), line: i + 1, start: i + 1 };
    }
  }
  flush(lines.length);
  return harden(idioms);
};

/** Every `<!-- lift: ref -->` … `<!-- /lift -->` block. */
export const findLifts = (markdown: string): readonly Lift[] => {
  const lines = markdown.split('\n');
  const lifts: Lift[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^<!-- lift: (\S+) -->$/.exec(lines[i] ?? '');
    if (!m) continue;
    let end = i + 1;
    while (end < lines.length && lines[end] !== '<!-- /lift -->') end += 1;
    lifts.push({ ref: m[1] ?? '', line: i + 1, text: lines.slice(i + 1, end).join('\n') });
    i = end;
  }
  return harden(lifts);
};
