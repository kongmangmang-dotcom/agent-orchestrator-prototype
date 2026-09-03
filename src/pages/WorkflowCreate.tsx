import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listAgents } from '../api/agents'
import { createRole, listRoleTemplates } from '../api/roles'
import { createWorkflowDefinition, getWorkflowDefinition, updateWorkflowDefinition } from '../api/workflows'
import type { ApiAgent, ApiRoleTemplate } from '../api/types'
import { formStepsToDag } from '../lib/workflowMap'
import { validateWorkflowSteps } from '../lib/workflowDagValidate'
import { WorkflowDAG } from '../components/WorkflowDAG'
import { PageHeader, Btn, SectionTitle } from '../components/ui'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'

export interface StepFormRow {
  step_key: string
  label: string
  agent_id: string
  role: string
  depends_on: string[]
  parallel: boolean
  on_complete: 'none' | 'notify' | 'confirm'
}

const FEATURE_DEV_PRESET: Omit<StepFormRow, 'agent_id'>[] = [
  { step_key: 'planning', label: '任务规划', role: 'planner', depends_on: [], parallel: false, on_complete: 'none' },
  { step_key: 'research', label: '项目调研', role: 'researcher', depends_on: ['planning'], parallel: false, on_complete: 'none' },
  { step_key: 'backend', label: '后端实现', role: 'developer', depends_on: ['research'], parallel: false, on_complete: 'none' },
  { step_key: 'frontend', label: '前端实现', role: 'developer', depends_on: ['research'], parallel: true, on_complete: 'none' },
  { step_key: 'testing', label: '测试验证', role: 'tester', depends_on: ['backend', 'frontend'], parallel: false, on_complete: 'none' },
  { step_key: 'review', label: '代码评审', role: 'reviewer', depends_on: ['testing'], parallel: false, on_complete: 'none' },
]

