<p align="center">
  <img width="128" src="build/icon.png" alt="DDevUI logo">
</p>

<h1 align="center">DDevUI</h1>

<p align="center">
  A polished desktop app for managing <a href="https://ddev.com">DDEV</a> local development
  environments — everything the <code>ddev</code> CLI does, behind a beautifully designed UI.
</p>

<p align="center">
  Built with
  <a href="https://www.electronjs.org">Electron</a> ·
  <a href="https://react.dev">React 19</a> ·
  <a href="https://tailwindcss.com">Tailwind v4</a> ·
  <a href="https://ui.shadcn.com">shadcn/ui</a> ·
  <a href="https://animate-ui.com">Animate UI</a>
</p>

<p align="center">
  <a href="https://github.com/shiv122/ddev-ui/releases/latest"><img src="https://img.shields.io/github/v/release/shiv122/ddev-ui?style=flat-square" alt="Latest release"></a>
  <a href="https://github.com/shiv122/ddev-ui/releases"><img src="https://img.shields.io/github/downloads/shiv122/ddev-ui/total?style=flat-square" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square" alt="Platforms">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/shiv122/ddev-ui?style=flat-square" alt="License"></a>
</p>

<br />

<div align="center">
  <img src="app-ss.png" alt="DDevUI — Projects dashboard" width="900">
</div>

<br />

## Overview

