import { API_BASE, apiFetch } from './client'
import type { ApiRun } from './runs'
import type { ApiWorkflowRun, ListResponse } from './types'

export interface ApiTaskPlanItem {
  id: string
  title: string
  detail: string
  scheduled_time: string | null
  status: 'todo' | 'in_progress' | 'done' | string
  agent_id: string | null
  agent_name: string | null
  linked_step_key: string | null
  workflow_definition_id?: string | null
  sort_order: number
}

export interface ApiWorkflowPlanGroup {
  workflow_definition_id: string
  workflow_name: string | null
  workflow_title: string | null
  is_active: boolean
  latest_run_id: string | null
  active_run_id: string | null
  plan_item_count: number
  plan_done_count: number
  plan_items: ApiTaskPlanItem[]
}

export interface ApiTaskNote {
  id: string
  daily_task_id: string
  kind: 'markdown' | 'file' | string
  title: string
  body: string
  file_path: string
  created_at: string
  updated_at: string
}

export interface ApiTaskNoteListItem {
  id: string
  daily_task_id: string
  task_title: string
  plan_date: string
  kind: string
  title: string
  body_preview: string
  file_path: string
  has_content: boolean
  created_at: string
  updated_at: string
}

export interface ApiTaskMemory {
  id: string
  daily_task_id: string
  content: string
  tags: string[]
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface ApiDailyTask {
  id: string
  plan_date: string
  title: string
  type: 'normal' | 'dev' | string
  status: 'todo' | 'in_progress' | 'done' | string
  priority: string
  summary: string
  requirement: string
  workflow_definition_id: string | null
  bound_workflow_ids: string[]
  workflow_name: string | null
  workflow_title: string | null
  active_workflow_run_id?: string | null
  latest_workflow_run_id?: string | null
  plan_author: string | null
  plan_updated_at: string | null
  created_at: string
  updated_at: string
  plan_items: ApiTaskPlanItem[]
  workflow_plans?: ApiWorkflowPlanGroup[]
  notes: ApiTaskNote[]
  memories: ApiTaskMemory[]
  continued_from_id?: string | null
  continued_to_id?: string | null
  continued_from_plan_date?: string | null
  continued_from_title?: string | null
  continued_to_plan_date?: string | null
  continued_to_title?: string | null
}

export interface ApiDailyTaskSummary {
  id: string
  plan_date: string
  title: string
  type: string
  status: string
  priority: string
  summary: string
  requirement: string
  workflow_definition_id: string | null
  bound_workflow_ids?: string[]
  workflow_name: string | null
  workflow_title: string | null
  plan_item_count: number
  plan_done_count: number
  plan_author: string | null
  plan_updated_at: string | null
  continued_from_id?: string | null
  continued_to_id?: string | null
  continued_from_plan_date?: string | null
  continued_to_plan_date?: string | null
  created_at: string
}

export interface ApiDayOverview {
  plan_date: string
  task_count: number
  todo_count: number
  in_progress_count: number
  done_count: number
  plan_item_count: number
  plan_done_count: number
}

export interface ApiDayOverviewRange {
  start_date: string
  end_date: string
  days: ApiDayOverview[]
  total_task_count: number
  total_done_count: number
  total_plan_item_count: number
  total_plan_done_count: number
}

export interface CreateDailyTaskInput {
  title: string
  type?: string
  priority?: string
  summary?: string
  requirement?: string
  plan_date?: string
  with_plan?: boolean
  workflow_definition_id?: string | null
}

export function listDailyTasks(planDate?: string) {
  const q = planDate ? `?plan_date=${encodeURIComponent(planDate)}` : ''
  return apiFetch<ListResponse<ApiDailyTaskSummary>>(`/schedule/tasks${q}`)
}

export function getDayOverview(planDate?: string) {
  const q = planDate ? `?plan_date=${encodeURIComponent(planDate)}` : ''
  return apiFetch<ApiDayOverview>(`/schedule/overview${q}`)
}

export interface ApiDailyReportResult {
  plan_date: string
  knowledge_id: string
  knowledge_name: string
  document_id: string | null
  document_name: string | null
  skipped: boolean
  reason: string | null
  task_count: number
  chat_backend: string
}

export function generateDailyReport(opts?: { planDate?: string; force?: boolean }) {
  const params = new URLSearchParams()
  if (opts?.planDate) params.set('plan_date', opts.planDate)
  if (opts?.force) params.set('force', 'true')
  const q = params.toString() ? `?${params}` : ''
  return apiFetch<ApiDailyReportResult>(`/schedule/daily-report${q}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function getDayOverviewRange(opts?: {
  days?: number
  startDate?: string
  endDate?: string
}) {
  const params = new URLSearchParams()
  if (opts?.days != null) params.set('days', String(opts.days))
  if (opts?.startDate) params.set('start_date', opts.startDate)
  if (opts?.endDate) params.set('end_date', opts.endDate)
  const q = params.toString() ? `?${params}` : ''
  return apiFetch<ApiDayOverviewRange>(`/schedule/overview-range${q}`)
}

export function getDailyTask(id: string) {
  return apiFetch<ApiDailyTask>(`/schedule/tasks/${id}`)
}

export function createDailyTask(body: CreateDailyTaskInput) {
  return apiFetch<ApiDailyTask>('/schedule/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDailyTask(
  id: string,
  body: Partial<CreateDailyTaskInput> & {
    status?: string
    bound_workflow_ids?: string[]
    workflow_definition_id?: string | null
  },
) {
  return apiFetch<ApiDailyTask>(`/schedule/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteDailyTask(id: string) {
  return apiFetch<void>(`/schedule/tasks/${id}`, { method: 'DELETE' })
}

export function continueDailyTask(id: string, targetDate?: string) {
  return apiFetch<ApiDailyTask>(`/schedule/tasks/${id}/continue`, {
    method: 'POST',
    body: JSON.stringify(targetDate ? { target_date: targetDate } : {}),
  })
}

export function planToday(
  goal: string,
  workflowDefinitionId?: string | null,
  planDate?: string | null,
) {
  return apiFetch<{ task: ApiDailyTask }>('/schedule/tasks/plan-today', {
    method: 'POST',
    body: JSON.stringify({
      goal,
      workflow_definition_id: workflowDefinitionId || undefined,
      plan_date: planDate || undefined,
    }),
  })
}

export function regeneratePlan(taskId: string, workflowDefinitionId?: string | null) {
  return apiFetch<ApiDailyTask>(`/schedule/tasks/${taskId}/regenerate-plan`, {
    method: 'POST',
    body: JSON.stringify({
      workflow_definition_id: workflowDefinitionId ?? undefined,
    }),
  })
}

export function startTaskWorkflow(
  taskId: string,
  opts?: { workflow_definition_id?: string | null; task_prompt?: string },
) {
  return apiFetch<ApiWorkflowRun>(`/schedule/tasks/${taskId}/start-workflow`, {
    method: 'POST',
    body: JSON.stringify({
      workflow_definition_id: opts?.workflow_definition_id ?? undefined,
      task_prompt: opts?.task_prompt ?? undefined,
    }),
  })
}

export interface ApiTaskAgentChatResponse {
  run_id: string
  agent_id: string
  status: string
  created: boolean
  mode: 'start' | 'inject' | 'continue' | string
  docs_attached: boolean
}

export function taskAgentChat(
  taskId: string,
  body: {
    agent_id: string
    message: string
    run_id?: string | null
    new_session?: boolean
  },
) {
  return apiFetch<ApiTaskAgentChatResponse>(`/schedule/tasks/${taskId}/agent-chat`, {
    method: 'POST',
    body: JSON.stringify({
      agent_id: body.agent_id,
      message: body.message,
      run_id: body.run_id ?? undefined,
      new_session: body.new_session ?? false,
    }),
  })
}

export function getLatestTaskAgentChat(taskId: string, agentId?: string | null) {
  const q = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''
  return apiFetch<ApiRun | null>(
    `/schedule/tasks/${taskId}/agent-chat/latest${q}`,
  )
}

export function createTaskNote(
  taskId: string,
  body: { kind?: string; title?: string; body?: string; file_path?: string },
) {
  return apiFetch<ApiTaskNote>(`/schedule/tasks/${taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listScheduleNotes(opts?: { planDate?: string; days?: number }) {
  const params = new URLSearchParams()
  if (opts?.planDate) params.set('plan_date', opts.planDate)
  if (opts?.days != null) params.set('days', String(opts.days))
  const q = params.toString() ? `?${params}` : ''
  return apiFetch<ListResponse<ApiTaskNoteListItem>>(`/schedule/notes${q}`)
}

export function deleteTaskNote(taskId: string, noteId: string) {
  return apiFetch<void>(`/schedule/tasks/${taskId}/notes/${noteId}`, { method: 'DELETE' })
}

export async function downloadTaskNote(taskId: string, noteId: string) {
  const res = await fetch(`${API_BASE}/schedule/tasks/${taskId}/notes/${noteId}/download`)
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body?.error?.message || body?.detail || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const blob = await res.blob()
  let filename = 'note.md'
  const cd = res.headers.get('Content-Disposition') || ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd)
  const plain = /filename="?([^";]+)"?/i.exec(cd)
  if (utf8?.[1]) {
    try {
      filename = decodeURIComponent(utf8[1])
    } catch {
      filename = utf8[1]
    }
  } else if (plain?.[1]) {
    filename = plain[1]
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function createTaskMemory(
  taskId: string,
  body: { content: string; tags?: string[]; pinned?: boolean },
) {
  return apiFetch<ApiTaskMemory>(`/schedule/tasks/${taskId}/memories`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateTaskMemory(
  taskId: string,
  memoryId: string,
  body: { content?: string; tags?: string[]; pinned?: boolean },
) {
  return apiFetch<ApiTaskMemory>(`/schedule/tasks/${taskId}/memories/${memoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteTaskMemory(taskId: string, memoryId: string) {
  return apiFetch<void>(`/schedule/tasks/${taskId}/memories/${memoryId}`, { method: 'DELETE' })
}
