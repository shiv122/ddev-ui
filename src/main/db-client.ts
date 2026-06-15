import { spawn } from 'node:child_process'
import { shell } from 'electron'

/** macOS application names for `open -a <app>`. */
const MAC_APPS: Record<string, string> = {
  tableplus: 'TablePlus',
  sequelace: 'Sequel Ace',
  dbeaver: 'DBeaver'
}

/**
 * Open a database connection URI in an external client.
 *
 * On macOS a specific app can be targeted via `open -a`; otherwise (and for the
 * "default" target) we hand the URI to the OS, which routes the `mysql://` /
 * `postgres://` scheme to whatever client registered it (TablePlus, DBeaver, …).
 */
export async function openDbClient(uri: string, target?: string): Promise<void> {
  if (process.platform === 'darwin' && target && MAC_APPS[target]) {
    const app = MAC_APPS[target]
    await new Promise<void>((resolve, reject) => {
      const child = spawn('open', ['-a', app, uri], { stdio: 'ignore' })
      child.on('error', reject)
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`${app} could not be opened — is it installed?`))
      )
    })
    return
  }
  await shell.openExternal(uri)
}