**DDevUI** is a desktop app for [DDEV](https://ddev.com): every project, its status, logs,
database, add-ons and configuration in one place — no `ddev` subcommands or YAML editing required.
Start and stop projects, control individual services, monitor CPU and memory, wire projects
together, open a real shell into any container, import/export databases, manage snapshots,
install add-ons, and create new projects from a wizard — all from a single window.

It talks to DDEV exclusively through `ddev <cmd> --json-output` — no parsing of human text, no
hidden shell commands, just typed, allow-listed invocations spawned with arg arrays (never a
shell). Project lists poll in the background, and long-running commands stream their output live.

## Install

### macOS — Homebrew (recommended)

```sh
brew install --cask shiv122/tap/ddevui
```

The app opens normally, with **no Gatekeeper prompt** — the
[cask](https://github.com/shiv122/homebrew-tap) clears the download quarantine flag on install.
Update with `brew upgrade --cask ddevui`.

### Direct download

Grab the installer for your platform from the
**[latest release](https://github.com/shiv122/ddev-ui/releases/latest)**:

| Platform | File |
| --- | --- |
| **macOS** (Apple Silicon) | `ddevui-<version>-mac-arm64.dmg` |
| **macOS** (Intel) | `ddevui-<version>-mac-x64.dmg` |
| **Windows** | `ddevui-<version>-win-x64.exe` |
| **Linux** | `ddevui-<version>-linux-x86_64.AppImage` · `-linux-amd64.deb` |

> [!NOTE]
> **macOS direct download.** The builds are ad-hoc signed but **not notarized** (no Apple
> Developer ID), so a browser download triggers Gatekeeper's "could not verify" prompt. Either
> use Homebrew above (no prompt), **right-click the app → Open** and confirm (once), or clear the
> quarantine flag:
> ```sh
> xattr -dr com.apple.quarantine /Applications/DDevUI.app
> ```

## Requirements

DDevUI is a front-end for DDEV — you still need DDEV and a container runtime installed:

- **[DDEV](https://ddev.readthedocs.io/en/stable/users/install/ddev-installation/)** v1.24+
- A **Docker provider** — Docker Desktop, OrbStack, Colima, or Rancher Desktop

The built-in **Doctor** page checks all of this and tells you exactly what's missing (and lets
you point the app at a `ddev`/`docker` binary manually if it isn't on the default `PATH`).

## Features

- **Dashboard** — every project with live status, filtering and animated stats; one-click
  start / stop / restart / rename / delete / open-in-browser / Mailpit, plus a **Stop all** for
  everything that's running.
- **Project detail** — environment overview (PHP, webserver, DB, Node, Mutagen, router), all
  URLs, and a live **Xdebug toggle** that reads the real runtime state, not just the config.
- **Services** — a card per running service (db, redis, phpMyAdmin, …) with its image, status
  and endpoints; start / stop / restart, open a shell, tail logs, set CPU & memory limits, and
  view the rendered Docker Compose plus any override files.
- **Connections** — a drag-and-drop map to let one project consume another's service (database,
  cache, …). Pick a provider service and DDevUI injects the host/port env vars and restarts the
  consumer; connected projects cluster into editable groups. Built on DDEV's shared network, so
  reachability needs no extra config.
- **Resource monitoring** — live per-project CPU and memory charts, plus per-service CPU/memory
  limits you can set from the UI.
- **Database tools** — connection credentials with copy buttons, **open the database in an
  external client** (TablePlus, Sequel Ace, DBeaver), dump **import/export** via native file
  dialogs, and **snapshots** (create / restore / delete).
- **Interactive terminal** — a real shell into any service via `ddev ssh`, powered by xterm.js
  and a PTY — not a one-shot command box.
- **Logs** — stream `ddev logs` per service with follow mode.
- **Config** — UI-driven settings (PHP version, database, webserver, performance mode, URLs,
  PHP extensions, hostnames) that run `ddev config`, plus a config viewer.
- **Create-project wizard** — pick a folder and project type; DDevUI suggests a framework-aware
  bundle of add-ons (e.g. Laravel → Redis, queue, Buggregator) you can toggle, with an optional
  database. It configures the DDEV project — it doesn't scaffold application code.
- **Add-on registry** — browse the full registry (`ddev add-on list`), filter official/community,
  sort by stars. Open an add-on to see exactly which projects already have it, then install it to
  one or many at once — or remove it.
- **Advanced** — custom Docker services & compose files, Dockerfile tweaks, custom commands, TLS
  certs, Traefik config and hooks, each with clear warnings.
- **Sharing** — expose a project publicly via `ddev share` (ngrok / cloudflared), entirely
  optional and never blocking.
- **Activity** — every ddev command the app runs, with live streamed output and cancel.
- **Doctor** — checks the ddev binary, Docker CLI + daemon and mkcert; **starts your container
  runtime** (Docker Desktop, OrbStack, Colima, Rancher) when it's down and **flags when the DDEV
  CLI is behind the latest release**; runs the deep `ddev debug dockercheck`; shows the full
  `ddev version` table, and lets you point at a `ddev`/`docker` binary manually.
- **Editor** — set your preferred editor and open a project's folder in it in one click.
- **Menu bar** — a tray with live project status and quick lifecycle controls, with an optional
  **launch at login** so it's always available.
- **Light & dark themes** — monochrome, metallic design that follows a toggle; the dock and
  menu-bar icons follow along too.

## How DDevUI compares to other DDEV UIs

DDEV has a lively ecosystem of GUIs and IDE integrations — there is no single "official" desktop
app today (the original [`ddev/ddev-ui`](https://github.com/ddev/ddev-ui) is no longer
maintained). Here's an honest map of the main options and where DDevUI fits.

| Tool | Type | Platforms | Price | Best for |
| --- | --- | --- | --- | --- |
| **DDevUI** (this) | Desktop app | macOS · Windows · Linux | Free, MIT | Multi-project workflows: per-service control, cross-project connections, resource monitoring, diagnostics |
| [DDEV Manager](https://ddev-manager.github.io/) | Desktop app (Rust) | macOS · Windows · Linux | Free, MIT | A polished cross-platform alternative with app scaffolding installers and in-app auto-update |
| [ddevBar](https://klemens.ee/ddevbar/) | Menu-bar app | macOS | Free | Lightweight one-click start/stop and quick links from the menu bar |
| [DDEV-Apple-GUI](https://github.com/dave-agilepixel/DDEV-Apple-GUI) | Native app (SwiftUI) | macOS | Free, MIT | A native-Mac feel; logs, snapshots and global commands |
| [PhpStorm DDEV Integration](https://docs.ddev.com/en/stable/users/install/phpstorm/) | IDE plugin | macOS · Windows · Linux (in PhpStorm) | Paid IDE | Zero-config Xdebug and interpreters inside PhpStorm |
| [VS Code DDEV Manager](https://github.com/ddev/vscode-ddev-manager) | IDE extension | macOS · Windows · Linux (in VS Code) | Free | Driving the current project from VS Code's sidebar and command palette |

**Where DDevUI is different.** It's a standalone, cross-platform desktop app — not macOS-only and
not tied to an IDE — that leans into infrastructure visibility and multi-project work:

- **Services tab** — inspect and control individual containers and read their rendered Compose,
  rather than treating a project as one opaque unit.
- **Connections** — wire one project to another's database/cache/etc. by injecting env vars over
  DDEV's shared network. We're not aware of another GUI that does this.
- **Resource monitoring + per-service limits** — live CPU/memory charts and limits from the UI.
- **Doctor** — guided environment diagnostics when something's off.

## How it talks to DDEV

All data comes from `ddev <cmd> --json-output`, which emits NDJSON lines
(`{level, msg, time}`) where structured results carry a `raw` field. The main process
([src/main/ddev/runner.ts](src/main/ddev/runner.ts)) parses this envelope; long-running commands
stream through an operation manager ([src/main/ddev/operations.ts](src/main/ddev/operations.ts))
that broadcasts typed events to the renderer. The renderer never constructs CLI arguments — it
sends typed `OperationRequest` objects ([src/shared/types.ts](src/shared/types.ts)) and main maps
them to allow-listed invocations (spawned with arg arrays, never a shell).

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
      terminals.ts   node-pty sessions (ddev ssh) for the interactive terminal
      doctor.ts      environment checks
    tray.ts       menu-bar presence with live status + controls
    ipc.ts        ipcMain handlers (queries, ops, dialogs, openExternal)
  preload/       contextBridge: window.ddev (typed)
  renderer/src/
    api/hooks.ts       TanStack Query hooks (list polls every 5s)
    store/             useSyncExternalStore-based op store + toasts
    lib/               router (state-based), query client, theme, ddev options
    components/app/    shell, status badges, op console/dock, dialogs
    pages/             dashboard, project (overview/services/db/config/…), create,
                       addons, connections, operations, doctor, settings
```

## Development

```bash
pnpm install
pnpm dev          # from a VSCode terminal: env -u ELECTRON_RUN_AS_NODE pnpm dev
pnpm typecheck
pnpm build:mac    # or build:win / build:linux
```

Requires Node 20+ and pnpm. Releases are built and published automatically by GitHub Actions
when a `v*` tag is pushed (see [.github/workflows/release.yml](.github/workflows/release.yml)).

## License

[MIT](LICENSE) © Shivesh Tripathi
