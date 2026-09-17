// SPDX-License-Identifier: Apache-2.0

// The rules for the snippet corpus (RELEASE1-BRIEF.md, "What Release 1
// builds"): fifteen to twenty-five snippets, API-exact, each naming its
// upstream path and commit, each tested. This file checks the parts that are
// about the files themselves; the other tests in this directory run them.

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = join(root, '../../..');
const upstreamU23 = join(repoRoot, '../upstream/agoric-sdk-u23');
const hasUpstream = existsSync(upstreamU23);

const TOPICS = ['zoe', 'durable', 'orchestration'];
const read = path => readFileSync(path, 'utf8');

const snippets = TOPICS.flatMap(topic =>
  readdirSync(join(root, topic))
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => {
      const rel = `${topic}/${f}`;
      const text = read(join(root, rel));
      return { rel, topic, text, lines: text.split('\n'), excerpt: f.endsWith('.excerpt.js') };
    }),
);

const testTexts = readdirSync(join(root, 'test'))
  .filter(f => f.endsWith('.test.js'))
  .map(f => read(join(root, 'test', f)));
const covered = new Set(
  testTexts.flatMap(text => [...text.matchAll(/^\/\/ Covers: (.+)$/gm)].flatMap(m => m[1].split(/\s+/))),
);

/** The first line after the comment header, which ends at the first blank line. */
const bodyStart = lines => lines.indexOf('') + 1;

test('the corpus has fifteen to twenty-five snippets', t => {
  const byTopic = Object.fromEntries(TOPICS.map(topic => [topic, snippets.filter(s => s.topic === topic).length]));
  t.log(`snippets per topic: ${JSON.stringify(byTopic)}, total ${snippets.length}`);
  t.true(snippets.length >= 15 && snippets.length <= 25, `${snippets.length} snippets`);
});

test('every snippet names its upstream path and commit', t => {
  for (const { rel, lines } of snippets) {
    t.is(lines[0], '// SPDX-License-Identifier: Apache-2.0', `${rel} line 1`);
    t.regex(
      lines[1] ?? '',
      /^\/\/ Upstream: (agoric-sdk@cc25a29:packages\/orchestration\/src\/examples\/|dapp-offer-up@4ea27c5:contract\/src\/)[\w.-]+\.js/,
      `${rel} line 2`,
    );
  }
});

test('every whole-file snippet is run by a test', t => {
  for (const { rel } of snippets.filter(s => !s.excerpt)) {
    t.true(covered.has(rel), `${rel} has no test with "// Covers: ${rel}"`);
  }
});

test('offer-up is identical to examples/offer-up below its header', t => {
  const snippet = snippets.find(s => s.rel === 'zoe/offer-up.contract.js');
  const example = read(join(repoRoot, 'examples/offer-up/src/offer-up.contract.js')).split('\n');
  t.truthy(snippet);
  if (!snippet) return;
  t.deepEqual(
    snippet.lines.slice(bodyStart(snippet.lines)),
    example.slice(example.findIndex(l => l.startsWith('/**'))),
  );
});

test('orchestration snippets are identical to agoric-sdk at cc25a29, imports aside', t => {
  if (!hasUpstream) {
    t.log('upstream/agoric-sdk-u23 is absent (CI); API-exactness not checked here');
    t.pass();
    return;
  }
  for (const { rel, lines } of snippets.filter(s => s.topic === 'orchestration' && !s.excerpt)) {
    const upstreamPath = /^\/\/ Upstream: agoric-sdk@cc25a29:(\S+)$/.exec(lines[1] ?? '')?.[1];
    t.truthy(upstreamPath, rel);
    if (!upstreamPath) continue;
    // The one permitted change: relative imports of other orchestration
    // modules name the package, as the header says.
    const expected = read(join(upstreamU23, upstreamPath)).replaceAll("'../", "'@agoric/orchestration/src/");
    t.is(lines.slice(bodyStart(lines)).join('\n'), expected, `${rel} differs from upstream`);
  }
});

test('every excerpt is identical to the lines it names, in a tested snippet', t => {
  for (const { rel, lines } of snippets.filter(s => s.excerpt)) {
    const m = /^\/\/ Excerpt of: ([\w/.-]+)#L(\d+)-L(\d+), tested by (test\/[\w.-]+)$/.exec(lines[2] ?? '');
    t.truthy(m, `${rel} line 3`);
    if (!m) continue;
    const [, source, a, b, testFile] = m;
    t.true(covered.has(source), `${rel}: ${source} is not covered by a test`);
    t.true(read(join(root, testFile)).includes(`// Covers: `) && read(join(root, testFile)).includes(source), `${rel}: ${testFile} does not cover ${source}`);
    const sourceLines = read(join(root, source)).split('\n');
    const body = lines.slice(bodyStart(lines));
    t.deepEqual(body.slice(0, body.length - 1), sourceLines.slice(Number(a) - 1, Number(b)), `${rel} drifted from ${source}`);

    const up = /^\/\/ Upstream: agoric-sdk@cc25a29:(\S+)#L(\d+)-L(\d+)$/.exec(lines[1] ?? '');
    if (up && hasUpstream) {
      const upLines = read(join(upstreamU23, up[1])).replaceAll("'../", "'@agoric/orchestration/src/").split('\n');
      t.deepEqual(body.slice(0, body.length - 1), upLines.slice(Number(up[2]) - 1, Number(up[3])), `${rel} upstream range is wrong`);
    }
    const viaExample = /via (examples\/offer-up\/src\/offer-up\.contract\.js)#L(\d+)-L(\d+)$/.exec(lines[1] ?? '');
    if (viaExample) {
      const exLines = read(join(repoRoot, viaExample[1])).split('\n');
      t.deepEqual(body.slice(0, body.length - 1), exLines.slice(Number(viaExample[2]) - 1, Number(viaExample[3])), `${rel} example range is wrong`);
    }
  }
});
