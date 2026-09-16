#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * The Hardened JS smoke job (plan §1.6).
 *
 * For every contract under `examples/`, bundle it with `@endo/bundle-source`
 * exactly as `agoric run` would, then evaluate the bundle under `lockdown()`
 * and check that it exports a callable `start`.
 *
 * This is the seed of Preflight's own test suite, and it is the only check in
 * this repository that runs contract code the way a chain does. Two classes of
 * bug only show up here:
 *
 *   - An import that no longer resolves against the pinned SDK. Bundling walks
 *     the whole module graph, so a stale deep path fails loudly instead of at
 *     deploy time. That is how `@agoric/zoe/exported.js` was caught.
 *   - Ambient authority in contract source. Under lockdown a contract cannot
 *     reach the filesystem or the network, and `Math.random` and `Date.now` are
 *     tamed. The job asserts the taming is real rather than assuming it.
 *
 * This file is an entrypoint, so it is the one place here allowed to import
 * `@endo/init` and read ambient authority.
 */
import '@endo/init/debug.js';

import bundleSource from '@endo/bundle-source';
import { importBundle } from '@endo/import-bundle';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const examplesDir = join(repoRoot, 'examples');

const json = process.argv.includes('--json');

/** Discover every example package with a `main` that looks like a contract. */
const findExamples = () => {
  const found = [];
  for (const name of readdirSync(examplesDir).sort()) {
    const dir = join(examplesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const pkgPath = join(dir, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      continue;
    }
    if (!pkg?.main) continue;
    found.push({ name: pkg.name ?? name, dir, entry: join(dir, pkg.main) });
  }
  return found;
};

/**
 * The bundle id agd would compute: sha512 of the endoZipBase64, prefixed `b1-`.
 * Recorded so a manifest's `contract.bundleId` can be checked against reality.
 */
const bundleIdOf = bundle =>
  bundle.moduleFormat === 'endoZipBase64'
    ? `b1-${createHash('sha512').update(bundle.endoZipBase64).digest('hex')}`
    : null;

const results = [];
let failed = 0;

for (const example of findExamples()) {
  const result = { name: example.name, entry: example.entry, checks: [] };
  const check = (label, ok, detail) => {
    result.checks.push({ label, ok, ...(detail ? { detail } : {}) });
    if (!ok) failed += 1;
  };

  try {
    const bundle = await bundleSource(example.entry);
    check('bundles', true);
    result.moduleFormat = bundle.moduleFormat;
    result.bundleId = bundleIdOf(bundle);
    result.bundleBytes = JSON.stringify(bundle).length;

    // Evaluate the bundle in a fresh compartment endowed exactly as SwingSet
    // endows a vat, and no more. Copied from agoric-sdk at cc25a29,
    // packages/SwingSet/src/kernel/vat-loader/manager-local.js:74-83:
    //
    //   const workerEndowments = harden({
    //     ...vatEndowments,
    //     console: makeVatConsole(makeLogMaker('vat')),
    //     // See https://github.com/Agoric/agoric-sdk/issues/9515
    //     assert: globalThis.assert,
    //     TextEncoder, TextDecoder,
    //     Base64: globalThis.Base64, URL: globalThis.URL,
    //   });
    //
    // Matching it matters in both directions. Endow less and the job fails on
    // contracts a chain would run: `assert` is a global in a vat, and Offer Up
    // destructures it. Endow more and the job stops being evidence, because a
    // contract could reach for something no vat provides and still pass.
    const namespace = await importBundle(bundle, {
      endowments: {
        console,
        assert: globalThis.assert,
        TextEncoder,
        TextDecoder,
        URL: globalThis.URL,
      },
    });

    check('exports start', typeof namespace.start === 'function');
    check(
      'start is hardened',
      typeof namespace.start !== 'function' || Object.isFrozen(namespace.start),
    );

    // Offer Up also exports `meta.customTermsShape`; anything exporting meta
    // should have hardened it.
    if (namespace.meta !== undefined) {
      check('meta is hardened', Object.isFrozen(namespace.meta));
    }
  } catch (err) {
    check('bundles and evaluates', false, err?.message ?? String(err));
  }

  results.push(result);
}

// Prove the compartment really is tamed, rather than trusting that it is. If
// SES ever stops taming these, every "no ambient authority" claim above is
// worthless and we want to know immediately.
const tamingChecks = [];
{
  const c = new Compartment();
  const evaluate = src => {
    try {
      return { ok: true, value: c.evaluate(src) };
    } catch (err) {
      return { ok: false, message: err?.message ?? String(err) };
    }
  };

  const random = evaluate('Math.random()');
  tamingChecks.push({
    label: 'Math.random is unavailable or throws in a compartment',
    ok: !random.ok || random.value === undefined,
    detail: random.ok ? `returned ${String(random.value)}` : random.message,
  });

  const now = evaluate('Date.now()');
  tamingChecks.push({
    label: 'Date.now is tamed in a compartment',
    ok: !now.ok || Number.isNaN(now.value),
    detail: now.ok ? `returned ${String(now.value)}` : now.message,
  });

  for (const name of ['process', 'require', 'globalThis.fetch']) {
    const probe = evaluate(`typeof ${name}`);
    tamingChecks.push({
      label: `${name} is unavailable in a compartment`,
      ok: !probe.ok || probe.value === 'undefined',
      detail: probe.ok ? `typeof is ${String(probe.value)}` : probe.message,
    });
  }
}
for (const c of tamingChecks) if (!c.ok) failed += 1;

if (json) {
  process.stdout.write(
    `${JSON.stringify({
      ok: failed === 0,
      code: failed === 0 ? 0 : 1,
      data: { examples: results, taming: tamingChecks },
    })}\n`,
  );
} else {
  for (const result of results) {
    process.stdout.write(`${result.name}\n`);
    if (result.bundleId) {
      process.stdout.write(`  bundleId  ${result.bundleId}\n`);
      process.stdout.write(
        `  format    ${result.moduleFormat}, ${result.bundleBytes} bytes\n`,
      );
    }
    for (const c of result.checks) {
      process.stdout.write(
        `  ${c.ok ? 'ok  ' : 'FAIL'}      ${c.label}${c.detail ? `: ${c.detail}` : ''}\n`,
      );
    }
  }
  process.stdout.write('\nSES taming\n');
  for (const c of tamingChecks) {
    process.stdout.write(
      `  ${c.ok ? 'ok  ' : 'FAIL'}      ${c.label}${c.detail ? ` (${c.detail})` : ''}\n`,
    );
  }
  process.stdout.write(
    failed === 0
      ? '\nSES smoke passed.\n'
      : `\nSES smoke FAILED: ${failed} check(s).\n`,
  );
}

process.exitCode = failed === 0 ? 0 : 1;
