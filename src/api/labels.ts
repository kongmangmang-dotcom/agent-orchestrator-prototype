import type { ProviderType } from './types'

export const providerTypeLabel: Record<ProviderType, string> = {
  model_api: '模型 API',
  coding_agent: '编程 Agent',
  local_runtime: '本地 Runtime',
}

export const roleLabel: Record<string, string> = {
  planner: 'Planner',
  researcher: 'Researcher',
  developer: 'Developer',
  tester: 'Tester',
  reviewer: 'Reviewer',
  integrator: 'Integrator',
  game_designer: 'Game Designer',
}

export function displayRole(role?: string | null) {
  const key = (role || '').trim()
  if (!key) return '未指定'
  return roleLabel[key] ?? key
}

export function permissionsForUi(perms?: Record<string, boolean> | null) {
  const p = perms ?? {}
  return {
    readFiles: p.read_files ?? false,
    writeFiles: p.write_files ?? false,
    runCommands: p.run_commands ?? false,
    runTests: p.run_tests ?? false,
    network: p.network ?? false,
  }
}
