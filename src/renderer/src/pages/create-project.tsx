import { useEffect, useMemo, useState } from 'react'
import {
  Bug,
  Check,
  Code2,
  Database,
  FolderOpen,
  HardDrive,
  Mail,
  Rocket,
  Search,
  Send,
  Star,
  Table2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { projectTypeIcon } from '@/components/app/project-type-icon'
import {
  DATABASES,
  NODEJS_VERSIONS,
  PHP_VERSIONS,
  PROJECT_TYPES,
  WEBSERVER_TYPES
} from '@/lib/ddev-options'
import { bundleFor, SERVICE_BY_ID, type ServiceCategory } from '@/lib/service-catalog'
import { cn } from '@/lib/utils'
import { useRouter } from '@/lib/router'
import { runOperation } from '@/store/operations'

const CATEGORY_ICON: Record<ServiceCategory, React.ComponentType<{ className?: string }>> = {
  cache: Database,
  search: Search,
  queue: Send,
  storage: HardDrive,
  dbtools: Table2,
  frontend: Code2,
  dev: Bug
}

function TypeButton({
  selected,
  onClick,
  icon: Icon,
  label
}: {
  selected: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'sheen flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-center text-[13px] transition-all',
        selected
          ? 'border-foreground/45 bg-foreground/[0.08] font-medium shadow-[inset_0_1px_0_oklch(1_0_0/0.1)]'
          : 'border-border text-muted-foreground hover:border-foreground/25 hover:bg-foreground/[0.04] hover:text-foreground'
      )}
    >
      <Icon className={cn('size-5', selected ? 'text-foreground' : 'text-muted-foreground')} />
      <span>{label}</span>
    </button>
  )
}

export function CreateProjectPage(): React.JSX.Element {
  const { navigate } = useRouter()
  const [dir, setDir] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState('php')
  const [docroot, setDocroot] = useState('')
  const [phpVersion, setPhpVersion] = useState('8.3')
  const [database, setDatabase] = useState('mariadb:10.11')
  const [webserver, setWebserver] = useState('nginx-fpm')
  const [nodejs, setNodejs] = useState('22')
  const [startAfter, setStartAfter] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Recommended add-ons for the chosen framework; reset to its defaults
  // whenever the project type changes.
  const bundle = useMemo(() => bundleFor(projectType), [projectType])
  const [addons, setAddons] = useState<Set<string>>(new Set())
  useEffect(() => {
    setAddons(new Set(bundle.filter((r) => r.recommended).map((r) => r.id)))
  }, [bundle])
  const toggleAddon = (id: string): void =>
    setAddons((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const dirName = dir?.split('/').filter(Boolean).pop() ?? ''
  const effectiveName = name.trim() || dirName
  const nameValid = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(effectiveName)
  const canSubmit = dir !== null && effectiveName.length > 0 && nameValid && !submitting

  const pickDirectory = async (): Promise<void> => {
    const selected = await window.ddev.selectDirectory({ title: 'Choose the project folder' })
    if (selected) setDir(selected)
  }

  const submit = async (): Promise<void> => {
    if (!dir || !canSubmit) return
    setSubmitting(true)
    const descriptor = await runOperation({
      kind: 'create-project',
      dir,
      name: effectiveName,
      projectType,
      docroot: docroot.trim() || undefined,
      phpVersion,
      database: database === 'none' ? undefined : database,
      webserverType: webserver,
      nodejsVersion: nodejs === 'auto' ? undefined : nodejs,
      startAfter,
      addons: addons.size > 0 ? [...addons] : undefined
    })
    setSubmitting(false)
    if (descriptor) navigate({ view: 'project', name: effectiveName })
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <div>
        <h1 className="text-metallic text-[26px] font-bold tracking-tight">New project</h1>
        <p className="text-sm text-muted-foreground">
          Configure DDEV for an existing codebase — runs <code>ddev config</code> in the folder you
          choose.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Project folder</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant="secondary" className="gap-2" onClick={() => void pickDirectory()}>
            <FolderOpen className="size-4" /> Choose folder…
          </Button>
          <span className={cn('truncate text-sm', dir ? 'text-foreground' : 'text-muted-foreground')}>
            {dir ?? 'No folder selected'}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Project type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PROJECT_TYPES.map((t) => (
              <TypeButton
                key={t.value}
                selected={projectType === t.value}
                onClick={() => setProjectType(t.value)}
                icon={projectTypeIcon(t.value)}
                label={t.label}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Project name</Label>
            <Input
              placeholder={dirName || 'my-project'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!nameValid && effectiveName.length > 0 && (
              <p className="text-xs text-destructive">Letters, numbers, dots, dashes only.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Docroot (optional)</Label>
            <Input
              placeholder="auto-detect (e.g. public, web)"
              value={docroot}
              onChange={(e) => setDocroot(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">PHP version</Label>
            <Select value={phpVersion} onValueChange={setPhpVersion}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHP_VERSIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    PHP {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Webserver</Label>
            <Select value={webserver} onValueChange={setWebserver}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEBSERVER_TYPES.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Database</Label>
            <Select value={database} onValueChange={setDatabase}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATABASES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Node.js</Label>
            <Select value={nodejs} onValueChange={setNodejs}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NODEJS_VERSIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Recommended services</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional add-ons that pair well with{' '}
            {PROJECT_TYPES.find((t) => t.value === projectType)?.label ?? projectType}. Checked ones
            install automatically after the project starts. Add or remove them later from the
            project too.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid items-stretch gap-2 sm:grid-cols-2">
            {bundle.map((rec) => {
              const svc = SERVICE_BY_ID[rec.id]
              if (!svc) return null
              const checked = addons.has(rec.id)
              const Icon = CATEGORY_ICON[svc.category]
              return (
                <button
                  type="button"
                  key={rec.id}
                  onClick={() => toggleAddon(rec.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                    checked
                      ? 'border-foreground/40 bg-foreground/[0.06] shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]'
                      : 'border-border hover:border-foreground/20 hover:bg-foreground/[0.03]'
                  )}
                >
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md border',
                      checked ? 'border-foreground/30 bg-foreground/[0.06]' : 'bg-foreground/[0.03]'
                    )}
                  >
                    <Icon
                      className={cn('size-4', checked ? 'text-foreground' : 'text-muted-foreground')}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{svc.name}</span>
                      {rec.recommended && (
                        <Badge variant="secondary" className="rounded-full text-[9px]">
                          recommended
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{rec.reason}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                      <span className="uppercase tracking-wider">
                        {svc.official ? 'official' : 'community'}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Star className="size-2.5" /> {svc.stars}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5" /> Mailpit (email capture) is built into DDEV, so it is
            always available without an add-on.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={startAfter} onCheckedChange={(c) => setStartAfter(c === true)} />
          Start the project after configuring
          {addons.size > 0 && (
            <span className="text-xs text-muted-foreground">
              (required to install {addons.size} selected service{addons.size > 1 ? 's' : ''})
            </span>
          )}
        </label>
        <Button size="lg" className="sheen gap-2" disabled={!canSubmit} onClick={() => void submit()}>
          <Rocket className="size-4" /> Create project
        </Button>
      </div>
    </div>
  )
}
