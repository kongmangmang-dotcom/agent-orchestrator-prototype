import { apiFetch } from './client'
import type { ApiRole, ListResponse } from './types'

export interface CreateRoleInput {
  code: string
  name: string
  description?: string
  system_prompt?: string
  default_provider_kind?: string
  sort_order?: number
}

export type UpdateRoleInput = Partial<CreateRoleInput>

export function listRoles() {
  return apiFetch<ListResponse<ApiRole>>('/roles')
}

export function getRole(id: string) {
  return apiFetch<ApiRole>(`/roles/${id}`)
}

export function createRole(body: CreateRoleInput) {
  return apiFetch<ApiRole>('/roles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateRole(id: string, body: UpdateRoleInput) {
  return apiFetch<ApiRole>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteRole(id: string) {
  return apiFetch<void>(`/roles/${id}`, { method: 'DELETE' })
}

/** 兼容旧调用：映射为模板结构 */
export async function listRoleTemplates() {
  const res = await listRoles()
  return {
    items: res.items.map(r => ({
      role: r.code,
      label: r.name,
      desc: r.description,
      default_provider_kind: r.default_provider_kind,
    })),
  }
}
