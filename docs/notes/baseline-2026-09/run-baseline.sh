#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Release 1 D1 manual baseline: one agent run in one workspace.
#
#   run-baseline.sh <task1|task4> <claude|codex>
#
# The workspace ~/Desktop/Agoric-L1/baseline/<task>-<agent>/ must already exist
# as `git init` plus a committed package.json (see README.md). Output goes to
# docs/notes/baseline-2026-09/<task>-<agent>/.
#
# Isolation and permissions are fixed here, not chosen per run:
#   claude  -p --safe-mode --permission-mode bypassPermissions
#   codex   exec --ignore-user-config -s workspace-write
#           -c sandbox_workspace_write.network_access=true -c approval_policy="never"
# Vendor built-in defaults remain in both and differ between the agents.
set -uo pipefail

task=$1
agent=$2
cap_seconds=1800

here=$(cd "$(dirname "$0")" && pwd)
ws="$HOME/Desktop/Agoric-L1/baseline/$task-$agent"
out="$here/$task-$agent"
mkdir -p "$out"

CLAUDE_BIN="$HOME/.local/bin/claude"
CODEX_BIN="/Applications/ChatGPT.app/Contents/Resources/codex"

case $task in
  task1) prompt="Write a Zoe smart contract for Agoric that sells one kind of item for a fixed price. The price brand and amount are contract terms. A buyer offers the price and wants the item. Include ava tests that start the contract and show a successful purchase and a refused underpayment. Use the package versions already in package.json." ;;
  task4) prompt="Write an Agoric orchestration contract with one invitation. The offer handler runs an orchestration flow that creates an account on the osmosis chain and transfers the offered amount to it. If the transfer fails the funds return to the offerer. Include ava tests. Use the package versions already in package.json." ;;
  *) echo "unknown task $task" >&2; exit 2 ;;
esac

case $agent in
  claude)
    version=$("$CLAUDE_BIN" --version)
    cmd=("$CLAUDE_BIN" -p --safe-mode --permission-mode bypassPermissions
         --output-format stream-json --verbose "$prompt")
    isolation="--safe-mode"
    permissions="--permission-mode bypassPermissions (no sandbox; cwd is the workspace)"
    ;;
  codex)
    version=$("$CODEX_BIN" --version </dev/null)
    cmd=("$CODEX_BIN" exec --ignore-user-config --json
         -s workspace-write
         -c sandbox_workspace_write.network_access=true
         -c 'approval_policy="never"'
         -C "$ws"
         -o "$out/last-message.txt"
         "$prompt")
    isolation="--ignore-user-config"
    permissions="-s workspace-write, sandbox_workspace_write.network_access=true, approval_policy=never"
    ;;
  *) echo "unknown agent $agent" >&2; exit 2 ;;
esac

base=$(git -C "$ws" rev-parse HEAD)
printf '%s\n' "$prompt" > "$out/prompt.txt"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

node -e '
const [task, agent, version, isolation, permissions, ws, base, started, cap, ...cmd] = process.argv.slice(1);
process.stdout.write(JSON.stringify({ type: "baseline_header", task, agent, version, isolation,
  permissions, note: "vendor built-in defaults remain and differ between the agents",
  workspace: ws, baseCommit: base, started, capSeconds: Number(cap), argv: cmd }) + "\n");
' "$task" "$agent" "$version" "$isolation" "$permissions" "$ws" "$base" "$started" "$cap_seconds" "${cmd[@]}" \
  > "$out/transcript.jsonl"

# Own process group so the cap kills the agent and everything it spawned.
set -m
(cd "$ws" && exec "${cmd[@]}" </dev/null >> "$out/transcript.jsonl" 2> "$out/stderr.txt") &
pid=$!
set +m
( sleep "$cap_seconds"; kill -TERM -- "-$pid" 2>/dev/null && echo timeout > "$out/.timed-out" ) &
watchdog=$!
wait "$pid"
status=$?
kill "$watchdog" 2>/dev/null
finished=$(date -u +%Y-%m-%dT%H:%M:%SZ)

timed_out=false
[ -f "$out/.timed-out" ] && timed_out=true && rm "$out/.timed-out"

# Everything the agent changed relative to the setup commit, including new
# untracked files and any commits it made, minus installed dependencies.
git -C "$ws" add -A -N -- . ':!node_modules' ':!.yarn' ':!.pnp.cjs' ':!.pnp.loader.mjs' 2>/dev/null
git -C "$ws" diff "$base" -- . ':!node_modules' ':!.yarn' ':!.pnp.cjs' ':!.pnp.loader.mjs' ':!yarn.lock' > "$out/diff.patch"
git -C "$ws" status --short --untracked-files=all -- . ':!node_modules' ':!.yarn' > "$out/status.txt"

printf '{"started":"%s","finished":"%s","exitStatus":%s,"timedOut":%s}\n' \
  "$started" "$finished" "$status" "$timed_out" > "$out/run.json"
echo "$task-$agent: exit $status, timed out $timed_out, $started -> $finished"
