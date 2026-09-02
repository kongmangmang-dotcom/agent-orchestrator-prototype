import { apiFetch } from './client'
import type { ApiAgent, ListResponse } from './types'

export interface CreateAgentInput {
  name: string
  provider_id: string
  model?: string
  role?: string
  system_prompt?: string
  workspace_path?: string
  permissions?: {
    read_files: boolean
    write_files: boolean
    run_commands: boolean
    run_tests: boolean
    network: boolean
  }
  limits?: {
    timeout_minutes: number
    max_rounds: number
  }
  streaming?: boolean
}

export type UpdateAgentInput = Partial<CreateAgentInput>

export function listAgents() {
  return apiFetch<ListResponse<ApiAgent>>('/agents')
}

export function getAgent(agentId: string) {
  return apiFetch<ApiAgent>(`/agents/${agentId}`)
}

export function createAgent(body: CreateAgentInput) {
  return apiFetch<ApiAgent>('/agents', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateAgent(agentId: string, body: UpdateAgentInput) {
  return apiFetch<ApiAgent>(`/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteAgent(agentId: string) {
  return apiFetch<void>(`/agents/${agentId}`, { method: 'DELETE' })
}
