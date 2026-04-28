# Worktree Debugging

Use dedicated worktrees when the root checkout is already dirty or when debugging multiple areas in parallel.

## Layout

- Path: `.claude/worktrees/<name>`
- Branch: `worktree-<name>`
- Base ref: `HEAD` by default, overridable with `--base <ref>`

This matches the existing `window.electron.app.worktreeLabel` detection in the desktop app, so each debug build still shows its worktree label in the title bar.

## Commands

```bash
pnpm worktree:list
pnpm worktree:new -- network-spike
pnpm worktree:debug -- --dry-run
pnpm worktree:debug -- --base master
```

## Default Debug Split

- `desktop-debug`: Electron main/preload/window bootstrap issues
- `renderer-debug`: renderer, workspace, and UI interaction issues
- `service-debug`: `netior-service`, IPC, and `@netior/core` issues
- `narre-debug`: Narre runtime/provider/bridge issues
- `terminal-debug`: terminal and agent runtime issues
- `integration-debug`: cross-process startup and smoke issues

## Notes

- `pnpm worktree:list` also shows linked worktrees outside `.claude/worktrees`. This is useful when renamed or stale paths still exist in the shared git metadata.
- `pnpm worktree:debug -- --dry-run` is the safe way to preview the full debug split before creating anything.
- If a target path or branch already exists, the script skips that worktree instead of overwriting it.
