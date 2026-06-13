import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  OperationDescriptor,
  OperationEvent,
  OperationLine,
  OperationRequest,
  OperationStatus
} from '@shared/types'
import { augmentedEnv, ddevBinary } from './binary'
import { ddevClient } from './client'
import { writeResourceLimits } from './resources'
import { materializeTemplate } from './templates'

interface OperationStep {
  args: string[]
  cwd?: string
  /** Append --json-output and parse lines into level/msg pairs. */
  json: boolean
}

interface OperationPlan {
  title: string
  steps: OperationStep[]
  /** Key used to prevent concurrent mutations of the same project. */
  lock: string | null
}

const MAX_BUFFER_LINES = 5000

/** Tokenize a user-supplied argument string, honoring simple quoting. */
function splitArgs(input: string): string[] {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return matches.map((m) =>
    (m.startsWith('"') && m.endsWith('"')) || (m.startsWith("'") && m.endsWith("'"))
      ? m.slice(1, -1)
      : m
  )
}

async function buildPlan(req: OperationRequest): Promise<OperationPlan> {
  const approot = async (project: string): Promise<string> => ddevClient.approotFor(project)

  switch (req.kind) {
    case 'start':
      return {
        title: `Start ${req.project}`,
        steps: [{ args: ['start', '-y', req.project], json: true }],
        lock: req.project
      }
    case 'stop':
      return {
        title: `Stop ${req.project}`,
        steps: [{ args: ['stop', req.project], json: true }],
        lock: req.project
      }
    case 'restart':
      return {
        title: `Restart ${req.project}`,
        steps: [{ args: ['restart', req.project], json: true }],
        lock: req.project
      }
    case 'delete':
      return {
        title: `Delete ${req.project}`,
        steps: [
          {
            args: ['delete', '--yes', ...(req.omitSnapshot ? ['--omit-snapshot'] : []), req.project],
            json: true
          }
        ],
        lock: req.project
      }
    case 'unlist':
      return {
        title: `Unlist ${req.project}`,
        steps: [{ args: ['stop', '--unlist', req.project], json: true }],
        lock: req.project
      }
    case 'poweroff':
      return {
        title: 'Power off DDEV',
        steps: [{ args: ['poweroff'], json: true }],
        lock: 'global'
      }
    case 'xdebug':
      return {
        title: `Xdebug ${req.enable ? 'on' : 'off'} — ${req.project}`,
        steps: [{ args: ['xdebug', req.enable ? 'on' : 'off'], cwd: await approot(req.project), json: true }],
        lock: req.project
      }
    case 'snapshot-create':
      return {
        title: `Snapshot ${req.project}`,
        steps: [
          {
            args: ['snapshot', ...(req.name ? ['--name', req.name] : []), req.project],
            json: true
          }
        ],
        lock: req.project
      }
    case 'snapshot-restore':
      return {
        title: `Restore snapshot — ${req.project}`,
        steps: [
          { args: ['snapshot', 'restore', req.snapshot], cwd: await approot(req.project), json: true }
        ],
        lock: req.project
      }
    case 'snapshot-cleanup':
      return {
        title: `Delete all snapshots — ${req.project}`,
        steps: [
          { args: ['snapshot', '--cleanup', '--yes'], cwd: await approot(req.project), json: true }
        ],
        lock: req.project
      }
    case 'import-db':
      return {
        title: `Import database — ${req.project}`,
        steps: [
          {
            args: [
              'import-db',
              '-f',
              req.file,
              ...(req.targetDb ? ['-d', req.targetDb] : []),
              ...(req.noDrop ? ['--no-drop'] : [])
            ],
            cwd: await approot(req.project),
            json: true
          }
        ],
        lock: req.project
      }
    case 'export-db':
      return {
        title: `Export database — ${req.project}`,
        steps: [
          {
            args: ['export-db', '-f', req.file, ...(req.sourceDb ? ['-d', req.sourceDb] : [])],
            cwd: await approot(req.project),
            json: true
          }
        ],
        lock: req.project
      }
    case 'addon-install':
      return {
        title: `Install add-on ${req.addon}`,
        steps: [
          {
            args: ['add-on', 'get', req.addon, ...(req.version ? ['--version', req.version] : [])],
            cwd: await approot(req.project),
            json: true
          }
        ],
        lock: req.project
      }
    case 'addon-remove':
      return {
        title: `Remove add-on ${req.addon}`,
        steps: [
          { args: ['add-on', 'remove', req.addon], cwd: await approot(req.project), json: true }
        ],
        lock: req.project
      }
    case 'create-project': {
      // App templates ride on the `generic` type: write our config.<id>.yaml
      // override + extra files first, then let ddev config create the base.
      if (req.template) await materializeTemplate(req.dir, req.template)
      const configArgs = req.template
        ? [
            'config',
            '--project-name',
            req.name,
            '--project-type=generic',
            '--webserver-type=generic',
            ...(req.omitDb ? ['--omit-containers=db'] : req.database ? ['--database', req.database] : []),
            ...(req.nodejsVersion ? ['--nodejs-version', req.nodejsVersion] : [])
          ]
        : [
            'config',
            '--project-name',
            req.name,
            '--project-type',
            req.projectType,
            ...(req.docroot ? ['--docroot', req.docroot] : []),
            ...(req.phpVersion ? ['--php-version', req.phpVersion] : []),
            ...(req.database ? ['--database', req.database] : []),
            ...(req.webserverType ? ['--webserver-type', req.webserverType] : []),
            ...(req.nodejsVersion ? ['--nodejs-version', req.nodejsVersion] : [])
          ]
      const steps: OperationStep[] = [{ args: configArgs, cwd: req.dir, json: true }]
      if (req.startAfter) steps.push({ args: ['start', '-y'], cwd: req.dir, json: true })
      return { title: `Create project ${req.name}`, steps, lock: req.name }
    }
    case 'update-config': {
      const f = req.flags
      // `=` syntax so empty values can clear list options (e.g. --additional-hostnames=)
      const args = [
        'config',
        ...(f.projectType ? [`--project-type=${f.projectType}`] : []),
        ...(f.docroot !== undefined ? [`--docroot=${f.docroot}`] : []),
        ...(f.phpVersion ? [`--php-version=${f.phpVersion}`] : []),
        ...(f.database ? [`--database=${f.database}`] : []),
        ...(f.webserverType ? [`--webserver-type=${f.webserverType}`] : []),
        ...(f.nodejsVersion ? [`--nodejs-version=${f.nodejsVersion}`] : []),
        ...(f.performanceMode ? [`--performance-mode=${f.performanceMode}`] : []),
        ...(f.timezone ? [`--timezone=${f.timezone}`] : []),
        ...(f.additionalHostnames !== undefined
          ? [`--additional-hostnames=${f.additionalHostnames}`]
          : []),
        ...(f.additionalFqdns !== undefined ? [`--additional-fqdns=${f.additionalFqdns}`] : []),
        ...(f.projectTld ? [`--project-tld=${f.projectTld}`] : []),
        ...(f.webimageExtraPackages !== undefined
          ? [`--webimage-extra-packages=${f.webimageExtraPackages}`]
          : [])
      ]
      const cwd = await approot(req.project)
      const steps: OperationStep[] = [{ args, cwd, json: true }]
      if (req.restartAfter) steps.push({ args: ['restart', req.project], json: true })
      return {
        title: `Update config — ${req.project}`,
        steps,
        lock: req.project
      }
    }
    case 'logs':
      return {
        title: `Logs (${req.service}) — ${req.project}`,
        steps: [
          {
            args: [
              'logs',
              '-s',
              req.service,
              '--tail',
              String(req.tail),
              ...(req.follow ? ['-f'] : [])
            ],
            cwd: await approot(req.project),
            json: false
          }
        ],
        lock: null
      }
    case 'exec': {
      const shell = req.service === 'web' ? 'bash' : 'sh'
      return {
        title: `Exec in ${req.service} — ${req.project}`,
        steps: [
          {
            args: ['exec', '-s', req.service, '--', shell, '-c', req.command],
            cwd: await approot(req.project),
            json: false
          }
        ],
        lock: null
      }
    }
    case 'composer':
      return {
        title: `composer ${req.args} — ${req.project}`,
        steps: [
          { args: ['composer', ...splitArgs(req.args)], cwd: await approot(req.project), json: false }
        ],
        lock: null
      }
    case 'share':
      return {
        title: `Share ${req.project}`,
        steps: [
          {
            args: [
              'share',
              ...(req.provider ? [`--provider=${req.provider}`] : []),
              ...(req.providerArgs ? ['--provider-args', req.providerArgs] : []),
              req.project
            ],
            json: false
          }
        ],
        lock: null
      }
    case 'diagnose': {
      // `ddev utility <target>` — read-only diagnostics, streamed as text.
      // Run inside the project dir when one is given so project-aware checks
      // (tls, ports, mutagen, xdebug) have context.
      const cwd = req.project ? await approot(req.project) : undefined
      return {
        title: `Diagnose — ${req.target}`,
        steps: [{ args: ['utility', req.target], cwd, json: false }],
        lock: null
      }
    }
    case 'clean-images':
      return {
        title: 'Remove unused DDEV images',
        steps: [{ args: ['delete', 'images', '--yes'], json: true }],
        lock: 'global'
      }
    case 'debug-rebuild':
      return {
        title: `Rebuild ${req.service} image — ${req.project}`,
        steps: [
          {
            args: ['debug', 'rebuild', '--service', req.service],
            cwd: await approot(req.project),
            json: true
          }
        ],
        lock: req.project
      }
    case 'mutagen-reset':
      return {
        title: `Reset Mutagen — ${req.project}`,
        steps: [{ args: ['mutagen', 'reset', req.project], json: true }],
        lock: req.project
      }
    case 'custom-command': {
      // Custom commands are invoked like built-ins: `ddev <name>`.
      const name = req.command.replace(/[^a-zA-Z0-9._-]/g, '')
      if (!name) throw new Error('Invalid custom command name')
      return {
        title: `ddev ${name} — ${req.project}`,
        steps: [{ args: [name], cwd: await approot(req.project), json: false }],
        lock: null
      }
    }
    case 'global-config': {
      const f = req.flags
      const args = [
        'config',
        'global',
        ...(f.performanceMode ? [`--performance-mode=${f.performanceMode}`] : []),
        ...(f.instrumentationOptIn !== undefined
          ? [`--instrumentation-opt-in=${f.instrumentationOptIn}`]
          : []),
        ...(f.routerHttpPort ? [`--router-http-port=${f.routerHttpPort}`] : []),
        ...(f.routerHttpsPort ? [`--router-https-port=${f.routerHttpsPort}`] : [])
      ]
      return {
        title: 'Update global settings',
        steps: [{ args, json: true }],
        lock: 'global'
      }
    }
    case 'set-resource-limits': {
      // ddev has no per-service limit flag — write a managed compose override,
      // then restart so the new limits take effect.
      const root = await approot(req.project)
      await writeResourceLimits(root, req.limits)
      const steps: OperationStep[] = req.restartAfter
        ? [{ args: ['restart', req.project], json: true }]
        : []
      return { title: `Apply resource limits — ${req.project}`, steps, lock: req.project }
    }
  }
}

