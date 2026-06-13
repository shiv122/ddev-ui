import { cn } from '@/lib/utils'

/**
 * Dependency-free SVG sparkline for dense lists (dashboard cards) where a full
 * recharts instance per row would be wasteful. Colour follows `currentColor`.
 */
export function MiniSparkline({
  values,
  className,
  min = 0,
  softMax = 100
}: {
  values: number[]
  className?: string
  /** Lower bound of the y-scale. */
  min?: number
  /** Y-scale never shrinks below this, so small values read as small. */
  softMax?: number
}): React.JSX.Element {
  if (values.length < 2) return <div className={className} aria-hidden />

  const w = 100
  const h = 100
  const max = Math.max(softMax, ...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / span) * h
    return [x, Math.max(0, Math.min(h, y))] as const
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      <path d={area} fill="currentColor" opacity={0.13} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
