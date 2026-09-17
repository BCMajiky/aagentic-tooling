// SPDX-License-Identifier: Apache-2.0

/**
 * Render the skill pack for every target (RELEASE1-BRIEF.md D2, D3).
 *
 * This module is pure: sources in, a sorted list of files out. It reads
 * nothing and writes nothing, so a render is deterministic by construction and
 * the staleness test can compare a fresh render with what is committed.
 * `scripts/build.mjs` does the reading and writing.
 *
 * Output paths are relative to the repository root.
 */

import type { CatalogueEntry } from '@dcfoundation/aat-core';

import { findLifts, parseSkillFile } from './skill-source.js';
import type { SkillFrontmatter } from './skill-source.js';

export interface SkillSource {
  readonly name: string;
  /** Text of `src/<name>/SKILL.md`. */
  readonly skillMd: string;
  /** `references/*.md`, sorted by name. */
  readonly references: ReadonlyArray<{ readonly name: string; readonly text: string }>;
}

export interface RenderInputs {
  readonly skills: readonly SkillSource[];
  readonly catalogue: readonly CatalogueEntry[];
  /** Devnet sharp edges that are not catalogue entries, with reasons. */
  readonly notCarriedOver: ReadonlyArray<{
    readonly sharpEdge: number;
    readonly reason: string;
    readonly refs: readonly string[];
  }>;
  /** Text of `src/pack-rules.md`. */
  readonly packRules: string;
  /** Every file under `packages/skills/snippets/` except node_modules, keyed by path relative to it. */
  readonly snippets: Readonly<Record<string, string>>;
  /** `examples/*` source files that the skills cite, keyed by repository path. */
  readonly examples: Readonly<Record<string, string>>;
  /** Repository paths cited in skill sources that exist, files or directories. */
  readonly repoPaths: readonly string[];
  /** Agoric package pins, from docs/PINS.md. */
  readonly pins: ReadonlyArray<{ readonly name: string; readonly version: string }>;
  /** The tokenizer the budget checks use, recorded in the AGENTS.md footer. */
  readonly tokenizer: { readonly name: string; readonly version: string; readonly encoding: string };
}

export interface RenderedFile {
  readonly path: string;
  readonly content: string;
}

export const DIST = 'packages/skills/dist';
export const DOCS = 'docs/skills';

/** Every directory the render owns. A file under one of these that the render does not produce is stale. */
export const RENDER_ROOTS = harden([
  `${DIST}/claude`,
  `${DIST}/codex`,
  `${DIST}/cursor`,
  `${DIST}/copilot`,
  `${DIST}/agents-md`,
  DOCS,
]);

const SNIPPETS_PREFIX = 'packages/skills/snippets/';

/** Tags or full commits for the pinned upstream refs, for GitHub links. */
const UPSTREAM_REVISION: Readonly<Record<string, string>> = harden({
  cc25a29: 'agoric-upgrade-23a',
  a2a3de9: 'a2a3de9c5353df8167984bc1008aa8f4349804a7',
});

export const ERRORS_SKILL = 'agoric-errors';

const errorsFrontmatter: SkillFrontmatter = harden({
  name: ERRORS_SKILL,
  description:
    'The Agoric error catalogue: for each known failure, the message to match (or that it is silent), the cause and the fix, grouped by topic with the silent ones first. Load when an Agoric, Zoe, orchestration, Endo or deploy error appears, or when something succeeds and nothing happens. Do not load to learn an API from scratch; the topic skills cover that.',
  displayName: 'Agoric Errors',
  shortDescription: 'Known failures: match, cause and fix',
  when: 'an error appears, or something succeeds and nothing happens',
});

// ---------------------------------------------------------------------------
// Refs

type Mode =
  /** A skill folder: snippet refs become relative links to copies in the folder. */
  | { readonly kind: 'folder'; readonly depth: number; readonly copies: Set<string> }
  /** A single page with no folder (site, copilot): snippet refs become repository paths. */
  | { readonly kind: 'page' };

