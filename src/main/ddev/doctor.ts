import type { DoctorCheck, DoctorReport, DdevVersionInfo } from '@shared/types'
import { ddevBinary, findBinary, resetBinaryCache } from './binary'
import { runCommand } from './runner'
import { ddevClient } from './client'

/**
 * Fast environment checks run at startup and from the Doctor page.
 * The thorough `ddev utility` diagnostics (dockercheck, tls-diagnose, …) run as
 * streamed operations instead, since they build containers / probe the network.
 */
export async function runDoctor(): Promise<DoctorReport> {
  resetBinaryCache()
  const checks: DoctorCheck[] = []

  const ddevPath = ddevBinary()
  checks.push({
    id: 'ddev-binary',
    label: 'DDEV installed',
    ok: ddevPath !== null,
    detail: ddevPath ?? 'ddev not found on PATH — install from https://ddev.com'
  })

  let versionInfo: DdevVersionInfo | null = null
  if (ddevPath) {
    try {
      versionInfo = await ddevClient.version()
      checks.push({
        id: 'ddev-version',
        label: 'DDEV version',
        ok: true,
        detail: versionInfo['DDEV version'] ?? 'unknown'
      })
    } catch (err) {
      checks.push({
        id: 'ddev-version',
        label: 'DDEV version',
        ok: false,
        detail: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const dockerPath = findBinary('docker')
  checks.push({
    id: 'docker-cli',
    label: 'Docker CLI installed',
    ok: dockerPath !== null,
    detail: dockerPath ?? 'docker CLI not found — install Docker Desktop, OrbStack or Colima'
  })

  if (dockerPath) {
    const info = await runCommand(dockerPath, ['info', '--format', '{{.ServerVersion}}'], {
      timeoutMs: 10_000
    })
    const running = info.exitCode === 0
    checks.push({
      id: 'docker-daemon',
      label: 'Docker daemon running',
      ok: running,
      detail: running
        ? `Server version ${info.output.trim()}`
        : 'Docker daemon is not responding — start your Docker provider'
    })
  } else {
    checks.push({
      id: 'docker-daemon',
      label: 'Docker daemon running',
      ok: false,
      detail: 'Skipped — docker CLI missing'
    })
  }

  // Advisory: tunnel providers for `ddev share` (optional — never blocks the app)
  const ngrokPath = findBinary('ngrok')
  const cloudflaredPath = findBinary('cloudflared')
  const tunnels = [ngrokPath && 'ngrok', cloudflaredPath && 'cloudflared'].filter(Boolean)
  checks.push({
    id: 'tunnel',
    label: 'Sharing tunnel (optional)',
    ok: tunnels.length > 0,
    detail:
      tunnels.length > 0
        ? `${tunnels.join(' + ')} available for \`ddev share\``
        : 'No tunnel provider — install ngrok or cloudflared to share projects publicly (optional)'
  })

  const mkcertPath = findBinary('mkcert')
  checks.push({
    id: 'mkcert',
    label: 'mkcert installed (trusted HTTPS)',
    ok: mkcertPath !== null,
    detail:
      mkcertPath ??
      'mkcert not found — HTTPS will show browser warnings (optional, run `mkcert -install`)'
  })

  // mkcert and tunnel providers are advisory; everything else is required.
  const ok = checks.filter((c) => c.id !== 'mkcert' && c.id !== 'tunnel').every((c) => c.ok)
  return { ok, checks, ddevPath, versionInfo }
}
