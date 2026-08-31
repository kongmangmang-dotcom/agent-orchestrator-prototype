import { apiFetch } from './client'
import type {
  ApiWorkflowDefinition,
  ApiWorkflowDefinitionSummary,
  ApiWorkflowRun,
  ApiWorkflowRunSummary,
  CreateWorkflowDefinitionInput,
  ListResponse,
  StartWorkflowRunInput,
  UpdateWorkflowDefinitionInput,
} from './types'

export function listWorkflowDefinitions() {
  return apiFetch<ListResponse<ApiWorkflowDefinitionSummary>>('/workflows/definitions')
}

export function getWorkflowDefinition(id: string) {
  return apiFetch<ApiWorkflowDefinition>(`/workflows/definitions/${id}`)
}

export function createWorkflowDefinition(body: CreateWorkflowDefinitionInput) {
  return apiFetch<ApiWorkflowDefinition>('/workflows/definitions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateWorkflowDefinition(id: string, body: UpdateWorkflowDefinitionInput) {
  return apiFetch<ApiWorkflowDefinition>(`/workflows/definitions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteWorkflowDefinition(id: string) {
  return apiFetch<void>(`/workflows/definitions/${id}`, { method: 'DELETE' })
}

export function listWorkflowRuns(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<ListResponse<ApiWorkflowRunSummary>>(`/workflows/runs${q}`)
}

export function startWorkflowRun(body: StartWorkflowRunInput) {
  return apiFetch<ApiWorkflowRun>('/workflows/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getWorkflowRun(id: string) {
  return apiFetch<ApiWorkflowRun>(`/workflows/runs/${id}`)
}

export interface WorkflowTerminatePreview {
  workflow_run_id: string
  daily_task_id: string | null
  status: string
  note_count: number
  notes: { id: string; title: string; file_path: string }[]
}

export interface WorkflowTerminateResult {
  workflow_run_id: string
  status: string
  deleted_notes: number
  retained_notes: number
  daily_task_id: string | null
  record_deleted: boolean
}

export function previewTerminateWorkflowRun(id: string) {
  return apiFetch<WorkflowTerminatePreview>(`/workflows/runs/${id}/terminate-preview`)
}

export function terminateWorkflowRun(
  id: string,
  body?: { delete_notes?: boolean; delete_record?: boolean },
) {
  return apiFetch<WorkflowTerminateResult>(`/workflows/runs/${id}/terminate`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}
