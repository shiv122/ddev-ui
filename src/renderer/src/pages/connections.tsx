import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type XYPosition
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'
import { Waypoints, X } from 'lucide-react'
import type { ProjectGraphNode, ProjectLink } from '@shared/types'
import { projectTypeIcon } from '@/components/app/project-type-icon'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { useProjectsGraph } from '@/api/hooks'
import { cn } from '@/lib/utils'
import { runOperation } from '@/store/operations'

const NODE_W = 230
const DRAG_MIME = 'application/ddevui-project'

interface ProjectNodeData extends Record<string, unknown> {
  name: string
  type: string
  status: string
  services: string[]
}
interface GroupNodeData extends Record<string, unknown> {
  count: number
}
type ProjectFlowNode = Node<ProjectNodeData, 'project'>
type GroupFlowNode = Node<GroupNodeData, 'group'>
type FlowNode = ProjectFlowNode | GroupFlowNode

function sanitizePrefix(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function linkEdgeId(l: Pick<ProjectLink, 'from' | 'to' | 'service'>): string {
  return `${l.from}->${l.to}:${l.service}`
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/** Undirected connected components of the link graph (each has >= 2 projects). */
function connectedComponents(links: ProjectLink[]): string[][] {
  const adj = new Map<string, Set<string>>()
  const touch = (a: string): Set<string> => {
    let s = adj.get(a)
    if (!s) {
      s = new Set()
      adj.set(a, s)
    }
    return s
  }
  for (const l of links) {
    touch(l.from).add(l.to)
    touch(l.to).add(l.from)
  }
  const seen = new Set<string>()
  const comps: string[][] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const stack = [start]
    const comp: string[] = []
    while (stack.length) {
      const cur = stack.pop() as string
      if (seen.has(cur)) continue
      seen.add(cur)
      comp.push(cur)
      for (const nb of adj.get(cur) ?? []) if (!seen.has(nb)) stack.push(nb)
    }
    comps.push(comp.sort())
  }
  return comps
}

/** Stable id derived from membership so positions survive refetches. */
function groupIdFor(members: string[]): string {
  return `group:${[...members].sort().join('|')}`
}

function estNodeHeight(services: string[]): number {
  return 40 + Math.max(1, services.length) * 24 + 14
}

const PER_ROW = 3
const COL_GAP = 56
const ROW_GAP = 36
const PAD = 18
const PAD_TOP = 34

function layoutGroup(
  members: string[],
  byName: Map<string, ProjectGraphNode>
): { width: number; height: number; positions: Map<string, XYPosition> } {
  const positions = new Map<string, XYPosition>()
  const rows = chunk(members, PER_ROW)
  let y = PAD_TOP
  for (const row of rows) {
    let rowH = 0
    row.forEach((m, c) => {
      positions.set(m, { x: PAD + c * (NODE_W + COL_GAP), y })
      rowH = Math.max(rowH, estNodeHeight(byName.get(m)?.services ?? []))
    })
    y += rowH + ROW_GAP
  }
  const cols = Math.min(PER_ROW, members.length)
  const width = PAD * 2 + cols * NODE_W + (cols - 1) * COL_GAP
  const height = y - ROW_GAP + PAD
  return { width, height, positions }
}

function buildEdges(links: ProjectLink[]): Edge[] {
  return links.map((l) => ({
    id: linkEdgeId(l),
    source: l.from,
    target: l.to,
    targetHandle: l.service,
    sourceHandle: 'out',
    label: l.envPrefix,
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: 'var(--primary)' },
    labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
    data: { link: l }
  }))
}

