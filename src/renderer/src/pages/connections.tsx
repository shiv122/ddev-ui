import { useCallback, useEffect, useMemo } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'
import { Waypoints } from 'lucide-react'
import type { ProjectGraph, ProjectLink } from '@shared/types'
import { projectTypeIcon } from '@/components/app/project-type-icon'
import { useProjectsGraph } from '@/api/hooks'
import { cn } from '@/lib/utils'
import { runOperation } from '@/store/operations'

interface ProjectNodeData extends Record<string, unknown> {
  name: string
  type: string
  status: string
  services: string[]
}

type ProjectFlowNode = Node<ProjectNodeData, 'project'>

const NODE_W = 230

function sanitizePrefix(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function linkEdgeId(l: Pick<ProjectLink, 'from' | 'to' | 'service'>): string {
  return `${l.from}->${l.to}:${l.service}`
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
      {/* consumer output */}
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
          className={cn(
            'ml-auto size-2 rounded-full',
            running ? 'bg-success' : 'bg-muted-foreground/40'
          )}
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

const nodeTypes = { project: ProjectNode }

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

function buildNodes(graph: ProjectGraph): ProjectFlowNode[] {
  const PER_ROW = 3
  return graph.nodes.map((n, i) => ({
    id: n.name,
    type: 'project',
    position: { x: (i % PER_ROW) * (NODE_W + 90), y: Math.floor(i / PER_ROW) * 240 },
    data: { name: n.name, type: n.type, status: n.status, services: n.services }
  }))
}

export function ConnectionsPage(): React.JSX.Element {
  const graph = useProjectsGraph()
  const [nodes, setNodes, onNodesChange] = useNodesState<ProjectFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const links = useMemo(() => graph.data?.links ?? [], [graph.data])

  // Rebuild from server data, preserving any positions the user dragged.
  useEffect(() => {
    if (!graph.data) return
    setNodes((prev) => {
      const pos = new Map(prev.map((p) => [p.id, p.position]))
      return buildNodes(graph.data).map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
    })
    setEdges(buildEdges(graph.data.links))
  }, [graph.data, setNodes, setEdges])

  /** Persist the full link set for one consumer, then restart it. */
  const persist = useCallback(
    (consumer: string, next: ProjectLink[]) => {
      void runOperation({ kind: 'set-links', project: consumer, links: next, restartAfter: true })
    },
    []
  )

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
      const exists = links.some(
        (l) => l.from === from && l.to === to && l.service === service
      )
      if (exists) {
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
      const next = [...links.filter((l) => l.from === from), newLink]
      persist(from, next)
      toast.success(`${from} → ${to}/${service}`, {
        description: `Injecting ${newLink.envPrefix}_HOST into ${from}, then restarting it.`
      })
    },
    [links, persist, setEdges]
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      // Group removals by consumer and rewrite each consumer's link set.
      const byConsumer = new Map<string, ProjectLink[]>()
      for (const e of deleted) {
        const l = (e.data as { link?: ProjectLink } | undefined)?.link
        if (!l) continue
        byConsumer.set(l.from, [])
      }
      for (const consumer of byConsumer.keys()) {
        const remaining = links.filter(
          (l) => l.from === consumer && !deleted.some((e) => e.id === linkEdgeId(l))
        )
        persist(consumer, remaining)
      }
    },
    [links, persist]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-metallic flex items-center gap-2 text-[22px] font-bold tracking-tight">
          <Waypoints className="size-5" /> Connections
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Drag from a project (right handle) to another project&apos;s service to let it use that
          service. DDevUI injects the host/port env vars and restarts the consumer. All projects
          already share DDEV&apos;s network, so reachability is automatic. Select an edge and press
          Delete to remove a link.
        </p>
      </div>
      <div className="relative min-h-0 flex-1">
        {graph.data && graph.data.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No projects yet. Create one to start wiring connections.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
