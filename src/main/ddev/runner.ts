import { spawn } from 'node:child_process'
import type { DdevLogLine } from '@shared/types'
import { augmentedEnv, ddevBinary } from './binary'

export class DdevError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly lines: DdevLogLine[]
  ) {
    super(message)
    this.name = 'DdevError'
  }
}

export interface DdevJsonResult<T> {
  raw: T
  lines: DdevLogLine[]
}

function parseLine(line: string): DdevLogLine | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed?.msg === 'string' && typeof parsed?.level === 'string') {
      return parsed as DdevLogLine
    }
  } catch {
    // Non-JSON noise on stdout; ignore.
  }
  return null
}

/**
 * Run `ddev <args> --json-output` to completion and return the structured
 * `raw` payload of the last line that carries one.
 *
 * The NDJSON envelope: every stdout line is `{level, msg, time}` and lines
 * with structured data additionally have a `raw` field.
 */
export async function runDdevJson<T = unknown>(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<DdevJsonResult<T>> {
  const bin = ddevBinary()
  if (!bin) {
    throw new DdevError('ddev binary not found on PATH', null, [])
  }

  const { cwd, timeoutMs = 30_000 } = options

  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, [...args, '--json-output'], {
      cwd,
      env: augmentedEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const lines: DdevLogLine[] = []
    let raw: T | undefined
    let stdoutRest = ''
    let stderrTail = ''

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new DdevError(`ddev ${args.join(' ')} timed out after ${timeoutMs}ms`, null, lines))
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutRest += chunk.toString('utf8')
      let nl: number
      while ((nl = stdoutRest.indexOf('\n')) >= 0) {
        const line = parseLine(stdoutRest.slice(0, nl))
        stdoutRest = stdoutRest.slice(nl + 1)
        if (line) {
          lines.push(line)
          if (line.raw !== undefined) raw = line.raw as T
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4000)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new DdevError(`failed to run ddev: ${err.message}`, null, lines))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      const trailing = parseLine(stdoutRest)
      if (trailing) {
        lines.push(trailing)
        if (trailing.raw !== undefined) raw = trailing.raw as T
      }
      if (code !== 0) {
        const errMsgs = lines
          .filter((l) => l.level === 'error' || l.level === 'fatal')
          .map((l) => l.msg)
          .join('\n')
        reject(
          new DdevError(
            errMsgs || stderrTail.trim() || `ddev ${args[0]} exited with code ${code}`,
            code,
            lines
          )
        )
        return
      }
      if (raw === undefined) {
        reject(new DdevError(`ddev ${args.join(' ')} returned no structured output`, code, lines))
        return
      }
      resolvePromise({ raw, lines })
    })
  })
}

/** Run a plain (non-JSON) ddev/other command to completion, capturing output. */
export async function runCommand(
  bin: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<{ exitCode: number | null; output: string }> {
  const { cwd, timeoutMs = 60_000 } = options
  return new Promise((resolvePromise) => {
    const child = spawn(bin, args, { cwd, env: augmentedEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const append = (chunk: Buffer): void => {
      output = (output + chunk.toString('utf8')).slice(-100_000)
    }
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: null, output: `${output}\n${err.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: code, output })
    })
  })
}