const ANCHORED = /^([^#\s]+)(#L(\d+)(?:-L(\d+))?)?$/;

const lineAnchor = (start: number, end: number) =>
  start === end ? `#L${start}` : `#L${start}-L${end}`;

/** The first line after a file's comment header, which ends at the first blank line. */
const bodyStart = (text: string) => text.split('\n').indexOf('') + 1;

/**
 * Map an `examples/` file to the snippet that is a copy of it, with the line
 * offset between them. Returns undefined when no snippet has the same body.
 */
const exampleToSnippet = (inputs: RenderInputs, examplePath: string) => {
  const example = inputs.examples[examplePath];
  if (example === undefined) return undefined;
  const exLines = example.split('\n');
  // offer-up's header has no blank line before the code; its body starts at
  // the first JSDoc block. Every other example header ends at a blank line.
  const exStart = examplePath.endsWith('offer-up.contract.js')
    ? exLines.findIndex(l => l.startsWith('/**'))
    : bodyStart(example);
  const exBody = exLines.slice(exStart).join('\n');
  for (const [rel, text] of Object.entries(inputs.snippets).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (rel.endsWith('.excerpt.js') || !rel.endsWith('.js') || rel.startsWith('test/')) continue;
    const start = bodyStart(text);
    if (text.split('\n').slice(start).join('\n') === exBody) {
      return { rel, offset: start - exStart };
    }
  }
  return undefined;
};

/**
 * Other snippets a snippet needs: its relative imports, and snippet paths it
 * names as strings (the tests bundle contracts by path, not by import).
 */
const relativeImports = (rel: string, text: string) => {
  const dir = rel.split('/').slice(0, -1);
  const imports = [...text.matchAll(/from '(\.{1,2}\/[^']+)'/g)].map(m => {
    const parts = [...dir];
    for (const seg of (m[1] ?? '').split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  });
  const named = [...text.matchAll(/'((?:zoe|durable|orchestration)\/[\w.-]+\.js)'/g)].map(m => m[1] ?? '');
  return [...imports, ...named];
};

const addCopy = (inputs: RenderInputs, copies: Set<string>, rel: string) => {
  if (copies.has(rel) || inputs.snippets[rel] === undefined) return;
  copies.add(rel);
  for (const dep of relativeImports(rel, inputs.snippets[rel] ?? '')) addCopy(inputs, copies, dep);
};

/** Rewrite one inline code span, or return it unchanged. */
const rewriteSpan = (inputs: RenderInputs, mode: Mode, span: string): string => {
  const upstream = /^agoric-sdk@([0-9a-f]{7}):(\S+?)(#L(\d+)(?:-L(\d+))?)?$/.exec(span);
  if (upstream) {
    const [, commit = '', path = '', anchor = ''] = upstream;
    const rev = UPSTREAM_REVISION[commit];
    return rev === undefined
      ? `\`${span}\``
      : `[\`${span}\`](https://github.com/Agoric/agoric-sdk/blob/${rev}/${path}${anchor})`;
  }
  const m = ANCHORED.exec(span);
  // A bare file name such as `package.json` in prose means the reader's own
  // file, so only spans with a directory or a line anchor are repository refs.
  if (!m || !inputs.repoPaths.includes(m[1] ?? '') || !(span.includes('/') || m[2])) {
    return `\`${span}\``;
  }
  const [, path = '', , start, end] = m;
  const range = start === undefined ? '' : lineAnchor(Number(start), Number(end ?? start));

  let snippetRel: string | undefined;
  let offset = 0;
  if (path.startsWith(SNIPPETS_PREFIX) && inputs.snippets[path.slice(SNIPPETS_PREFIX.length)] !== undefined) {
    snippetRel = path.slice(SNIPPETS_PREFIX.length);
  } else if (path.startsWith('examples/')) {
    const mapped = exampleToSnippet(inputs, path);
    if (mapped) {
      snippetRel = mapped.rel;
      offset = mapped.offset;
    }
  }
  if (snippetRel === undefined || mode.kind === 'page') {
    return `\`aagentic-tooling/${path}${range}\``;
  }
  addCopy(inputs, mode.copies, snippetRel);
  const shifted =
    start === undefined ? '' : lineAnchor(Number(start) + offset, Number(end ?? start) + offset);
  const target = `${'../'.repeat(mode.depth)}snippets/${snippetRel}`;
  return `[\`snippets/${snippetRel}${shifted}\`](${target})`;
};

/**
 * Rewrite the refs in a markdown body for a target. Fenced blocks and
 * word-for-word lifts are left exactly as they are.
 */
const rewriteBody = (inputs: RenderInputs, mode: Mode, markdown: string): string => {
  const liftLines = new Set<number>();
  const lines = markdown.split('\n');
  for (const lift of findLifts(markdown)) {
    const count = lift.text.split('\n').length;
    for (let i = lift.line; i <= lift.line + count + 1; i += 1) liftLines.add(i);
  }
  let inFence = false;
  return lines
    .map((line, i) => {
      if (line.startsWith('```')) {
        inFence = !inFence;
        return line;
      }
      if (inFence || liftLines.has(i + 1)) return line;
      return line.replace(/`([^`\n]+)`/g, (_all, span: string) => rewriteSpan(inputs, mode, span));
    })
    .join('\n');
};

// ---------------------------------------------------------------------------
// Skills

interface ParsedSkill {
  readonly name: string;
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
  readonly references: SkillSource['references'];
}

const parseAll = (inputs: RenderInputs): readonly ParsedSkill[] =>
  inputs.skills.map(skill => {
    const parsed = parseSkillFile(skill.skillMd);
    if (typeof parsed === 'string') throw Error(`${skill.name}: ${parsed}`);
    return { name: skill.name, frontmatter: parsed.frontmatter, body: parsed.body, references: skill.references };
  });

const skillFrontmatter = (fm: SkillFrontmatter) =>
  `---\nname: ${fm.name}\ndescription: ${JSON.stringify(fm.description)}\n---\n`;

/** SKILL.md, references and snippet copies for one skill, under `root`. */
const renderSkillFolder = (
  inputs: RenderInputs,
  skill: ParsedSkill,
  root: string,
  head: string,
  skillFile: string,
): RenderedFile[] => {
  const copies = new Set<string>();
  const files: RenderedFile[] = [
    { path: `${root}/${skillFile}`, content: head + rewriteBody(inputs, { kind: 'folder', depth: skillFile.includes('/') ? 1 : 0, copies }, skill.body) },
  ];
  for (const ref of skill.references) {
    files.push({
      path: `${root}/references/${ref.name}`,
      content: rewriteBody(inputs, { kind: 'folder', depth: 1, copies }, ref.text),
    });
  }
  for (const rel of [...copies].sort()) {
    files.push({ path: `${root}/snippets/${rel}`, content: inputs.snippets[rel] ?? '' });
  }
  return files;
};

const codexSidecar = (fm: SkillFrontmatter) =>
  `interface:\n  display_name: ${JSON.stringify(fm.displayName)}\n  short_description: ${JSON.stringify(fm.shortDescription)}\n`;

// ---------------------------------------------------------------------------
// agoric-errors

const TOPIC_ORDER = [
  'agoric-hardened-js',
  'agoric-zoe-contract',
  'agoric-durable-state',
  'agoric-orchestration',
  'agoric-testing',
  'agoric-deploy',
] as const;

const TOPIC_TITLE: Readonly<Record<string, string>> = harden({
  'agoric-hardened-js': 'Hardened JavaScript',
  'agoric-zoe-contract': 'Zoe contracts',
  'agoric-durable-state': 'Durable state and upgrade',
  'agoric-orchestration': 'Orchestration',
  'agoric-testing': 'Testing',
  'agoric-deploy': 'Project setup and deploy',
  other: 'Other',
});

/** An entry's topic: the first skill its refs point at, else `other`. */
export const topicOf = (entry: CatalogueEntry): string => {
  for (const ref of entry.refs) {
    const m = /^packages\/skills\/src\/(agoric-[a-z-]+)\//.exec(ref);
    if (m?.[1] !== undefined && (TOPIC_ORDER as readonly string[]).includes(m[1])) return m[1];
  }
  return 'other';
};

/** Topic order, then silent entries first, then catalogue order. */
export const orderCatalogue = (catalogue: readonly CatalogueEntry[]) => {
  const topics = [...TOPIC_ORDER, 'other'];
  return harden(
    catalogue
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const t = topics.indexOf(topicOf(a.entry)) - topics.indexOf(topicOf(b.entry));
        if (t !== 0) return t;
        const s = Number(b.entry.match.kind === 'silent') - Number(a.entry.match.kind === 'silent');
        return s !== 0 ? s : a.index - b.index;
      })
      .map(({ entry }) => entry),
  );
};

const codeSpan = (text: string) => {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map(m => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return longest === 0 ? `\`${text}\`` : `${fence} ${text} ${fence}`;
};

const renderRef = (inputs: RenderInputs, mode: Mode, ref: string) => {
  const catalogueRef = /^catalogue:([A-Z0-9_]+)$/.exec(ref);
  if (catalogueRef) return `\`${catalogueRef[1]}\``;
  const edge = /^sharp-edge:(\d+)$/.exec(ref);
  if (edge) return `devnet sharp edge ${edge[1]}`;
  const skill = /^packages\/skills\/src\/(agoric-[a-z-]+)\/SKILL\.md$/.exec(ref);
  if (skill) return `skill \`${skill[1]}\``;
  return rewriteSpan(inputs, mode, ref);
};

const matchText = (entry: CatalogueEntry) => {
  switch (entry.match.kind) {
    case 'silent':
      return 'silent';
    case 'literal':
      return `contains ${codeSpan(entry.match.text)}`;
    default:
      return `matches ${codeSpan(entry.match.source)}`;
  }
};

/** Code-unit order, independent of locale. */
const byPath = (a: { path: string }, b: { path: string }) => {
  if (a.path === b.path) return 0;
  return a.path < b.path ? -1 : 1;
};

/** `references/<file>` for a topic. */
export const topicFile = (topic: string) => `${topic.replace(/^agoric-/, '')}.md`;

const groupByTopic = (catalogue: readonly CatalogueEntry[]) => {
  const groups: Array<{ topic: string; entries: CatalogueEntry[] }> = [];
  for (const entry of orderCatalogue(catalogue)) {
    const topic = topicOf(entry);
    const last = groups.at(-1);
    if (last?.topic === topic) last.entries.push(entry);
    else groups.push({ topic, entries: [entry] });
  }
  return groups;
};

/** Full entries for one topic. */
const renderErrorEntries = (inputs: RenderInputs, mode: Mode, entries: readonly CatalogueEntry[]) =>
  entries
    .flatMap(entry => [
      `### ${entry.code}`,
      '',
      `**Match:** ${matchText(entry)}`,
      '',
      `**Cause:** ${entry.cause}`,
      '',
      `**Fix:** ${entry.fix}`,
      '',
      `**See:** ${entry.refs.map(ref => renderRef(inputs, mode, ref)).join(' · ')}`,
      '',
    ])
    .join('\n');

/** The devnet sharp edges that are not entries, for the index and the site page. */
const renderNotCarriedOver = (inputs: RenderInputs, mode: Mode) => [
  '',
  '## Not carried over',
  '',
  'Devnet sharp edges (from the Servandum contract work) that are not entries above, and why. Every other sharp edge is an entry.',
  '',
  ...inputs.notCarriedOver.map(({ sharpEdge, reason, refs }) =>
    `- **Sharp edge ${sharpEdge}.** ${reason}${refs.length ? ` See ${refs.map(ref => renderRef(inputs, mode, ref)).join(', ')}.` : ''}`,
  ),
];

const ERRORS_INTRO = [
  '# Agoric error catalogue',
  '',
  'Every known failure, grouped by topic. Within a topic the **silent** ones come first: no error, a hang, or a success code with nothing done. Check those when nothing is visibly wrong; for the rest, search for a distinctive part of the message. When a message matches more than one entry, the more specific entry applies: PATTERN_MISMATCH is the fallback for any pattern failure without its own entry.',
];

/**
 * The agoric-errors SKILL.md body: every entry's code and match, in order,
 * with each topic's full entries (cause, fix, refs) in `references/`. The
 * whole catalogue does not fit the 4,000-token SKILL.md limit (D2).
 */
const renderErrorsIndex = (inputs: RenderInputs, referencesPrefix: string) => {
  const groups = groupByTopic(inputs.catalogue);
  const out = [
    ...ERRORS_INTRO,
    '',
    `Rendered from \`packages/core/src/hints.ts\` in aagentic-tooling, the catalogue the \`aat\` CLI reads: ${inputs.catalogue.length} entries. Cause and fix for each are in the topic's reference file.`,
  ];
  for (const { topic, entries } of groups) {
    out.push(
      '',
      `## ${TOPIC_TITLE[topic] ?? topic}`,
      '',
      `Full entries: \`${referencesPrefix}references/${topicFile(topic)}\``,
      '',
      ...entries.map(entry => `- **${entry.code}**: ${matchText(entry)}`),
    );
  }
  out.push(...renderNotCarriedOver(inputs, { kind: 'page' }));
  return `${out.join('\n')}\n`;
};

/** One reference file per topic. */
const renderErrorsReferences = (inputs: RenderInputs, mode: Mode) =>
  groupByTopic(inputs.catalogue).map(({ topic, entries }) => ({
    name: topicFile(topic),
    content: `# ${TOPIC_TITLE[topic] ?? topic}: error catalogue\n\n${renderErrorEntries(inputs, mode, entries)}`,
  }));

/** The whole catalogue on one page, for the docs site. */
const renderErrorsPage = (inputs: RenderInputs) =>
  `${[
    ...ERRORS_INTRO,
    '',
    `Rendered from \`packages/core/src/hints.ts\`: ${inputs.catalogue.length} entries.`,
    ...groupByTopic(inputs.catalogue).flatMap(({ topic, entries }) => [
      '',
      `## ${TOPIC_TITLE[topic] ?? topic}`,
      '',
      renderErrorEntries(inputs, { kind: 'page' }, entries).trimEnd(),
    ]),
    ...renderNotCarriedOver(inputs, { kind: 'page' }),
  ].join('\n')}\n`;

// ---------------------------------------------------------------------------
// AGENTS.md and copilot-instructions.md

const packRuleLines = (packRules: string) =>
  packRules
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter(l => l.startsWith('- '));

const agentsFooter = (inputs: RenderInputs, limit: number) =>
  `Generated by aagentic-tooling \`yarn skills:build\`; edit the sources, not this file. Token budget ${limit}, counted with ${inputs.tokenizer.name} ${inputs.tokenizer.version} (${inputs.tokenizer.encoding}).`;

const indexBody = (inputs: RenderInputs, skills: readonly ParsedSkill[], where: string) => {
  const all = [...skills.map(s => s.frontmatter), errorsFrontmatter];
  return [
    'This project uses the aagentic-tooling skill pack for Agoric smart contracts at agoric-upgrade-23: seven skills, loaded when a task needs them, and the rules below, which hold even when no skill is loaded.',
    '',
    where,
    '',
    '## Pins',
    '',
    'Install exact versions, no carets (dist-tag `agoric-upgrade-23`, the current mainnet line):',
    '',
    ...inputs.pins.map(p => `- \`${p.name}\` ${p.version}`),
    '',
    'Pin the `@endo/*` tree and `ses` 1.14.0 through `resolutions` copied from the SDK lockfile, or two copies of `ses` load. Node 22; yarn 4 via corepack with `nodeLinker: node-modules`.',
    '',
    '## Commands',
    '',
    '- `corepack enable && yarn install`',
    '- `yarn test`: ava, every test under `@endo/ses-ava` through `@agoric/zoe/tools/prepare-test-env-ava.js`',
    '- `aat config show --network devnet`: rpc, api and chain id per network (`local`, `devnet`, `emerynet`, `mainnet`)',
    '',
    '## Skills',
    '',
    ...all.map(fm => `- \`${fm.name}\`: load when ${fm.when}.`),
    '',
    '## Rules',
    '',
    ...packRuleLines(inputs.packRules),
  ];
};

const renderAgentsMd = (inputs: RenderInputs, skills: readonly ParsedSkill[]) =>
  [
    '# Agoric skill pack',
    '',
    ...indexBody(
      inputs,
      skills,
      'Skills are in `.agents/skills/` (Codex), `.claude/skills/` (Claude Code) and `.cursor/rules/` (Cursor).',
    ),
    '',
    '---',
    '',
    agentsFooter(inputs, 2000),
    '',
  ].join('\n');

const renderCopilot = (inputs: RenderInputs, skills: readonly ParsedSkill[]) =>
  [
    '# Copilot instructions',
    '',
    ...indexBody(
      inputs,
      skills,
      'Copilot reads only this file. The skills themselves are rendered for Codex (`.agents/skills/`), Claude Code (`.claude/skills/`) and Cursor (`.cursor/rules/`); when one of them is installed in this repository, read the named skill before the task it covers.',
    ),
    '',
    '---',
    '',
    agentsFooter(inputs, 2000),
    '',
  ].join('\n');

const renderContractAgents = (inputs: RenderInputs) =>
  [
    '# contract/',
    '',
    'Zoe and orchestration contract code, its tests and its deploy scripts. Use the skills: `agoric-zoe-contract` for invitations, proposals and facets; `agoric-durable-state` for anything that must survive upgrade; `agoric-orchestration` for chain accounts and `*.flows.js`; `agoric-testing` for tests; `agoric-deploy` for bundling and deploy; `agoric-errors` when something fails.',
    '',
    'Here in particular:',
    '',
    '- Tests bundle the contract from its file path, and run on the SDK test tools, not hand-made fakes.',
    '- Declare every package the contract imports in `dependencies`; bundling ignores hoisted packages.',
    '- Per-network values (pay denom, chain ids, board ids) are terms or lookups, never constants.',
    '',
    'The rules in the root `AGENTS.md` apply.',
    '',
    '---',
    '',
    agentsFooter(inputs, 500),
    '',
  ].join('\n');

const renderUiAgents = (inputs: RenderInputs) =>
  [
    '# ui/',
    '',
    'The dapp front end. It reads the chain through vstorage and makes offers through the user\'s smart wallet; it does not import contract code. In `dapp-offer-up` that is `makeAgoricChainStorageWatcher` from `@agoric/rpc` and `makeAgoricWalletConnection` from `@agoric/web-components`.',
    '',
    'This pack pins no UI packages in v0.1. The agoric-upgrade-23 pin covers the SDK packages only, and dapp-offer-up\'s UI dependencies are u16-era (`@agoric/notifier` ^0.7.0-u16.1, `@agoric/store` ^0.9.3-u16.0 at 4ea27c5).',
    'Pinning UI packages is a Release 2 item, once there is a UI task to check versions against.',
    '',
    'Here in particular:',
    '',
    '- Find instances and brands in `published.agoricNames` after each deploy; never hardcode board ids or instance handles.',
    '- Take the chain id and endpoints per network (`aat config show --network <name>`); the template hardcodes `agoriclocal`.',
    '- An offer\'s proposal must match the invitation\'s proposal shape, or Zoe refuses it before escrow.',
    '',
    'Load `agoric-deploy` for per-network values and `agoric-errors` when an offer fails. The rules in the root `AGENTS.md` apply.',
    '',
    '---',
    '',
    agentsFooter(inputs, 500),
    '',
  ].join('\n');

// ---------------------------------------------------------------------------

/** Render every target. Sorted by path; identical inputs give identical output. */
export const renderPack = (inputs: RenderInputs): readonly RenderedFile[] => {
  const skills = parseAll(inputs);
  const files: RenderedFile[] = [];


  for (const skill of skills) {
    const fm = skill.frontmatter;
    files.push(
      ...renderSkillFolder(inputs, skill, `${DIST}/claude/${skill.name}`, skillFrontmatter(fm), 'SKILL.md'),
      ...renderSkillFolder(inputs, skill, `${DIST}/codex/.agents/skills/${skill.name}`, skillFrontmatter(fm), 'SKILL.md'),
      { path: `${DIST}/codex/.agents/skills/${skill.name}/agents/openai.yaml`, content: codexSidecar(fm) },
    );
    const cursorHead = `---\ndescription: ${JSON.stringify(fm.description)}\nglobs:\nalwaysApply: false\n---\n`;
    const cursorCopies = new Set<string>();
    files.push({
      path: `${DIST}/cursor/.cursor/rules/${skill.name}.mdc`,
      content:
        cursorHead +
        rewriteBody(inputs, { kind: 'folder', depth: 0, copies: cursorCopies }, skill.body)
          .replaceAll('](snippets/', `](${skill.name}/snippets/`)
          .replaceAll('`references/', `\`${skill.name}/references/`),
    });
    for (const ref of skill.references) {
      files.push({
        path: `${DIST}/cursor/.cursor/rules/${skill.name}/references/${ref.name}`,
        content: rewriteBody(inputs, { kind: 'folder', depth: 1, copies: cursorCopies }, ref.text),
      });
    }
    for (const rel of [...cursorCopies].sort()) {
      files.push({ path: `${DIST}/cursor/.cursor/rules/${skill.name}/snippets/${rel}`, content: inputs.snippets[rel] ?? '' });
    }
    files.push({
      path: `${DOCS}/${skill.name}.md`,
      content:
        rewriteBody(inputs, { kind: 'page' }, skill.body) +
        skill.references
          .map(ref => `\n---\n\n*Reference: \`references/${ref.name}\`*\n\n${rewriteBody(inputs, { kind: 'page' }, ref.text)}`)
          .join(''),
    });
  }

  // agoric-errors has no source folder: it renders from the catalogue.
  const errorsHead = skillFrontmatter(errorsFrontmatter);
  const errorsRefs = renderErrorsReferences(inputs, { kind: 'page' });
  for (const root of [`${DIST}/claude/${ERRORS_SKILL}`, `${DIST}/codex/.agents/skills/${ERRORS_SKILL}`]) {
    files.push(
      { path: `${root}/SKILL.md`, content: `${errorsHead}\n${renderErrorsIndex(inputs, '')}` },
      ...errorsRefs.map(r => ({ path: `${root}/references/${r.name}`, content: r.content })),
    );
  }
  files.push(
    { path: `${DIST}/codex/.agents/skills/${ERRORS_SKILL}/agents/openai.yaml`, content: codexSidecar(errorsFrontmatter) },
    {
      path: `${DIST}/cursor/.cursor/rules/${ERRORS_SKILL}.mdc`,
      content: `---\ndescription: ${JSON.stringify(errorsFrontmatter.description)}\nglobs:\nalwaysApply: false\n---\n\n${renderErrorsIndex(inputs, `${ERRORS_SKILL}/`)}`,
    },
    ...errorsRefs.map(r => ({ path: `${DIST}/cursor/.cursor/rules/${ERRORS_SKILL}/references/${r.name}`, content: r.content })),
    { path: `${DOCS}/${ERRORS_SKILL}.md`, content: renderErrorsPage(inputs) },
  );

  files.push(
    { path: `${DIST}/agents-md/AGENTS.md`, content: renderAgentsMd(inputs, skills) },
    { path: `${DIST}/agents-md/contract/AGENTS.md`, content: renderContractAgents(inputs) },
    { path: `${DIST}/agents-md/ui/AGENTS.md`, content: renderUiAgents(inputs) },
    { path: `${DIST}/copilot/.github/copilot-instructions.md`, content: renderCopilot(inputs, skills) },
    {
      path: `${DOCS}/index.md`,
      content: [
        '# The Agoric skill pack',
        '',
        'Rendered from the skill sources in `packages/skills/src/` and the error catalogue in `packages/core/src/hints.ts`. Correctness pass by the project session against agoric-sdk at agoric-upgrade-23a; Agoric review pending.',
        '',
        ...[...skills.map(s => s.frontmatter), errorsFrontmatter].map(fm => `- [${fm.displayName}](${fm.name}.md): ${fm.shortDescription}.`),
        '',
      ].join('\n'),
    },
  );

  return harden(
    files
      .map(f => ({ path: f.path, content: f.content.endsWith('\n') ? f.content : `${f.content}\n` }))
      .sort(byPath),
  );
};
