import type { ReactNode } from 'react'

const variants = {
  default: 'bg-surface-3 text-text border-border',
  accent: 'bg-accent/15 text-accent border-accent/30',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  info: 'bg-info/15 text-info border-info/30',
} as const

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: keyof typeof variants
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function StatusDot({ status }: { status: 'connected' | 'disconnected' | 'error' | 'running' | 'idle' | 'paused' }) {
  const colors = {
    connected: 'bg-success',
    disconnected: 'bg-text-muted',
    error: 'bg-danger',
    running: 'bg-accent animate-pulse-dot',
    idle: 'bg-text-muted',
    paused: 'bg-warning',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-strong tracking-tight">{title}</h1>
        {description && <p className="text-sm text-text-muted leading-relaxed max-w-2xl">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">{children}</h2>
  )
}

export function PageSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`space-y-5 ${className}`}>{children}</section>
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-5 rounded-xl bg-surface-1 border border-border-subtle shadow-sm">
      <div className="text-xl font-semibold text-text-strong tabular-nums truncate" title={value}>{value}</div>
      <div className="text-sm text-text-muted mt-1.5">{label}</div>
    </div>
  )
}

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  onClick,
  disabled,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
}) {
  const variants = {
    primary: 'bg-accent hover:bg-accent-muted text-white disabled:opacity-50 disabled:pointer-events-none',
    secondary: 'bg-surface-3 hover:bg-surface-2 text-text-strong border border-border disabled:opacity-50',
    ghost: 'hover:bg-surface-3 text-text disabled:opacity-50',
    danger: 'bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 disabled:opacity-50',
  }
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-1.5 text-sm' }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-medium rounded-md transition-colors ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </button>
  )
}

export function Toggle({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className={`w-8 h-[18px] rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-3 border border-border'}`}>
        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm mt-[1px] transition-transform ${checked ? 'translate-x-[15px] ml-[1px]' : 'translate-x-[1px]'}`} />
      </div>
      <span className="text-sm text-text">{label}</span>
    </label>
  )
}

export function PermissionGrid({ permissions }: { permissions: Record<string, boolean> }) {
  const labels: Record<string, string> = {
    readFiles: '读取文件',
    writeFiles: '写入文件',
    runCommands: '执行命令',
    runTests: '运行测试',
    network: '联网',
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(permissions).map(([key, val]) => (
        <Badge key={key} variant={val ? 'success' : 'default'}>
          {labels[key] ?? key}: {val ? '是' : '否'}
        </Badge>
      ))}
    </div>
  )
}
