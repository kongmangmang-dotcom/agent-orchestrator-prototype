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

export function listProviders() {
  return apiFetch<ListResponse<ApiProvider>>('/providers')
}

export function createProvider(body: CreateProviderInput) {
  return apiFetch<ApiProvider>('/providers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function testProvider(id: string) {
  return apiFetch<ProviderTestResult>(`/providers/${id}/test`, { method: 'POST' })
}
