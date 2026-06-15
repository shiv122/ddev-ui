/**
 * Latest released DDEV version tag (e.g. "v1.24.3"), or null if the network is
 * unreachable or GitHub rate-limits us. Best-effort: never throws.
 */
export async function latestDdevVersion(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch('https://api.github.com/repos/ddev/ddev/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DDevUI' },
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = (await res.json()) as { tag_name?: unknown }
    return typeof json.tag_name === 'string' ? json.tag_name : null
  } catch {
    return null
  }
}
