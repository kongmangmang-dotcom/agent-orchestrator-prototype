import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listAgents } from '../api/agents'
import { createWorkflowDefinition, getWorkflowDefinition, updateWorkflowDefinition } from '../api/workflows'
import type { ApiAgent } from '../api/types'
import { formStepsToDag } from '../lib/workflowMap'
import { validateWorkflowSteps } from '../lib/workflowDagValidate'
import { WorkflowDAG } from '../components/WorkflowDAG'
import { PageHeader, Btn, SectionTitle } from '../components/ui'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

export interface StepFormRow {
  step_key: string
  label: string
  agent_id: string
  depends_on: string[]
  parallel: boolean
}

const FEATURE_DEV_PRESET: Omit<StepFormRow, 'agent_id'>[] = [
  { step_key: 'planning', label: '任务规划', depends_on: [], parallel: false },
  { step_key: 'research', label: '项目调研', depends_on: ['planning'], parallel: false },
  { step_key: 'backend', label: '后端实现', depends_on: ['research'], parallel: false },
  { step_key: 'frontend', label: '前端实现', depends_on: ['research'], parallel: true },
  { step_key: 'testing', label: '测试验证', depends_on: ['backend', 'frontend'], parallel: false },
  { step_key: 'review', label: '代码评审', depends_on: ['testing'], parallel: false },
]

const AGENT_NAME_BY_STEP: Record<string, string> = {
  planning: 'openai-planner',
  research: 'claude-researcher',
  backend: 'codex-backend',
  frontend: 'codex-backend',
  testing: 'opencode-tester',
  review: 'gemini-reviewer',
}

function emptyStep(): StepFormRow {
  return {
    step_key: '',
    label: '',
    agent_id: '',
    depends_on: [],
    parallel: false,
  }
}

function slugifyName(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workflow'
}

