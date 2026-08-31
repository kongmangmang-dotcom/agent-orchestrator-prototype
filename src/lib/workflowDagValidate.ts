export interface StepLike {
  step_key: string
  depends_on: string[]
}

export function validateWorkflowSteps(steps: StepLike[]): string | null {
  if (steps.length === 0) {
    return '至少添加一个步骤'
  }

  const keys = new Set<string>()
  for (const step of steps) {
    const key = step.step_key.trim()
    if (!key) return '步骤 step_key 不能为空'
    if (keys.has(key)) return `step_key 重复: ${key}`
    keys.add(key)
  }

  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (!keys.has(dep)) {
        return `步骤「${step.step_key}」依赖未知节点: ${dep}`
      }
      if (dep === step.step_key) {
        return `步骤「${step.step_key}」不能依赖自身`
      }
    }
  }

  if (hasCycle(keys, steps)) {
    return 'DAG 存在循环依赖，请检查 depends_on'
  }

  return null
}

function hasCycle(keys: Set<string>, steps: StepLike[]): boolean {
  const inDegree = new Map<string, number>()
  for (const key of keys) {
    inDegree.set(key, 0)
  }
  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (keys.has(dep)) {
        inDegree.set(step.step_key, (inDegree.get(step.step_key) ?? 0) + 1)
      }
    }
  }

  const queue = [...keys].filter(key => (inDegree.get(key) ?? 0) === 0)
  let visited = 0
  while (queue.length > 0) {
    const node = queue.shift()!
    visited += 1
    for (const step of steps) {
      if (step.depends_on.includes(node)) {
        const next = (inDegree.get(step.step_key) ?? 0) - 1
        inDegree.set(step.step_key, next)
        if (next === 0) queue.push(step.step_key)
      }
    }
  }

  return visited !== keys.size
}
