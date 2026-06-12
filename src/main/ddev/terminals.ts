import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import * as pty from 'node-pty'
import { IPC } from '@shared/ipc'
import { augmentedEnv, ddevBinary } from './binary'
import { ddevClient } from './client'

interface TerminalSession {
  pty: pty.IPty
  sender: WebContents
}

/**
 * Interactive PTY sessions running `ddev ssh` — a real shell inside a
 * project's container, streamed to the renderer's xterm.
 */
class TerminalManager {
  private sessions = new Map<string, TerminalSession>()

  async create(
    sender: WebContents,
    project: string,
    service: string,
    cols: number,
    rows: number
  ): Promise<{ id: string }> {
    const bin = ddevBinary()
    if (!bin) throw new Error('ddev binary not found on PATH')
    const approot = await ddevClient.approotFor(project)

    const id = randomUUID()
    const proc = pty.spawn(bin, ['ssh', '-s', service, project], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: approot,
      env: augmentedEnv() as Record<string, string>
    })

    proc.onData((data) => {
      if (!sender.isDestroyed()) sender.send(IPC.termData, { id, data })
    })
    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id)
      if (!sender.isDestroyed()) sender.send(IPC.termExit, { id, exitCode })
    })
    sender.once('destroyed', () => this.dispose(id))

    this.sessions.set(id, { pty: proc, sender })
    return { id }
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    if (cols > 0 && rows > 0) this.sessions.get(id)?.pty.resize(cols, rows)
  }

  dispose(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      this.sessions.delete(id)
      session.pty.kill()
    }
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) this.dispose(id)
  }
}

export const terminalManager = new TerminalManager()