export function WorkflowFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEdit = Boolean(editId)

  const [agents, setAgents] = useState<ApiAgent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingDefinition, setLoadingDefinition] = useState(isEdit)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reuseSameAgentSession, setReuseSameAgentSession] = useState(false)
  const [preservedOptions, setPreservedOptions] = useState<Record<string, unknown>>({})
  const [steps, setSteps] = useState<StepFormRow[]>([emptyStep()])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)

  useEffect(() => {
    listAgents()
      .then(res => setAgents(res.items))
      .catch(e => setError(e instanceof Error ? e.message : '加载 Agent 失败'))
      .finally(() => setLoadingAgents(false))
  }, [])

  useEffect(() => {
    if (!editId) return
    setLoadingDefinition(true)
    getWorkflowDefinition(editId)
      .then(def => {
        setName(def.name)
        setTitle(def.title)
        setDescription(def.description)
        setNameTouched(true)
        setPreservedOptions(def.options ?? {})
        setReuseSameAgentSession(Boolean(def.options?.reuse_same_agent_session))
        setSteps(
          def.steps.length > 0
            ? def.steps.map(s => ({
                step_key: s.step_key,
                label: s.label,
                agent_id: s.agent_id,
                depends_on: s.depends_on,
                parallel: s.parallel,
              }))
            : [emptyStep()],
        )
      })
      .catch(e => setError(e instanceof Error ? e.message : '加载工作流失败'))
      .finally(() => setLoadingDefinition(false))
  }, [editId])

  const agentsById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents])

  const dagSteps = useMemo(
    () => formStepsToDag(steps.filter(s => s.step_key.trim()), agentsById),
    [steps, agentsById],
  )

  const stepKeys = useMemo(
    () => steps.map(s => s.step_key.trim()).filter(Boolean),
    [steps],
  )

  function applyTitle(nextTitle: string) {
    setTitle(nextTitle)
    if (!nameTouched) {
      setName(slugifyName(nextTitle))
    }
  }

  function loadPreset() {
    const byName = new Map(agents.map(a => [a.name, a.id]))
    const demo = agents.find(a => a.name === 'demo-developer')
    setSteps(
      FEATURE_DEV_PRESET.map(row => ({
        ...row,
        agent_id:
          byName.get(AGENT_NAME_BY_STEP[row.step_key] ?? '') ??
          demo?.id ??
          agents[0]?.id ??
          '',
      })),
    )
    if (!title.trim()) {
      applyTitle('功能开发流程')
      setDescription('规划 → 调研 → 并行开发 → 测试 → 评审')
    }
    setError(null)
  }

  function updateStep(index: number, patch: Partial<StepFormRow>) {
    setSteps(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= steps.length) return
    setSteps(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function removeStep(index: number) {
    setSteps(prev => {
      if (prev.length <= 1) return prev
      const removedKey = prev[index].step_key.trim()
      return prev
        .filter((_, i) => i !== index)
        .map(row => ({
          ...row,
          depends_on: row.depends_on.filter(dep => dep !== removedKey),
        }))
    })
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!name.trim() || !title.trim()) {
        setError('请填写工作流名称与标题')
        return
      }
      const normalized = steps.map((row, index) => ({
        step_key: row.step_key.trim(),
        label: row.label.trim() || row.step_key.trim(),
        agent_id: row.agent_id,
        depends_on: row.depends_on,
        parallel: row.parallel,
        sort_order: index,
      }))
      const validation = validateWorkflowSteps(normalized)
      if (validation) {
        setError(validation)
        return
      }
      if (normalized.some(s => !s.agent_id)) {
        setError('每个步骤都需要选择 Agent')
        return
      }

      setSubmitting(true)
      setError(null)
      try {
        const payload = {
          name: name.trim(),
          title: title.trim(),
          description: description.trim(),
          options: {
            ...preservedOptions,
            reuse_same_agent_session: reuseSameAgentSession,
          },
          steps: normalized,
        }
        if (isEdit && editId) {
          const updated = await updateWorkflowDefinition(editId, payload)
          navigate(`/workflows?def=${updated.id}`)
        } else {
          const created = await createWorkflowDefinition(payload)
          navigate(`/workflows?def=${created.id}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : isEdit ? '保存失败' : '创建失败')
      } finally {
        setSubmitting(false)
      }
    },
    [
      description,
      editId,
      isEdit,
      name,
      navigate,
      preservedOptions,
      reuseSameAgentSession,
      steps,
      title,
    ],
  )

  if (loadingDefinition) {
    return (
      <div className="px-10 py-10 text-sm text-text-muted">加载工作流…</div>
    )
  }

  return (
    <div className="px-10 py-10 space-y-10 max-w-6xl">
      <PageHeader
        title={isEdit ? '编辑工作流模板' : '新建工作流模板'}
        description="定义 DAG 步骤与依赖关系；保存后可在列表中预览并启动 Run。"
        action={
          <Link to="/workflows">
            <Btn variant="secondary" size="sm">返回列表</Btn>
          </Link>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        <section className="space-y-4">
          <SectionTitle>基本信息</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-xl bg-surface-1 border border-border-subtle">
            <label className="block text-xs text-text-muted">
              标识 name（英文 slug）
              <input
                required
                value={name}
                onChange={e => {
                  setNameTouched(true)
                  setName(e.target.value)
                }}
                placeholder="feature-dev"
                className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono"
              />
            </label>
            <label className="block text-xs text-text-muted">
              标题
              <input
                required
                value={title}
                onChange={e => applyTitle(e.target.value)}
                placeholder="功能开发流程"
                className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
              />
            </label>
            <label className="block text-xs text-text-muted md:col-span-2">
              描述
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
              />
            </label>
            <label className="md:col-span-2 flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={reuseSameAgentSession}
                onChange={e => setReuseSameAgentSession(e.target.checked)}
              />
              <span className="text-sm text-text">
                <span className="font-medium">同 Agent 连续步骤共用长对话</span>
                <span className="block text-xs text-text-muted mt-1 leading-relaxed">
                  开启后，同一 Agent 的后续步骤会带上此前的对话历史（上下文延续）。
                  CLI 一次性执行场景下会新建 AgentRun 并注入历史；仅当上一步会话仍在 running 时才会尝试 inject_message。
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionTitle>步骤与依赖</SectionTitle>
            <div className="flex gap-2">
              <Btn type="button" variant="secondary" size="sm" onClick={loadPreset} disabled={loadingAgents || agents.length === 0}>
                加载功能开发预设
              </Btn>
              <Btn
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSteps(prev => [...prev, emptyStep()])}
              >
                <Plus className="w-3.5 h-3.5" />添加步骤
              </Btn>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((row, index) => (
              <div
                key={`step-${index}`}
                className="p-4 rounded-xl bg-surface-1 border border-border-subtle grid grid-cols-1 lg:grid-cols-12 gap-3 items-start"
              >
                <label className="block text-xs text-text-muted lg:col-span-2">
                  step_key
                  <input
                    required
                    value={row.step_key}
                    onChange={e => updateStep(index, { step_key: e.target.value })}
                    placeholder="backend"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono"
                  />
                </label>
                <label className="block text-xs text-text-muted lg:col-span-2">
                  标签
                  <input
                    value={row.label}
                    onChange={e => updateStep(index, { label: e.target.value })}
                    placeholder="后端实现"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  />
                </label>
                <label className="block text-xs text-text-muted lg:col-span-3">
                  Agent
                  <select
                    required
                    value={row.agent_id}
                    onChange={e => updateStep(index, { agent_id: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  >
                    <option value="">选择 Agent</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.provider_name ?? a.provider_id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-text-muted lg:col-span-3">
                  依赖步骤
                  <select
                    multiple
                    value={row.depends_on}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions, o => o.value)
                      updateStep(index, { depends_on: selected })
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm min-h-[42px]"
                  >
                    {stepKeys
                      .filter(key => key !== row.step_key.trim())
                      .map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                  </select>
                  <span className="text-[10px] text-text-muted mt-1 block">Ctrl/⌘ 多选</span>
                </label>
                <div className="lg:col-span-2 flex flex-col gap-2 pt-5">
                  <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.parallel}
                      onChange={e => updateStep(index, { parallel: e.target.checked })}
                    />
                    并行分支
                  </label>
                  <div className="flex gap-1">
                    <button type="button" title="上移" onClick={() => moveStep(index, -1)} className="p-1.5 rounded hover:bg-surface-3 text-text-muted">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="下移" onClick={() => moveStep(index, 1)} className="p-1.5 rounded hover:bg-surface-3 text-text-muted">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      disabled={steps.length <= 1}
                      onClick={() => removeStep(index)}
                      className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 pb-6">
          <SectionTitle>DAG 预览</SectionTitle>
          {dagSteps.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted rounded-xl border border-border-subtle bg-surface-1">
              填写 step_key 后在此预览依赖图
            </div>
          ) : (
            <WorkflowDAG steps={dagSteps} onSelectStep={() => {}} />
          )}
        </section>

        <div className="flex justify-end gap-2 pb-10">
          <Link to="/workflows">
            <Btn variant="secondary" size="sm" type="button">取消</Btn>
          </Link>
          <Btn variant="primary" size="sm" type="submit" disabled={submitting || loadingAgents}>
            {submitting ? (isEdit ? '保存中…' : '创建中…') : (isEdit ? '保存修改' : '创建工作流')}
          </Btn>
        </div>
      </form>
    </div>
  )
}
