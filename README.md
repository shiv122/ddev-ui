# DDevUI

A desktop app for managing [DDEV](https://ddev.com) local development projects — everything the
`ddev` CLI does, behind a well-designed UI. Built with Electron, React 19, Tailwind v4,
shadcn/ui and [Animate UI](https://animate-ui.com).

## Features

- **Dashboard** — all projects with live status, filtering, animated stats, one-click
  start / stop / restart / open-in-browser / Mailpit.
- **Project detail** — environment overview (PHP, webserver, DB, Node, mutagen, router),
  per-service container health, all URLs, and an **Xdebug toggle**.
- **Database tools** — connection credentials with copy buttons, dump **import/export** via
  native file dialogs, **snapshots** (create / restore / delete).
- **Logs** — stream `ddev logs` per service with follow mode.
- **Run** — execute commands inside containers (`ddev exec`) and quick Composer actions.
- **Config** — quick settings (PHP version, database, webserver, performance mode) that run
  `ddev config`, plus a `.ddev/config.yaml` viewer.
- **Create project wizard** — pick a folder, project type, PHP/DB/webserver versions; runs
  `ddev config` (+ optional `ddev start`).
- **Add-on registry browser** — search the full registry (`ddev add-on list`), filter
  official/community, sort by stars, install into any project, remove installed add-ons.
- **Activity** — every ddev command run by the app, with live streamed output and cancel.
- **Doctor** — checks ddev binary, Docker CLI + daemon, mkcert; runs the deep
  `ddev debug dockercheck`; full `ddev version` table. Problems surface in the sidebar.
- **Power off** — global `ddev poweroff` from the sidebar.

## How it talks to ddev

All data comes from `ddev <cmd> --json-output`, which emits NDJSON lines
(`{level, msg, time}`) where structured results carry a `raw` field. The main process
([src/main/ddev/runner.ts](src/main/ddev/runner.ts)) parses this envelope; long-running
commands stream through an operation manager
([src/main/ddev/operations.ts](src/main/ddev/operations.ts)) that broadcasts typed events to
the renderer. The renderer never constructs CLI arguments — it sends typed
`OperationRequest` objects ([src/shared/types.ts](src/shared/types.ts)) and main maps them to
allow-listed invocations (spawn with arg arrays, never a shell).

## Architecture

```
src/
  shared/        types + IPC channel names (single contract for all layers)
  main/
    ddev/
      binary.ts      locate ddev/docker (GUI apps don't inherit shell PATH)
      runner.ts      NDJSON envelope parser, DdevError
      client.ts      typed queries: list/describe/version/add-ons/snapshots
      operations.ts  streamed long-running ops, per-project locking, cancel
      doctor.ts      environment checks
    ipc.ts        ipcMain handlers (queries, ops, dialogs, openExternal)
  preload/       contextBridge: window.ddev (typed)
  renderer/src/
    api/hooks.ts       TanStack Query hooks (list polls every 5s)
    store/operations.ts useSyncExternalStore-based op store + toasts
    lib/               router (state-based), query client, ddev option lists
    components/app/    shell, status badges, op console/dock, confirm dialog
    pages/             dashboard, project (6 tabs), create, addons, operations, doctor
```

## Development

```bash
pnpm install
pnpm dev          # if launched from a VSCode terminal: env -u ELECTRON_RUN_AS_NODE pnpm dev
pnpm typecheck
pnpm build:mac    # or build:win / build:linux
```

Requires Node 20+, pnpm, and DDEV + a Docker provider installed (the app's Doctor page will
tell you what's missing).