interface RunningOperation {
  descriptor: OperationDescriptor
  buffer: OperationLine[]
  child: ChildProcess | null
  cancelled: boolean
}

class OperationManager {
  private ops = new Map<string, RunningOperation>()
  private locks = new Map<string, string>()

  async run(req: OperationRequest): Promise<OperationDescriptor> {
    const bin = ddevBinary()
    if (!bin) throw new Error('ddev binary not found on PATH')

    const plan = await buildPlan(req)
    if (plan.lock && this.locks.has(plan.lock)) {
      throw new Error(`Another operation is already running for "${plan.lock}"`)
    }

    const id = randomUUID()
    const descriptor: OperationDescriptor = {
      id,
      request: req,
      title: plan.title,
      command: plan.steps.map((s) => `ddev ${s.args.join(' ')}`).join(' && '),
      status: 'running',
      startedAt: Date.now()
    }
    const op: RunningOperation = { descriptor, buffer: [], child: null, cancelled: false }
    this.ops.set(id, op)
    if (plan.lock) this.locks.set(plan.lock, id)

    void this.execute(bin, op, plan)
    return descriptor
  }

  cancel(id: string): void {
    const op = this.ops.get(id)
    if (!op || op.descriptor.status !== 'running') return
    op.cancelled = true
    op.child?.kill('SIGTERM')
  }