/** 工作流模板预设分类标签 */
export const WORKFLOW_TAG_PRESETS = ['计划', '开发'] as const

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
    role: '',
    depends_on: [],
    parallel: false,
    on_complete: 'none',
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
  const [roleTemplates, setRoleTemplates] = useState<ApiRoleTemplate[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingDefinition, setLoadingDefinition] = useState(isEdit)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [reuseSameAgentSession, setReuseSameAgentSession] = useState(false)
  const [preservedOptions, setPreservedOptions] = useState<Record<string, unknown>>({})
  const [steps, setSteps] = useState<StepFormRow[]>([emptyStep()])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [roleDialogStepIndex, setRoleDialogStepIndex] = useState<number | null>(null)
  const [roleForm, setRoleForm] = useState({
    code: '',
    name: '',
    description: '',
    system_prompt: '',
    default_provider_kind: '',
    sort_order: 100,
  })
  const [roleFormError, setRoleFormError] = useState<string | null>(null)
  const [roleSubmitting, setRoleSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([listAgents(), listRoleTemplates()])
      .then(([agentRes, roleRes]) => {
        setAgents(agentRes.items)
        setRoleTemplates(roleRes.items)
      })
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
        setTags(Array.isArray(def.tags) ? def.tags : [])
        setNameTouched(true)
        setPreservedOptions(def.options ?? {})
        setReuseSameAgentSession(Boolean(def.options?.reuse_same_agent_session))
        setSteps(
          def.steps.length > 0
            ? def.steps.map(s => ({
                step_key: s.step_key,
                label: s.label,
                agent_id: s.agent_id,
                role: s.role || '',
                depends_on: s.depends_on,
                parallel: s.parallel,
                on_complete:
                  s.on_complete === 'notify' || s.on_complete === 'confirm'
                    ? s.on_complete
                    : 'none',
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
    setTags(prev => (prev.includes('开发') ? prev : [...prev, '开发']))
    setError(null)
  }

  function toggleTag(tag: string) {
    setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  function addCustomTag() {
    const next = customTag.trim()
    if (!next) return
    setTags(prev => (prev.includes(next) ? prev : [...prev, next]))
    setCustomTag('')
  }

  function updateStep(index: number, patch: Partial<StepFormRow>) {
    setSteps(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function openCreateRoleForStep(index: number) {
    const step = steps[index]
    const hint = (step?.label || step?.step_key || 'custom').trim()
    const codeGuess =
      hint
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'custom-role'
    setRoleDialogStepIndex(index)
    setRoleForm({
      code: codeGuess,
      name: hint || 'Custom Role',
      description: '',
      system_prompt: '',
      default_provider_kind: '',
      sort_order: 100,
    })
    setRoleFormError(null)
  }

  async function handleCreateRoleForStep(e: React.FormEvent) {
    e.preventDefault()
    if (roleDialogStepIndex == null) return
    if (!roleForm.code.trim() || !roleForm.name.trim()) {
      setRoleFormError('请填写 code 与名称')
      return
    }
    setRoleSubmitting(true)
    setRoleFormError(null)
    try {
      const created = await createRole({
        code: roleForm.code.trim(),
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        system_prompt: roleForm.system_prompt.trim(),
        default_provider_kind: roleForm.default_provider_kind.trim(),
        sort_order: Number(roleForm.sort_order) || 100,
      })
      const roleRes = await listRoleTemplates()
      setRoleTemplates(roleRes.items)
      updateStep(roleDialogStepIndex, { role: created.code })
      setRoleDialogStepIndex(null)
    } catch (err) {
      setRoleFormError(err instanceof Error ? err.message : '创建角色失败')
    } finally {
      setRoleSubmitting(false)
    }
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
        role: (row.role || '').trim(),
        depends_on: row.depends_on,
        parallel: row.parallel,
        on_complete: row.on_complete || 'none',
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
          tags,
          options: {
            ...preservedOptions,
            reuse_same_agent_session: reuseSameAgentSession,
            tags,
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
      tags,
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
            <div className="md:col-span-2 space-y-2">
              <div className="text-xs text-text-muted">分类标签</div>
              <div className="flex flex-wrap gap-2">
                {WORKFLOW_TAG_PRESETS.map(tag => {
                  const active = tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        active
                          ? 'bg-accent/15 border-accent/40 text-accent'
                          : 'bg-surface-2 border-border text-text-muted hover:border-border hover:text-text'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
                {tags
                  .filter(t => !(WORKFLOW_TAG_PRESETS as readonly string[]).includes(t))
                  .map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="px-3 py-1.5 rounded-full text-xs border bg-accent/15 border-accent/40 text-accent"
                      title="点击移除"
                    >
                      {tag} ×
                    </button>
                  ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomTag()
                    }
                  }}
                  placeholder="自定义标签后回车"
                  className="flex-1 px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                />
                <Btn type="button" variant="secondary" size="sm" onClick={addCustomTag}>
                  添加
                </Btn>
              </div>
              <p className="text-[11px] text-text-muted">用于模板分类筛选（如「计划」「开发」），不参与步骤分工。</p>
            </div>
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
                  步骤名
                  <input
                    value={row.label}
                    onChange={e => updateStep(index, { label: e.target.value })}
                    placeholder="后端实现"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  />
                </label>
                <label className="block text-xs text-text-muted lg:col-span-2">
                  本步角色
                  <select
                    value={row.role}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '__custom__') {
                        openCreateRoleForStep(index)
                        return
                      }
                      updateStep(index, { role: v })
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  >
                    <option value="">未指定</option>
                    {roleTemplates.map(r => (
                      <option key={r.role} value={r.role}>{r.label}</option>
                    ))}
                    {row.role && !roleTemplates.some(r => r.role === row.role) && (
                      <option value={row.role}>{row.role}（当前）</option>
                    )}
                    <option value="__custom__">＋ 新建角色…</option>
                  </select>
                </label>
                <label className="block text-xs text-text-muted lg:col-span-2">
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
                        {a.name} · {a.provider_name ?? a.provider_id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-text-muted lg:col-span-2">
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
                  <label className="block text-xs text-text-muted -mt-5 mb-1">
                    完成后
                    <select
                      value={row.on_complete}
                      onChange={e =>
                        updateStep(index, {
                          on_complete: e.target.value as StepFormRow['on_complete'],
                        })
                      }
                      className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                    >
                      <option value="none">不打断（自动下一步）</option>
                      <option value="notify">完成提醒（不停）</option>
                      <option value="confirm">需要确认（暂停）</option>
                    </select>
                  </label>
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

      {roleDialogStepIndex != null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-xl rounded-xl bg-surface-1 border border-border-subtle shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-surface-1">
              <h2 className="text-base font-medium text-text-strong">新建角色</h2>
              <button
                type="button"
                onClick={() => setRoleDialogStepIndex(null)}
                className="p-1 rounded-md hover:bg-surface-3 text-text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRoleForStep} className="p-6 space-y-4">
              {roleFormError && (
                <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-sm text-danger">
                  {roleFormError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-text-muted">
                  code
                  <input
                    required
                    value={roleForm.code}
                    onChange={e => setRoleForm(f => ({ ...f, code: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono"
                  />
                </label>
                <label className="block text-xs text-text-muted">
                  名称
                  <input
                    required
                    value={roleForm.name}
                    onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs text-text-muted">
                描述
                <textarea
                  value={roleForm.description}
                  onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                />
              </label>
              <label className="block text-xs text-text-muted">
                系统提示词
                <textarea
                  value={roleForm.system_prompt}
                  onChange={e => setRoleForm(f => ({ ...f, system_prompt: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono text-xs"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Btn
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setRoleDialogStepIndex(null)}
                  disabled={roleSubmitting}
                >
                  取消
                </Btn>
                <Btn variant="primary" size="sm" type="submit" disabled={roleSubmitting}>
                  {roleSubmitting ? '创建中…' : '创建并选用'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