/** A project as a node: a source handle (as consumer) + a target handle per service. */
function ProjectNode({ data, selected }: NodeProps<ProjectFlowNode>): React.JSX.Element {
  const Icon = projectTypeIcon(data.type)
  const running = data.status === 'running'
  return (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-md transition-shadow',
        selected ? 'border-primary ring-1 ring-primary/40' : 'border-border'
      )}
      style={{ width: NODE_W }}
    >
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!size-3 !border-2 !border-background !bg-primary"
      />
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Icon className="size-4 text-foreground/80" />
        <span className="truncate text-sm font-semibold">{data.name}</span>
        <span
          className={cn('ml-auto size-2 rounded-full', running ? 'bg-success' : 'bg-muted-foreground/40')}
          title={data.status}
        />
      </div>
      {data.services.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">
          {running ? 'No shareable services' : 'Start to detect services'}
        </div>
      ) : (
        <div className="py-1">
          {data.services.map((svc) => (
            <div
              key={svc}
              className="relative flex items-center px-3 py-1 text-xs text-muted-foreground"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={svc}
                className="!size-2.5 !border-2 !border-background !bg-foreground/60"
              />
              <span className="font-mono">{svc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Bounding container for a connected set of projects. Selectable + draggable as a unit. */
function GroupNode({ data, selected }: NodeProps<GroupFlowNode>): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative h-full w-full rounded-2xl border-2 border-dashed transition-colors',
        selected ? 'border-primary/70 bg-primary/[0.05]' : 'border-border bg-foreground/[0.02]'
      )}
    >
      <div className="absolute -top-2.5 left-3 flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Waypoints className="size-3" /> {data.count} connected
      </div>
    </div>
  )
}

const nodeTypes = { project: ProjectNode, group: GroupNode }

function ConnectionsCanvas(): React.JSX.Element {
  const graph = useProjectsGraph()
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  // Projects the user dragged onto the canvas that aren't part of a link yet.
  const [freeNodes, setFreeNodes] = useState<Map<string, XYPosition>>(() => new Map())
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const links = useMemo(() => graph.data?.links ?? [], [graph.data])
  const graphNodes = useMemo(() => graph.data?.nodes ?? [], [graph.data])
  const byName = useMemo(() => new Map(graphNodes.map((n) => [n.name, n])), [graphNodes])

  const comps = useMemo(() => connectedComponents(links), [links])
  const groupedNames = useMemo(() => new Set(comps.flat()), [comps])
  const onCanvas = useMemo(
    () => new Set<string>([...groupedNames, ...freeNodes.keys()]),
    [groupedNames, freeNodes]
  )

  // Only rebuild the canvas structure when membership/services/links actually change,
  // so the 8s background refetch doesn't reset what the user has arranged.
  const signature = useMemo(
    () =>
      JSON.stringify({
        n: graphNodes.map((n) => [n.name, n.status, n.services]),
        l: links.map((l) => [l.from, l.to, l.service]),
        f: [...freeNodes.keys()].sort()
      }),
    [graphNodes, links, freeNodes]
  )

  const dataRef = useRef({ links, byName, freeNodes, comps, groupedNames })
  dataRef.current = { links, byName, freeNodes, comps, groupedNames }

  // Gate on a stable flag, not graph.data: its reference changes every refetch,
  // which would re-run the rebuild (and reset the layout) on every poll.
  const hasData = !!graph.data
  useEffect(() => {
    if (!hasData) return
    const { links, byName, freeNodes, comps, groupedNames } = dataRef.current

    const next: FlowNode[] = []
    let groupY = 0
    for (const members of comps) {
      const id = groupIdFor(members)
      const { width, height, positions } = layoutGroup(members, byName)
      next.push({
        id,
        type: 'group',
        position: { x: 0, y: groupY },
        data: { count: members.length },
        style: { width, height },
        selectable: true,
        draggable: true
      })
      for (const m of members) {
        const gn = byName.get(m)
        next.push({
          id: m,
          type: 'project',
          parentId: id,
          extent: 'parent',
          draggable: false,
          selectable: true,
          position: positions.get(m) as XYPosition,
          data: {
            name: m,
            type: gn?.type ?? 'php',
            status: gn?.status ?? 'unknown',
            services: gn?.services ?? []
          }
        })
      }
      groupY += height + 70
    }

    for (const [name, pos] of freeNodes) {
      if (groupedNames.has(name)) continue
      const gn = byName.get(name)
      if (!gn) continue
      next.push({
        id: name,
        type: 'project',
        draggable: true,
        selectable: true,
        position: pos,
        data: { name, type: gn.type, status: gn.status, services: gn.services }
      })
    }

    setNodes((prev) => {
      const prevPos = new Map(prev.map((p) => [p.id, p.position]))
      const prevParent = new Map(prev.map((p) => [p.id, p.parentId]))
      // Preserve dragged positions for groups and free nodes (members auto-layout).
      return next.map((n) => {
        if (n.type === 'group' || !n.parentId) {
          const keep = prevPos.get(n.id)
          if (keep && prevParent.get(n.id) === n.parentId) return { ...n, position: keep }
        }
        return n
      })
    })
    setEdges(buildEdges(links))

    // Drop placed projects that have since become part of a group.
    let pruned = false
    const nf = new Map(freeNodes)
    for (const k of [...nf.keys()]) {
      if (groupedNames.has(k)) {
        nf.delete(k)
        pruned = true
      }
    }
    if (pruned) setFreeNodes(nf)
  }, [signature, hasData, setNodes, setEdges])

  const persist = useCallback((consumer: string, nextLinks: ProjectLink[]) => {
    void runOperation({ kind: 'set-links', project: consumer, links: nextLinks, restartAfter: true })
  }, [])

  const onConnect = useCallback(
    (params: Connection) => {
      const from = params.source
      const to = params.target
      const service = params.targetHandle
      if (!from || !to || !service) return
      if (from === to) {
        toast.error('A project cannot link to itself')
        return
      }
      if (links.some((l) => l.from === from && l.to === to && l.service === service)) {
        toast.info('That connection already exists')
        return
      }
      const newLink: ProjectLink = {
        from,
        to,
        service,
        envPrefix: sanitizePrefix(`${to}_${service}`),
        host: `ddev-${to}-${service}`
      }
      setEdges((eds) => addEdge(buildEdges([newLink])[0], eds))
      persist(from, [...links.filter((l) => l.from === from), newLink])
      toast.success(`${from} → ${to}/${service}`, {
        description: `Injecting ${newLink.envPrefix}_HOST into ${from}, then restarting it.`
      })
    },
    [links, persist, setEdges]
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const consumers = new Set<string>()
      for (const e of deleted) {
        const l = (e.data as { link?: ProjectLink } | undefined)?.link
        if (l) consumers.add(l.from)
      }
      for (const consumer of consumers) {
        persist(
          consumer,
          links.filter(
            (l) => l.from === consumer && !deleted.some((e) => e.id === linkEdgeId(l))
          )
        )
      }
    },
    [links, persist]
  )

  const removeLink = useCallback(
    (l: ProjectLink) => {
      persist(
        l.from,
        links.filter((x) => x.from === l.from && !(x.to === l.to && x.service === l.service))
      )
    },
    [links, persist]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const name = e.dataTransfer.getData(DRAG_MIME)
      if (!name || onCanvas.has(name)) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setFreeNodes((prev) => new Map(prev).set(name, position))
    },
    [onCanvas, screenToFlowPosition]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowNode) => {
    if (node.type === 'group') setSelectedGroupId(node.id)
    else if (node.parentId) setSelectedGroupId(node.parentId)
    else setSelectedGroupId(null)
  }, [])

  // The selected group's members + the links that live inside it.
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null
    const members = comps.find((m) => groupIdFor(m) === selectedGroupId)
    if (!members) return null
    const set = new Set(members)
    return { members, links: links.filter((l) => set.has(l.from) && set.has(l.to)) }
  }, [selectedGroupId, comps, links])

  const disconnectGroup = useCallback(() => {
    if (!selectedGroup) return
    // A component is maximal, so every link from a member consumer is internal: clear each.
    for (const consumer of new Set(selectedGroup.links.map((l) => l.from))) persist(consumer, [])
    setSelectedGroupId(null)
  }, [selectedGroup, persist])

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/80">
            Drag onto the canvas, then wire its right handle to another project&apos;s service.
          </p>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {graphNodes.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">No projects yet.</p>
          )}
          {graphNodes.map((n) => {
            const placed = onCanvas.has(n.name)
            const Icon = projectTypeIcon(n.type)
            return (
              <div
                key={n.name}
                draggable={!placed}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, n.name)
                  e.dataTransfer.setData('text/plain', n.name)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm',
                  placed
                    ? 'cursor-not-allowed opacity-40'
                    : 'cursor-grab hover:border-border hover:bg-foreground/[0.04] active:cursor-grabbing'
                )}
              >
                <Icon className="size-4 shrink-0 text-foreground/70" />
                <span className="truncate">{n.name}</span>
                {placed ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">on canvas</span>
                ) : (
                  <span
                    className={cn(
                      'ml-auto size-2 shrink-0 rounded-full',
                      n.status === 'running' ? 'bg-success' : 'bg-muted-foreground/40'
                    )}
                    title={n.status}
                  />
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <div className="relative min-h-0 flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedGroupId(null)}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />

          {selectedGroup && (
            <Panel
              position="top-right"
              className="w-72 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Connected group</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setSelectedGroupId(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedGroup.members.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border bg-foreground/[0.04] px-2 py-0.5 text-[11px]"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Links
                </p>
                {selectedGroup.links.map((l) => (
                  <div
                    key={linkEdgeId(l)}
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {l.from} → {l.to}/{l.service}
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {l.envPrefix}_HOST
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove this link"
                      onClick={() => removeLink(l)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <ConfirmDialog
                title="Disconnect this group?"
                description="Removes every link between these projects and restarts the affected ones."
                confirmLabel="Disconnect all"
                destructive
                onConfirm={disconnectGroup}
                trigger={
                  <Button variant="outline" size="sm" className="mt-3 w-full text-destructive">
                    Disconnect all
                  </Button>
                }
              />
            </Panel>
          )}
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {graphNodes.length === 0
                ? 'No projects yet. Create one to start wiring connections.'
                : 'Drag a project from the left onto the canvas, then connect it to another project to form a group.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ConnectionsPage(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-metallic flex items-center gap-2 text-[22px] font-bold tracking-tight">
          <Waypoints className="size-5" /> Connections
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Drag projects from the sidebar onto the canvas and wire one project&apos;s right handle to
          another&apos;s service. Connected projects cluster into a group you can select and edit.
          DDevUI injects the host/port env vars and restarts the consumer.
        </p>
      </div>
      <ReactFlowProvider>
        <ConnectionsCanvas />
      </ReactFlowProvider>
    </div>
  )
}
