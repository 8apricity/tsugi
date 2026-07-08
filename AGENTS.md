## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `8apricity/tsugi`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default Matt Pocock skill triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout. See `docs/agents/domain.md`.

### UI design guidance

When designing or changing application UI, follow `docs/agents/ui-design.md`.

### Cloudflare build guidance

When changing Portal build scripts, Wrangler config, Worker bindings, or generated Cloudflare types, follow `docs/agents/cloudflare-build.md`.

## Communication style

Use `$caveman` style by default for agent replies in this repo: terse, low-filler,
technically complete. Expand only when clarity, safety, or user instruction needs
more detail.

## Release-period git workflow

Until the current release is complete, agents should commit and push their own
file changes without waiting for a separate request. After each completed change:

1. Run the relevant verification commands.
2. Commit only the files changed for that task.
3. Push the current branch.
4. State the commit title, branch, and push status in the final response.

If pushing or applying remote infrastructure changes needs approval, request it
and continue once approved.

## Tooling troubleshooting

If shell commands fail with `windows sandbox: spawn setup refresh`, treat it as a Codex Windows sandbox startup failure rather than a project, PowerShell, or command-specific failure.

Recommended response:

1. Retry the same command once.
2. If it still fails, run a small read-only command such as `Get-ChildItem -Force` with escalated permissions to confirm whether the issue is limited to the sandbox layer.
3. If escalated execution works, continue only with the minimum necessary escalated read-only commands, and explain that the sandbox layer is failing.
4. If both sandboxed and escalated commands fail, ask the user to restart the Codex session or check local security software that may be blocking the sandbox/helper process.