  list(): OperationDescriptor[] {
    return [...this.ops.values()].map((op) => op.descriptor).sort((a, b) => b.startedAt - a.startedAt)
  }

  buffer(id: string): OperationLine[] {
    return this.ops.get(id)?.buffer ?? []
  }

  private async execute(bin: string, op: RunningOperation, plan: OperationPlan): Promise<void> {
    let exitCode: number | null = 0
    let failed = false

    for (const step of plan.steps) {
      if (op.cancelled) break
      this.emitLine(op, { level: 'info', text: `$ ddev ${step.args.join(' ')}` })
      exitCode = await this.runStep(bin, op, step)
      if (op.cancelled || exitCode !== 0) {
        failed = !op.cancelled
        break
      }
    }

    const status: OperationStatus = op.cancelled ? 'cancelled' : failed ? 'failed' : 'succeeded'
    op.descriptor.status = status
    if (plan.lock && this.locks.get(plan.lock) === op.descriptor.id) {
      this.locks.delete(plan.lock)
    }
    this.broadcast({ id: op.descriptor.id, type: 'status', status, exitCode })
  }

  private runStep(bin: string, op: RunningOperation, step: OperationStep): Promise<number | null> {
    return new Promise((resolvePromise) => {
      const args = step.json ? [...step.args, '--json-output'] : step.args
      const child = spawn(bin, args, {
        cwd: step.cwd,
        env: augmentedEnv(),
        stdio: ['ignore', 'pipe', 'pipe']
      })
      op.child = child

      let stdoutRest = ''
      let stderrRest = ''

      const handleStdoutLine = (text: string): void => {
        if (!text.trim()) return
        if (step.json) {
          try {
            const parsed = JSON.parse(text)
            if (typeof parsed?.msg === 'string') {
              const msg = parsed.msg.trim()
              if (msg) this.emitLine(op, { level: parsed.level ?? 'info', text: msg })
              return
            }
          } catch {
            // fall through to raw output
          }
        }
        this.emitLine(op, { level: 'stdout', text })
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutRest += chunk.toString('utf8')
        let nl: number
        while ((nl = stdoutRest.indexOf('\n')) >= 0) {
          handleStdoutLine(stdoutRest.slice(0, nl))
          stdoutRest = stdoutRest.slice(nl + 1)
        }
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrRest += chunk.toString('utf8')
        let nl: number
        while ((nl = stderrRest.indexOf('\n')) >= 0) {
          const text = stderrRest.slice(0, nl)
          stderrRest = stderrRest.slice(nl + 1)
          if (text.trim()) this.emitLine(op, { level: 'stderr', text })
        }
      })
      child.on('error', (err) => {
        this.emitLine(op, { level: 'error', text: err.message })
        resolvePromise(1)
      })
      child.on('close', (code) => {
        if (stdoutRest.trim()) handleStdoutLine(stdoutRest)
        if (stderrRest.trim()) this.emitLine(op, { level: 'stderr', text: stderrRest })
        op.child = null
        resolvePromise(code)
      })
    })
  }

  private emitLine(op: RunningOperation, line: OperationLine): void {
    op.buffer.push(line)
    if (op.buffer.length > MAX_BUFFER_LINES) op.buffer.splice(0, op.buffer.length - MAX_BUFFER_LINES)
    this.broadcast({ id: op.descriptor.id, type: 'line', line })
  }

  private broadcast(event: OperationEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.opEvent, event)
    }
  }
}

export const operationManager = new OperationManager()
