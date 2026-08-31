import { useMemo, useRef, useState, useEffect } from 'react'
import type { WorkflowStep, StepStatus } from '../data/mock'
import { Badge } from './ui'
import { Loader2 } from 'lucide-react'

const NODE_W = 168
const NODE_H = 80
const COL_GAP = 72
const ROW_GAP = 20
const PADDING = 24

function computeColumn(stepId: string, steps: WorkflowStep[], cache: Map<string, number>): number {
  if (cache.has(stepId)) return cache.get(stepId)!
  const step = steps.find(s => s.id === stepId)
  if (!step || step.dependsOn.length === 0) {
    cache.set(stepId, 0)
    return 0
  }
  const col = 1 + Math.max(...step.dependsOn.map(d => computeColumn(d, steps, cache)))
  cache.set(stepId, col)
  return col
}

export interface NodePosition {
  step: WorkflowStep
  x: number
  y: number
  col: number
}

function layoutNodes(steps: WorkflowStep[]): NodePosition[] {
  const cache = new Map<string, number>()
  const columns = new Map<number, WorkflowStep[]>()

  for (const step of steps) {
    const col = computeColumn(step.id, steps, cache)
    if (!columns.has(col)) columns.set(col, [])
    columns.get(col)!.push(step)
  }

  const positions: NodePosition[] = []
  for (const [col, colSteps] of columns) {
    colSteps.forEach((step, row) => {
      positions.push({
        step,
        col,
        x: PADDING + col * (NODE_W + COL_GAP),
        y: PADDING + row * (NODE_H + ROW_GAP),
      })
    })
  }
  return positions
}

const statusBorder: Record<StepStatus, string> = {
  completed: 'border-success/40 bg-success/5',
  running: 'border-accent bg-accent/5 ring-1 ring-accent/20',
  pending: 'border-border bg-surface-1',
  failed: 'border-danger/40 bg-danger/5',
  waiting_approval: 'border-warning/40 bg-warning/5',
}

const statusLabel: Record<StepStatus, string> = {
  completed: '已完成',
  running: '运行中',
  pending: '等待',
  failed: '失败',
  waiting_approval: '待审批',
}

interface WorkflowDAGProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onSelectStep: (step: WorkflowStep) => void
}

export function WorkflowDAG({ steps, selectedStepId, onSelectStep }: WorkflowDAGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgSize, setSvgSize] = useState({ w: 800, h: 300 })

  const positions = useMemo(() => layoutNodes(steps), [steps])
  const posMap = useMemo(() => new Map(positions.map(p => [p.step.id, p])), [positions])

  const edges = useMemo(() => {
    return steps.flatMap(step =>
      step.dependsOn.map(depId => ({ from: depId, to: step.id }))
    )
  }, [steps])

  useEffect(() => {
    if (!containerRef.current) return
    const maxX = Math.max(...positions.map(p => p.x + NODE_W), 400)
    const maxY = Math.max(...positions.map(p => p.y + NODE_H), 200)
    setSvgSize({ w: maxX + PADDING, h: maxY + PADDING })
  }, [positions])

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 shadow-sm overflow-auto">
      <div ref={containerRef} className="relative min-h-[200px]" style={{ width: svgSize.w, height: svgSize.h }}>
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgSize.w}
          height={svgSize.h}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#a1a1aa" />
            </marker>
          </defs>
          {edges.map(({ from, to }) => {
            const src = posMap.get(from)
            const tgt = posMap.get(to)
            if (!src || !tgt) return null
            const x1 = src.x + NODE_W
            const y1 = src.y + NODE_H / 2
            const x2 = tgt.x
            const y2 = tgt.y + NODE_H / 2
            const cx = (x1 + x2) / 2
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={tgt.step.status === 'pending' ? '#d4d4d8' : '#4f46e5'}
                strokeWidth={1.5}
                strokeOpacity={tgt.step.status === 'pending' ? 0.4 : 0.7}
                markerEnd="url(#arrow)"
              />
            )
          })}
        </svg>

        {positions.map(({ step, x, y }) => {
          const selected = step.id === selectedStepId
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep(step)}
              className={`absolute text-left rounded-lg border px-3 py-2.5 transition-all cursor-pointer hover:brightness-110 ${statusBorder[step.status]} ${
                selected ? 'ring-2 ring-accent' : ''
              }`}
              style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-text-strong truncate">{step.label}</span>
                {step.status === 'running' && <Loader2 className="w-3 h-3 text-accent animate-spin shrink-0" />}
              </div>
              <div className="font-mono text-[10px] text-text-muted truncate">{step.agentName}</div>
              <div className="flex items-center justify-between mt-1.5">
                <Badge variant={step.status === 'running' ? 'accent' : step.status === 'completed' ? 'success' : 'default'}>
                  {statusLabel[step.status]}
                </Badge>
                <span className="text-[10px] text-text-muted">{step.provider}</span>
              </div>
              {step.parallel && (
                <span className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 rounded bg-info/20 text-info border border-info/30">
                  并行
                </span>
              )}
              {step.progress != null && step.progress > 0 && step.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-3 rounded-b-lg overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${step.progress}%` }} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function getExecutionKey(workflowId: string, stepId: string) {
  return `${workflowId}:${stepId}`
}
