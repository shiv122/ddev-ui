import { useState } from 'react'
import {
  ChevronDown,
  FileCode2,
  Globe2,
  HelpCircle,
  Plus,
  Puzzle,
  Save,
  Wrench,
  X
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { DdevDescribe } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfigFile } from '@/api/hooks'
import {
  DATABASES,
  NODEJS_VERSIONS,
  PERFORMANCE_MODES,
  PHP_VERSIONS,
  WEBSERVER_TYPES
} from '@/lib/ddev-options'
import { cn } from '@/lib/utils'
import { runOperation, useProjectBusy } from '@/store/operations'

/* ---------------- minimal YAML readers (flat keys of .ddev/config.yaml) -------------- */

function yamlList(yaml: string, key: string): string[] {
  // `key: ["a", "b"]` on the same line or flow-style on the following indented line
  const flow = yaml.match(new RegExp(`^${key}:\\s*(?:\\n[ \\t]+)?\\[([^\\]]*)\\]`, 'm'))
  if (flow) {
    return flow[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  // block style: `key:\n  - a\n  - b`
  const block = yaml.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-[^\\n]*\\n?)+)`, 'm'))
  if (!block) return []
  return block[1]
    .split('\n')
    .map((line) => line.replace(/^[ \t]+-\s*/, '').trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function yamlScalar(yaml: string, key: string): string {
  const m = yaml.match(new RegExp(`^${key}:\\s*["']?([^"'\\n#]+)["']?\\s*$`, 'm'))
  return m ? m[1].trim() : ''
}

/* ---------------- PHP extension helpers ---------------- */

/** Template var so packages survive PHP version changes — ddev expands it. */
const PHP_PKG_PREFIX = 'php${DDEV_PHP_VERSION}-'

const SUGGESTED_EXTENSIONS: Array<{ ext: string; hint: string }> = [
  { ext: 'imagick', hint: 'ImageMagick image processing' },
  { ext: 'pcov', hint: 'Fast code coverage for PHPUnit' },
  { ext: 'tidy', hint: 'HTML cleanup & repair' },
  { ext: 'gmp', hint: 'Arbitrary-precision math' },
  { ext: 'ldap', hint: 'LDAP directory access' },
  { ext: 'memcached', hint: 'Memcached client' },
  { ext: 'bz2', hint: 'Bzip2 compression' },
  { ext: 'sybase', hint: 'Sybase/MSSQL legacy' }
]

/** "php${DDEV_PHP_VERSION}-pcov" / "php8.3-pcov" → "pcov"; other packages stay as-is. */
function friendlyPackageName(pkg: string): string {
  const m = pkg.match(/^php(?:\$\{DDEV_PHP_VERSION\}|\d+\.\d+)?-(.+)$/)
  return m ? m[1] : pkg
}

function toPackage(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // Bare extension name → versioned php package; anything with a dash/prefix kept verbatim.
  return /^[a-z0-9_]+$/i.test(trimmed) && !trimmed.startsWith('php')
    ? `${PHP_PKG_PREFIX}${trimmed}`
    : trimmed
}

/* ---------------- small form atoms ---------------- */

function Help({ text }: { text: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help text-muted-foreground/60 transition-colors hover:text-foreground">
          <HelpCircle className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-pretty">{text}</TooltipContent>
    </Tooltip>
  )
}

function Field({
  label,
  help,
  children,
  className
}: {
  label: string
  help: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Help text={help} />
      </div>
      {children}
    </div>
  )
}

function SettingSelect({
  value,
  options,
  onChange,
  disabled
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
}): React.JSX.Element {
  const known = options.some((o) => o.value === value)
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(known ? options : [...options, { value, label: value }]).map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ---------------- main tab ---------------- */

export function ConfigTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const configFile = useConfigFile(info.name)
  if (configFile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }
  // Re-mount the form when a fresh config arrives after an apply, so fields re-seed.
  return <ConfigForm key={configFile.data ?? 'no-config'} info={info} yaml={configFile.data ?? ''} />
}

function ConfigForm({ info, yaml }: { info: DdevDescribe; yaml: string }): React.JSX.Element {
  const busy = useProjectBusy(info.name)

  const currentDb = `${info.database_type}:${info.database_version}`
  const currentHostnames = yamlList(yaml, 'additional_hostnames').join(', ')
  const currentFqdns = yamlList(yaml, 'additional_fqdns').join(', ')
  const currentPackages = yamlList(yaml, 'webimage_extra_packages')
  const currentTld = yamlScalar(yaml, 'project_tld') || 'ddev.site'
  const currentTimezone = yamlScalar(yaml, 'timezone')
  const currentNode = info.nodejs_version || 'auto'

  const [phpVersion, setPhpVersion] = useState(info.php_version)
  const [database, setDatabase] = useState(currentDb)
  const [webserver, setWebserver] = useState(info.webserver_type)
  const [performanceMode, setPerformanceMode] = useState(info.performance_mode || 'global')
  const [nodejs, setNodejs] = useState(currentNode)
  const [docroot, setDocroot] = useState(info.docroot ?? '')
  const [hostnames, setHostnames] = useState(currentHostnames)
  const [fqdns, setFqdns] = useState(currentFqdns)
  const [tld, setTld] = useState(currentTld)
  const [timezone, setTimezone] = useState(currentTimezone)
  const [packages, setPackages] = useState<string[]>(currentPackages)
  const [customExt, setCustomExt] = useState('')
  const [restartAfter, setRestartAfter] = useState(true)
  const [showRaw, setShowRaw] = useState(false)

  const normList = (s: string): string =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .join(',')

  const addPackage = (raw: string): void => {
    const pkg = toPackage(raw)
    if (pkg && !packages.includes(pkg)) setPackages([...packages, pkg])
    setCustomExt('')
  }

  const changes = {
    ...(phpVersion !== info.php_version ? { phpVersion } : {}),
    ...(database !== currentDb ? { database } : {}),
    ...(webserver !== info.webserver_type ? { webserverType: webserver } : {}),
    ...(performanceMode !== (info.performance_mode || 'global') ? { performanceMode } : {}),
    ...(nodejs !== currentNode && nodejs ? { nodejsVersion: nodejs } : {}),
    ...(docroot !== (info.docroot ?? '') ? { docroot } : {}),
    ...(normList(hostnames) !== normList(currentHostnames)
      ? { additionalHostnames: normList(hostnames) }
      : {}),
    ...(normList(fqdns) !== normList(currentFqdns) ? { additionalFqdns: normList(fqdns) } : {}),
    ...(tld !== currentTld && tld.trim() ? { projectTld: tld.trim() } : {}),
    ...(timezone !== currentTimezone && timezone.trim() ? { timezone: timezone.trim() } : {}),
    ...(packages.join(',') !== currentPackages.join(',')
      ? { webimageExtraPackages: packages.join(',') }
      : {})
  }
  const dirty = Object.keys(changes).length > 0

  const apply = (): void => {
    void runOperation({ kind: 'update-config', project: info.name, restartAfter, flags: changes })
  }

  return (
    <div className="space-y-4 pb-2">
      {/* URLs — the everyday controls, front and center */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="size-4" /> URLs & hostnames
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[2fr_2fr_1fr]">
            <Field
              label="Additional hostnames"
              help={`Comma-separated. Each becomes <name>.${currentTld} — e.g. "api, admin" → api.${currentTld}, admin.${currentTld}. Wildcards like *.shop work. Clear the field to remove all.`}
            >
              <Input
                value={hostnames}
                onChange={(e) => setHostnames(e.target.value)}
                disabled={busy}
                placeholder="api, admin, *.shop"
              />
            </Field>
            <Field
              label="Additional FQDNs"
              help="Full custom domains served by this project, e.g. myapp.test. DDEV writes them to /etc/hosts — applying may prompt for your password."
            >
              <Input
                value={fqdns}
                onChange={(e) => setFqdns(e.target.value)}
                disabled={busy}
                placeholder="myapp.test, www.myapp.test"
              />
            </Field>
            <Field
              label="Project TLD"
              help="Default ddev.site resolves to 127.0.0.1 via public DNS, so HTTPS just works. Change only if your network blocks it."
            >
              <Input value={tld} onChange={(e) => setTld(e.target.value)} disabled={busy} />
            </Field>
          </div>
          {info.hostnames?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Routed now
              </span>
              {info.hostnames.map((h) => (
                <Badge key={h} variant="secondary" className="rounded-full font-mono text-[11px] font-normal">
                  {h}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* PHP extensions — first-class */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Puzzle className="size-4" /> PHP extensions
              <Help
                text={`Installs Debian packages into the web image (webimage_extra_packages in config.yaml). Bare names are added as php\${DDEV_PHP_VERSION}-<name> so they follow PHP version changes. Takes effect on restart — the image is rebuilt.`}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-black/20 px-2.5 py-2">
              {packages.length === 0 ? (
                <span className="text-xs text-muted-foreground">No extra packages installed</span>
              ) : (
                packages.map((pkg) => (
                  <Badge
                    key={pkg}
                    variant="secondary"
                    className="gap-1 rounded-full pl-2.5 pr-1 font-mono text-[11px] font-normal"
                    title={pkg}
                  >
                    {friendlyPackageName(pkg)}
                    <button
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                      disabled={busy}
                      onClick={() => setPackages(packages.filter((p) => p !== pkg))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Popular</Label>
                <Help text="One click to queue the extension — hit Apply below to rebuild with it." />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_EXTENSIONS.map(({ ext, hint }) => {
                  const pkg = `${PHP_PKG_PREFIX}${ext}`
                  const added = packages.includes(pkg)
                  return (
                    <Tooltip key={ext}>
                      <TooltipTrigger asChild>
                        <button
                          disabled={busy || added}
                          onClick={() => addPackage(ext)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors',
                            added
                              ? 'border-foreground/30 bg-foreground/10 text-foreground/50'
                              : 'border-border text-muted-foreground hover:border-foreground/30 hover:bg-foreground/[0.06] hover:text-foreground'
                          )}
                        >
                          {added ? ext : `+ ${ext}`}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{hint}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={customExt}
                onChange={(e) => setCustomExt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPackage(customExt)}
                disabled={busy}
                placeholder="other extension or Debian package…"
                className="font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-9 gap-1"
                disabled={busy || !customExt.trim()}
                onClick={() => addPackage(customExt)}
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Runtime */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4" /> Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="PHP version" help="Interpreter version for the web container.">
              <SettingSelect
                value={phpVersion}
                options={PHP_VERSIONS.map((v) => ({ value: v, label: `PHP ${v}` }))}
                onChange={setPhpVersion}
                disabled={busy}
              />
            </Field>
            <Field label="Node.js" help='Major ("22"), exact ("18.19.2") or "auto" to match the framework.'>
              <SettingSelect
                value={nodejs}
                options={NODEJS_VERSIONS.map((v) => ({ value: v, label: v }))}
                onChange={setNodejs}
                disabled={busy}
              />
            </Field>
            <Field label="Webserver" help="nginx-fpm (default, fastest), apache-fpm for .htaccess apps, generic for custom servers.">
              <SettingSelect value={webserver} options={WEBSERVER_TYPES} onChange={setWebserver} disabled={busy} />
            </Field>
            <Field label="Performance" help="Mutagen dramatically speeds up file I/O on macOS. Global follows your machine-wide ddev setting.">
              <SettingSelect
                value={performanceMode}
                options={PERFORMANCE_MODES}
                onChange={setPerformanceMode}
                disabled={busy}
              />
            </Field>
            <Field label="Database" help="Changing type/version requires an empty database — take a snapshot or export first; ddev refuses otherwise.">
              <SettingSelect value={database} options={DATABASES} onChange={setDatabase} disabled={busy} />
            </Field>
            <Field label="Docroot" help="Web root relative to the project folder (e.g. public, web). Empty = project root.">
              <Input
                value={docroot}
                onChange={(e) => setDocroot(e.target.value)}
                disabled={busy}
                placeholder="(project root)"
              />
            </Field>
            <Field label="Timezone" help="IANA name, e.g. Asia/Kolkata. Sets PHP and container time." className="col-span-2">
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={busy}
                placeholder="e.g. Asia/Kolkata"
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Apply bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="metal-card sticky bottom-3 z-10 flex flex-wrap items-center gap-4 rounded-xl px-4 py-3"
          >
            <span className="text-sm">
              {Object.keys(changes).length} setting{Object.keys(changes).length > 1 ? 's' : ''} changed
            </span>
            <span className="text-xs text-muted-foreground">runs `ddev config` in the project</span>
            <div className="ml-auto flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={restartAfter} onCheckedChange={setRestartAfter} disabled={busy} />
                Restart to apply
              </label>
              <Button className="sheen gap-1.5" disabled={busy} onClick={apply}>
                <Save className="size-3.5" /> Apply{restartAfter ? ' & restart' : ''}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Raw config, collapsed by default */}
      <Card className="gap-0 py-4">
        <button
          className="flex w-full items-center gap-2 px-6 text-left"
          onClick={() => setShowRaw(!showRaw)}
        >
          <FileCode2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">.ddev/config.yaml</span>
          <span className="text-xs text-muted-foreground">(read-only)</span>
          <ChevronDown
            className={`ml-auto size-4 text-muted-foreground transition-transform ${showRaw ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {showRaw && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <pre className="dark scrollbar-thin mx-6 mt-3 max-h-96 overflow-auto rounded-lg border bg-[#101010] p-3 font-mono text-xs leading-relaxed text-foreground/90">
                {yaml || 'No config.yaml found.'}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}
