export type AppToastKind = 'info' | 'success' | 'warning' | 'confirm'

export interface AppToast {
  id: string
  title: string
  body?: string
  kind?: AppToastKind
  href?: string
  hrefLabel?: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
  ttlMs?: number
}

type Listener = (toasts: AppToast[]) => void

let toasts: AppToast[] = []
const listeners = new Set<Listener>()
const seenNotificationIds = new Set<string>()

function emit() {
  const snapshot = [...toasts]
  listeners.forEach(l => l(snapshot))
}

export function subscribeAppToasts(listener: Listener) {
  listeners.add(listener)
  listener([...toasts])
  return () => {
    listeners.delete(listener)
  }
}

export function pushAppToast(toast: Omit<AppToast, 'id'> & { id?: string }) {
  const id = toast.id ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const next: AppToast = {
    id,
    title: toast.title,
    body: toast.body,
    kind: toast.kind ?? 'info',
    href: toast.href,
    hrefLabel: toast.hrefLabel,
    actionLabel: toast.actionLabel,
    onAction: toast.onAction,
    ttlMs: toast.ttlMs,
  }
  toasts = [next, ...toasts].slice(0, 6)
  emit()
  const ttl = toast.ttlMs ?? (toast.kind === 'confirm' ? 0 : 8000)
  if (ttl > 0) {
    window.setTimeout(() => dismissAppToast(id), ttl)
  }
  return id
}

export function dismissAppToast(id: string) {
  const before = toasts.length
  toasts = toasts.filter(t => t.id !== id)
  if (toasts.length !== before) emit()
}

/** Dedupe workflow step_notifications into toasts. */
export function ingestWorkflowNotifications(opts: {
  runId: string
  workflowId: string
  dailyTaskId?: string | null
  notifications: Array<{
    id: string
    step_key: string
    label: string
    kind: string
    agent_run_id?: string | null
  }>
  onContinue?: (runId: string) => void | Promise<void>
}) {
  for (const n of opts.notifications) {
    if (!n?.id || seenNotificationIds.has(n.id)) continue
    seenNotificationIds.add(n.id)
    const isConfirm = n.kind === 'confirm'
    const href = opts.dailyTaskId
      ? `/schedule`
      : `/workflows?def=${encodeURIComponent(opts.workflowId)}&run=${encodeURIComponent(opts.runId)}`
    pushAppToast({
      id: n.id,
      kind: isConfirm ? 'confirm' : 'info',
      title: isConfirm
        ? `步骤「${n.label || n.step_key}」待确认`
        : `步骤「${n.label || n.step_key}」已完成`,
      body: isConfirm ? '工作流已暂停，确认无误后可继续下一步' : '可点击查看对应 Run / 任务',
      href,
      hrefLabel: opts.dailyTaskId ? '打开今日计划' : '打开工作流',
      actionLabel: isConfirm ? '继续下一步' : undefined,
      onAction: isConfirm && opts.onContinue ? () => opts.onContinue!(opts.runId) : undefined,
      ttlMs: isConfirm ? 0 : 10000,
    })
  }
}
