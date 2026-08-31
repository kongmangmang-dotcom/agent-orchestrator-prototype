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
}

export function permissionsForUi(perms: Record<string, boolean>) {
  return {
    readFiles: perms.read_files ?? false,
    writeFiles: perms.write_files ?? false,
    runCommands: perms.run_commands ?? false,
    runTests: perms.run_tests ?? false,
    network: perms.network ?? false,
  }
}
