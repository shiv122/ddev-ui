import { useState } from 'react'
import {
  SiDjango,
  SiExpress,
  SiFastapi,
  SiFlask,
  SiNextdotjs,
  SiVite
} from '@icons-pack/react-simple-icons'
import { FolderOpen, Info, Rocket } from 'lucide-react'
import { APP_TEMPLATES, findTemplate, type AppTemplate } from '@shared/templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'
import { useRouter } from '@/lib/router'
import { runOperation } from '@/store/operations'

const TEMPLATE_ICONS: Record<AppTemplate['brand'], React.ComponentType<{ className?: string }>> = {
  nextjs: SiNextdotjs,
  vite: SiVite,
  express: SiExpress,
  fastapi: SiFastapi,
  django: SiDjango,
  flask: SiFlask
}

function TypeButton({
  selected,
  onClick,
  icon: Icon,
  label,
  hint
}: {
  selected: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint?: string
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
      <span>
        {label}
        {hint && <span className="block text-[10px] font-normal text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

export function CreateProjectPage(): React.JSX.Element {
  const { navigate } = useRouter()
  const [dir, setDir] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState('php')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [docroot, setDocroot] = useState('')
  const [phpVersion, setPhpVersion] = useState('8.3')
  const [database, setDatabase] = useState('mariadb:10.11')
  const [webserver, setWebserver] = useState('nginx-fpm')
  const [nodejs, setNodejs] = useState('22')
  const [startAfter, setStartAfter] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const template = templateId ? findTemplate(templateId) : undefined
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
      template: templateId ?? undefined,
      omitDb: template !== undefined && database === 'none',
      projectType: template ? 'generic' : projectType,
      docroot: template ? undefined : docroot.trim() || undefined,
      phpVersion: template ? undefined : phpVersion,
      database: database === 'none' ? undefined : database,
      webserverType: template ? undefined : webserver,
      nodejsVersion: template?.needsNode || !template ? (nodejs === 'auto' ? undefined : nodejs) : undefined,
      startAfter
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
          <CardTitle className="text-base">2. Stack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              PHP — native ddev types
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PROJECT_TYPES.map((t) => (
                <TypeButton
                  key={t.value}
                  selected={!template && projectType === t.value}
                  onClick={() => {
                    setProjectType(t.value)
                    setTemplateId(null)
                  }}
                  icon={projectTypeIcon(t.value)}
                  label={t.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Beyond PHP — DDEV UI templates (ddev `generic` type)
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {APP_TEMPLATES.map((t) => (
                <TypeButton
                  key={t.id}
                  selected={templateId === t.id}
                  onClick={() => {
                    const deselecting = templateId === t.id
                    setTemplateId(deselecting ? null : t.id)
                    // Templates usually don't need a db; PHP CMSes always do.
                    if (deselecting && database === 'none') setDatabase('mariadb:10.11')
                    if (!deselecting) setDatabase('none')
                  }}
                  icon={TEMPLATE_ICONS[t.brand]}
                  label={t.label}
                  hint={t.hint}
                />
              ))}
            </div>
          </div>

          {template && (
            <div className="space-y-1.5 rounded-lg border border-border/70 bg-foreground/[0.03] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Info className="size-3.5 text-muted-foreground" /> What this template sets up
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                <li>
                  Writes{' '}
                  {template.files.map((f, i) => (
                    <span key={f.path}>
                      {i > 0 && ', '}
                      <code className="text-foreground/80">{f.path}</code>
                    </span>
                  ))}{' '}
                  — visible later under Advanced, safe to edit.
                </li>
                {template.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
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

          {!template && (
            <>
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
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Database</Label>
            <Select value={database} onValueChange={setDatabase}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {template && <SelectItem value="none">None — no db container</SelectItem>}
                {DATABASES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {template && database === 'none' && (
              <p className="text-[11px] text-muted-foreground">
                Skips the db container — add one later via Config if needed.
              </p>
            )}
          </div>

          {(!template || template.needsNode) && (
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
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={startAfter} onCheckedChange={(c) => setStartAfter(c === true)} />
          Start the project after configuring
        </label>
        <Button size="lg" className="sheen gap-2" disabled={!canSubmit} onClick={() => void submit()}>
          <Rocket className="size-4" /> Create {template ? `${template.label} project` : 'project'}
        </Button>
      </div>
    </div>
  )
}
