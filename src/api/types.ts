export type ProviderType = 'model_api' | 'coding_agent' | 'local_runtime'

export interface ApiProvider {
  id: string
  kind: string
  type: ProviderType
  name: string
  endpoint: string
  default_model: string
  config: Record<string, unknown>
  capabilities: string[]
  status: string
  created_at: string
  updated_at: string
}

export interface ApiAgent {
  id: string
  name: string
  provider_id: string
  provider_name: string | null
  model: string
  role: string
  system_prompt: string
  workspace_path: string
  permissions: Record<string, boolean>
  limits: Record<string, number>
  streaming: boolean
  created_at: string
  updated_at: string
}

export interface ApiRoleTemplate {
  role: string
  label: string
  desc: string
  default_provider_kind: string
}

export interface ApiWorkflowDefinitionSummary {
  id: string
  name: string
  title: string
  description: string
  step_count: number
  created_at: string
}

export interface ApiWorkflowStepDef {
  id: string
  step_key: string
  label: string
  agent_id: string
  agent_name: string | null
  depends_on: string[]
  parallel: boolean
  sort_order: number
}

export interface ApiWorkflowDefinition {
  id: string
  name: string
  title: string
  description: string
  options: Record<string, unknown>
  created_at: string
  steps: ApiWorkflowStepDef[]
}

export interface CreateWorkflowStepInput {
  step_key: string
  label: string
  agent_id: string
  depends_on?: string[]
  parallel?: boolean
  sort_order?: number
}

export interface CreateWorkflowDefinitionInput {
  name: string
  title: string
  description?: string
  options?: Record<string, unknown>
  steps: CreateWorkflowStepInput[]
}

export interface UpdateWorkflowDefinitionInput {
  name?: string
  title?: string
  description?: string
  options?: Record<string, unknown>
  steps?: CreateWorkflowStepInput[]
}

export interface ListResponse<T> {
  items: T[]
}

export interface ApiWorkflowStepRun {
  step_key: string
  label: string
  agent_id: string
  agent_name: string | null
  provider_name: string | null
  depends_on: string[]
  parallel: boolean
  status: string
  progress: number
  agent_run_id: string | null
  summary: string
  started_at: string | null
  finished_at: string | null
}

export interface ApiWorkflowRun {
  id: string
  workflow_id: string
  workflow_name: string | null
  workflow_title: string | null
  status: string
  progress: number
  task_prompt: string
  workspace_path: string
  error_message: string | null
  daily_task_id?: string | null
  linked_note_count?: number
  steps: ApiWorkflowStepRun[]
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ApiWorkflowRunSummary {
  id: string
  workflow_id: string
  workflow_title: string | null
  status: string
  progress: number
  task_prompt: string
  daily_task_id?: string | null
  linked_note_count?: number
  started_at: string | null
  created_at: string
}

export interface StartWorkflowRunInput {
  workflow_definition_id: string
  task_prompt: string
  workspace_path?: string
}

export interface ProviderTestResult {
  ok: boolean
  provider_id: string
  message: string
  latency_ms: number | null
}
