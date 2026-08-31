import type { ApiAgent, ApiWorkflowStepDef, ApiWorkflowStepRun } from '../api/types'
import type { StepStatus, WorkflowStep } from '../data/mock'

export function definitionStepsToDag(
  steps: ApiWorkflowStepDef[],
  agentsById: Map<string, ApiAgent>,
): WorkflowStep[] {
  return [...steps]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(step => {
      const agent = agentsById.get(step.agent_id)
      return {
        id: step.step_key,
        label: step.label,
        agentId: step.agent_id,
        agentName: step.agent_name ?? agent?.name ?? step.agent_id,
        provider: agent?.provider_name ?? '—',
        dependsOn: step.depends_on,
        parallel: step.parallel,
        status: 'pending' as const,
      }
    })
}

export function applyRunStatusToDag(
  steps: WorkflowStep[],
  runSteps: ApiWorkflowStepRun[],
): WorkflowStep[] {
  const byKey = new Map(runSteps.map(s => [s.step_key, s]))
  return steps.map(step => {
    const run = byKey.get(step.id)
    if (!run) return step
    return {
      ...step,
      status: run.status as StepStatus,
      runId: run.agent_run_id ?? undefined,
    }
  })
}

export function formStepsToDag(
  steps: {
    step_key: string
    label: string
    agent_id: string
    depends_on: string[]
    parallel: boolean
  }[],
  agentsById: Map<string, ApiAgent>,
): WorkflowStep[] {
  return steps.map((step, index) => {
    const agent = agentsById.get(step.agent_id)
    return {
      id: step.step_key || `step-${index}`,
      label: step.label || step.step_key || `步骤 ${index + 1}`,
      agentId: step.agent_id,
      agentName: agent?.name ?? (step.agent_id || '—'),
      provider: agent?.provider_name ?? '—',
      dependsOn: step.depends_on,
      parallel: step.parallel,
      status: 'pending' as const,
    }
  })
}
