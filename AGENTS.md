## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `8apricity/jikanwari`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default Matt Pocock skill triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout. See `docs/agents/domain.md`.

## Change reports

When an agent changes files in this repo, include an example commit title in the final response.

## Tooling troubleshooting

If shell commands fail with `windows sandbox: spawn setup refresh`, treat it as a Codex Windows sandbox startup failure rather than a project, PowerShell, or command-specific failure.

Recommended response:

1. Retry the same command once.
2. If it still fails, run a small read-only command such as `Get-ChildItem -Force` with escalated permissions to confirm whether the issue is limited to the sandbox layer.
3. If escalated execution works, continue only with the minimum necessary escalated read-only commands, and explain that the sandbox layer is failing.
4. If both sandboxed and escalated commands fail, ask the user to restart the Codex session or check local security software that may be blocking the sandbox/helper process.
