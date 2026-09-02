import { apiFetch } from './client'
import type { ApiProvider, ListResponse, ProviderTestResult, ProviderType } from './types'

export interface CreateProviderInput {
  kind: string
  type: ProviderType
  name: string
  endpoint?: string
  default_model?: string
  config?: Record<string, unknown>
  capabilities?: string[]
}

export type UpdateProviderInput = Partial<CreateProviderInput> & {
  status?: string
}

export function listProviders() {
  return apiFetch<ListResponse<ApiProvider>>('/providers')
}

export function getProvider(id: string) {
  return apiFetch<ApiProvider>(`/providers/${id}`)
}

export function createProvider(body: CreateProviderInput) {
  return apiFetch<ApiProvider>('/providers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateProvider(id: string, body: UpdateProviderInput) {
  return apiFetch<ApiProvider>(`/providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteProvider(id: string) {
  return apiFetch<void>(`/providers/${id}`, { method: 'DELETE' })
}

export function testProvider(id: string) {
  return apiFetch<ProviderTestResult>(`/providers/${id}/test`, { method: 'POST' })
}
