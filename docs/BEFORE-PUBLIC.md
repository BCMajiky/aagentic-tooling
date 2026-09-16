# Before this repository goes public

D4 flips the repo from private to public when the §1.8 definition of done is
met, which is day 5 of Stage 0. That flip is also when GitHub Pages is enabled,
because Pages needs a public repo on the current plan.

Work through this first. Nothing here is optional.

## 1. Move the internal planning docs out

`docs/context/` is internal working material, not documentation. It contains
the Servandum devnet notes and the plan amendments, and it names people. It is
fine in a private repo and wrong in a public one.

- [ ] Move `docs/context/` to a separate private repository, or out of git
      entirely, keeping it on disk for reference.
- [ ] Decide on `STAGE0-BRIEF.md`, which also names people and carries
      decisions that were internal. Most of what a reader needs from it is
      already restated in `docs/PINS.md`, `CONTRIBUTING.md` and the spec pages.
- [ ] Update the `docs/context/` paths in `CLAUDE.md`, which currently point at
      files that would no longer be there.
- [ ] Remember that removing a file in a later commit does not remove it from
      the history. If anything in there is genuinely sensitive, the repo needs
      its history rewritten before the flip, not after.

## 2. Move the repository to the DCFoundation org

It was created under `BCMajiky/aagentic-tooling` on day 1 because that account
is not a member of the `DCFoundation` org and repo creation there would have
failed. A GitHub transfer preserves history, issues and stars.

- [ ] Get the account added to `DCFoundation` with repo-creation rights.
- [ ] Transfer the repo.
- [ ] Update `repository.url` in the root `package.json`.
- [ ] Update the clone URL in `README.md` if one has been added by then.
- [ ] Re-point any Actions badge.

## 3. Turn on branch protection

Confirmed unavailable on day 1. Both API surfaces return the same 403 on a
private repo under a free account:

```
PUT  /repos/:owner/:repo/branches/main/protection   403
POST /repos/:owner/:repo/rulesets                   403
"Upgrade to GitHub Pro or make this repository public to enable this feature."
```

So D4's "branch protection requiring CI on `main`" cannot hold while the repo
is private, unless someone pays for Pro. Making it public is the other half of
the same sentence, which is why this lives here rather than in day 1's work.

Squash-merge-only *was* applied on day 1 and does not need redoing:
`allow_squash_merge: true`, `allow_merge_commit: false`,
`allow_rebase_merge: false`, `delete_branch_on_merge: true`.

After the flip, run:

```sh
gh api -X PUT repos/DCFoundation/aagentic-tooling/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "types", "test (node 22)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

Three contexts, not four. `test (node 24)` is deliberately absent: it runs
`continue-on-error`, so GitHub reports it as successful even when it fails, and
requiring it would gate on a check that can never go red.

The context names are the CI jobs' `name:` fields. If a job is renamed or the
Node matrix changes, this list has to change with it or `main` will block on a
check that never reports.

- [ ] `main` requires those three CI contexts.
- [ ] Confirm the settings actually took, by reading them back rather than
      trusting the API's success response.

## 4. Check what the licence and NOTICE now have to cover

By day 5 `examples/` holds code derived from `dapp-offer-up` and `agoric-sdk`.

- [ ] Every source file has its SPDX header.
- [ ] Every derived file names its upstream source file and pinned commit.
- [ ] `NOTICE` lists every upstream repo actually drawn from, at the commit
      actually used.

## 5. Last look

- [ ] No credentials, endpoints or wallet addresses in the tree or in the
      history. `networks.json` holds public endpoints only.
- [ ] No telemetry, and the README still says so.
- [ ] `yarn install && yarn ci` passes from a fresh clone, on Node 22 and 24.
- [ ] A stranger can clone, run one command, and see the CLI respond — that is
      the first line of the §1.8 definition of done, and it is worth actually
      trying from an empty directory rather than assuming.
