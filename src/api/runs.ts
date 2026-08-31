import { apiFetch } from './client'
import type { ListResponse } from './types'

export interface ApiRun {
  id: string
  agent_id: string
  agent_name: string | null
  provider_kind: string | null
  provider_name: string | null
  status: string
  task_prompt: string
  workspace_path: string
  tokens_used: number
  command_output: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ApiRunMessage {
  id: string
  run_id: string
  role: string
  content: string
  streaming: boolean
  created_at: string
}

export interface ApiRunEvent {
  id: number
  run_id: string
  type: string
  status: string
  content: string
  metadata: Record<string, string>
  created_at: string
}

export interface ApiFileChange {
  id: number
  run_id: string
  path: string
  action: string
  lines_summary: string
  diff: string | null
  created_at: string
}

export function listRuns(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<ListResponse<ApiRun>>(`/runs${q}`)
}

export function createRun(agentId: string, taskPrompt: string) {
  return apiFetch<ApiRun>('/runs', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, task_prompt: taskPrompt }),
  })
}

export function getRun(runId: string) {
  return apiFetch<ApiRun>(`/runs/${runId}`)
}

export function getRunMessages(runId: string) {
  return apiFetch<ListResponse<ApiRunMessage>>(`/runs/${runId}/messages`)
}

export function getRunEvents(runId: string) {
  return apiFetch<ListResponse<ApiRunEvent>>(`/runs/${runId}/events`)
}

export function getRunFiles(runId: string) {
  return apiFetch<ListResponse<ApiFileChange>>(`/runs/${runId}/files`)
}

export function injectRunMessage(runId: string, content: string) {
  return apiFetch<{ run_id: string; accepted: boolean }>(`/runs/${runId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, interrupt_current: true }),
  })
}

export function cancelRun(runId: string) {
  return apiFetch<ApiRun>(`/runs/${runId}/cancel`, { method: 'POST' })
}

export function streamRunEvents(runId: string, onEvent: (data: Record<string, unknown>) => void) {
  const es = new EventSource(`/api/v1/events/stream?run_id=${encodeURIComponent(runId)}`)
  es.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data))
    } catch {
      /* ignore */
    }
  }
  const types = ['assistant_message', 'thinking_update', 'file_changed', 'agent_completed', 'agent_failed', 'user_message', 'session_created', 'task_started']
  for (const t of types) {
    es.addEventListener(t, (ev) => {
      try {
        onEvent(JSON.parse((ev as MessageEvent).data))
      } catch {
        /* ignore */
      }
    })
  }
  return es
}
