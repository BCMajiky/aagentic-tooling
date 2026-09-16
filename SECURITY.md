# Security

## Reporting a vulnerability

Report privately through GitHub's advisory form on this repository
("Security" → "Report a vulnerability"). Please do not open a public issue for
anything exploitable.

Expect an acknowledgement within three working days.

## Scope

This repository is developer tooling. It holds no keys, signs no transactions
and, in Stage 0, makes no network calls at all.

When commands that talk to a chain arrive (Release 2 and later), they read
endpoints from configuration and are read-only unless a command explicitly says
otherwise. Anything that will submit a transaction states so in its help text.

## What we care about most

- **Anything that escapes SES.** Tests run under `@endo/ses-ava`, and a report
  showing that lockdown is not actually in effect for some path is a real
  finding even if nothing exploits it yet.
- **Dependency confusion.** Packages are pinned exactly and the Endo tree is
  held by `resolutions` (see [docs/PINS.md](docs/PINS.md)). A path by which an
  unpinned or floating version reaches a build is in scope.
- **Ambient authority leaking out of entrypoints.** Modules take their
  capabilities as arguments. A module that reaches for `process`, the network or
  the filesystem on its own is a bug worth reporting.

## Telemetry

There is none. If you find code in this repository that sends data anywhere,
that is a security report, not a feature request.
