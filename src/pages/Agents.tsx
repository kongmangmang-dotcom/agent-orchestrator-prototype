import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAgent, deleteAgent, listAgents, updateAgent } from '../api/agents'
import { listProviders } from '../api/providers'
import { createRun } from '../api/runs'
import { permissionsForUi } from '../api/labels'
import type { ApiAgent, ApiProvider } from '../api/types'
import { PageHeader, Badge, Btn, SectionTitle, PermissionGrid, Toggle } from '../components/ui'
import { Plus, RefreshCw, Play, X, Pencil, Trash2 } from 'lucide-react'

const defaultForm = () => ({
  name: '',
  provider_id: '',
  model: 'default',
  workspace_path: 'workspace/demo',
  system_prompt: '',
  read_files: true,
  write_files: true,
  run_commands: true,
  run_tests: false,
  network: false,
  streaming: true,
  timeout_minutes: 30,
  max_rounds: 5,
})

function agentToForm(agent: ApiAgent) {
  const p = agent.permissions
  const l = agent.limits
  return {
    name: agent.name,
    provider_id: agent.provider_id,
    model: agent.model,
    workspace_path: agent.workspace_path,
    system_prompt: agent.system_prompt,
    read_files: p.read_files ?? true,
    write_files: p.write_files ?? false,
    run_commands: p.run_commands ?? false,
    run_tests: p.run_tests ?? false,
    network: p.network ?? false,
    streaming: agent.streaming,
    timeout_minutes: l.timeout_minutes ?? 30,
    max_rounds: l.max_rounds ?? 5,
  }
}

function formPayload(form: ReturnType<typeof defaultForm>) {
  return {
    name: form.name.trim(),
    provider_id: form.provider_id,
    role: '', // 角色在工作流步骤配置，不在 Agent 上绑定
    model: form.model,
    workspace_path: form.workspace_path,
    system_prompt: form.system_prompt,
    streaming: form.streaming,
    permissions: {
      read_files: form.read_files,
      write_files: form.write_files,
      run_commands: form.run_commands,
      run_tests: form.run_tests,
      network: form.network,
    },
    limits: {
      timeout_minutes: form.timeout_minutes,
      max_rounds: form.max_rounds,
    },
  }
}

export function AgentsPage() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<ApiAgent[]>([])
  const [providers, setProviders] = useState<ApiProvider[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskPrompt, setTaskPrompt] = useState('实现一个 hello.py 并运行 echo 验证')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [agentRes, providerRes] = await Promise.all([listAgents(), listProviders()])
      setAgents(agentRes.items)
      setProviders(providerRes.items)
      if (agentRes.items.length > 0 && !selectedId) {
        setSelectedId(agentRes.items[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = agents.find(a => a.id === selectedId) ?? agents[0]
  const perms = selected ? permissionsForUi(selected.permissions) : null

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  function openForm() {
    const demoProvider = providers.find(p => p.kind === 'demo_cli') ?? providers[0]
    setEditingId(null)
    setForm({
      ...defaultForm(),
      provider_id: demoProvider?.id ?? '',
      name: demoProvider ? `my-${demoProvider.kind.replace('_cli', '')}` : '',
    })
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(agent: ApiAgent) {
    setEditingId(agent.id)
    setForm(agentToForm(agent))
    setFormError(null)
    setShowForm(true)
    setSelectedId(agent.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.provider_id) {
      setFormError('请填写名称并选择 Provider')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = formPayload(form)
      if (editingId) {
        const updated = await updateAgent(editingId, payload)
        closeForm()
        await load()
        setSelectedId(updated.id)
      } else {
        const created = await createAgent(payload)
        closeForm()
        await load()
        setSelectedId(created.id)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : editingId ? '保存失败' : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(agent: ApiAgent) {
    if (!confirm(`确定删除 Agent「${agent.name}」？此操作不可恢复。`)) return
    setDeletingId(agent.id)
    setError(null)
    try {
      await deleteAgent(agent.id)
      const agentRes = await listAgents()
      setAgents(agentRes.items)
      setSelectedId(prev => {
        if (prev !== agent.id) return prev
        return agentRes.items[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleStartRun() {
    if (!selected) return
    setStarting(true)
    setStartError(null)
    try {
      const run = await createRun(selected.id, taskPrompt)
      navigate(`/runs?run=${run.id}`)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : '启动失败')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Agent 管理"
        description="配置可执行能力（Provider、工作区、权限）。角色在工作流步骤里指定，不在 Agent 上绑定。"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Btn>
            <Btn variant="primary" size="sm" onClick={openForm}>
              <Plus className="w-3.5 h-3.5" />新建 Agent
            </Btn>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
          {error} — 请确认后端已启动（localhost:8002）
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-1 border border-border-subtle shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-surface-1">
              <h2 className="text-base font-medium text-text-strong">{editingId ? '编辑 Agent' : '新建 Agent'}</h2>
              <button type="button" onClick={closeForm} className="p-1 rounded-md hover:bg-surface-3 text-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-sm text-danger">{formError}</div>
              )}
              <label className="block text-xs text-text-muted">
                名称
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="codex-backend"
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                />
              </label>
              <label className="block text-xs text-text-muted">
                Provider
                <select
                  required
                  value={form.provider_id}
                  onChange={e => {
                    const p = providers.find(x => x.id === e.target.value)
                    setForm(f => ({
                      ...f,
                      provider_id: e.target.value,
                      model: p?.default_model || f.model,
                    }))
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                >
                  <option value="">选择 Provider</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-text-muted">
                  模型
                  <input
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  />
                </label>
                <label className="block text-xs text-text-muted">
                  工作区路径
                  <input
                    value={form.workspace_path}
                    onChange={e => setForm(f => ({ ...f, workspace_path: e.target.value }))}
                    placeholder="workspace/my-project"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono text-xs"
                  />
                </label>
              </div>
              <label className="block text-xs text-text-muted">
                系统提示词（可选）
                <textarea
                  value={form.system_prompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  rows={3}
                  placeholder="可选。角色职责请在工作流步骤里配置。"
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['read_files', '读取文件'],
                  ['write_files', '写入文件'],
                  ['run_commands', '执行命令'],
                  ['run_tests', '运行测试'],
                  ['network', '联网'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    />
                    <span className="text-text">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="secondary" size="sm" onClick={closeForm} disabled={submitting}>取消</Btn>
                <Btn variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? (editingId ? '保存中…' : '创建中…') : (editingId ? '保存' : '创建')}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <SectionTitle>已配置 Agent {loading ? '（加载中…）' : `（${agents.length}）`}</SectionTitle>
      <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-2 text-left text-xs text-text-muted">
              <th className="px-5 py-4 font-medium">名称</th>
              <th className="px-5 py-4 font-medium">Provider</th>
              <th className="px-5 py-4 font-medium">模型</th>
              <th className="px-5 py-4 font-medium">工作区</th>
              <th className="px-5 py-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && agents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                  暂无 Agent，点击「新建 Agent」创建
                </td>
              </tr>
            )}
            {agents.map(a => (
              <tr
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`border-b border-border-subtle last:border-0 hover:bg-surface-2/50 cursor-pointer ${
                  selected?.id === a.id ? 'bg-accent/5' : ''
                }`}
              >
                <td className="px-5 py-4 font-mono text-xs text-text-strong">{a.name}</td>
                <td className="px-5 py-4 text-text">{a.provider_name ?? a.provider_id}</td>
                <td className="px-5 py-4 text-text-muted">{a.model || '—'}</td>
                <td className="px-5 py-4 font-mono text-xs text-text">{a.workspace_path || '—'}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="编辑"
                      onClick={e => { e.stopPropagation(); openEditForm(a) }}
                      className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted hover:text-text transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      disabled={deletingId === a.id}
                      onClick={e => { e.stopPropagation(); handleDelete(a) }}
                      className="p-1.5 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && perms && (
        <>
          <SectionTitle>启动 Run（CLI Agent）</SectionTitle>
          <div className="p-6 rounded-xl bg-surface-1 border border-accent/20 shadow-sm space-y-4">
            <p className="text-xs text-text-muted">
              绑定 <Badge variant="accent">{selected.provider_name}</Badge> 的 Agent 将通过 subprocess 调用真实 CLI。
              无 Codex/Cursor 时请先使用 <strong>demo-developer</strong>（Demo CLI）。
            </p>
            {startError && <div className="text-sm text-danger">{startError}</div>}
            <label className="block text-xs text-text-muted">
              任务描述
              <textarea
                value={taskPrompt}
                onChange={e => setTaskPrompt(e.target.value)}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
              />
            </label>
            <Btn variant="primary" size="sm" onClick={handleStartRun} disabled={starting || !taskPrompt.trim()}>
              <Play className="w-3.5 h-3.5" />
              {starting ? '启动中…' : '启动 Run'}
            </Btn>
          </div>

          <SectionTitle>
            <span className="flex items-center justify-between gap-4">
              <span>配置详情 — {selected.name}</span>
              <span className="flex gap-2">
                <Btn variant="secondary" size="sm" onClick={() => openEditForm(selected)}>
                  <Pencil className="w-3.5 h-3.5" />编辑
                </Btn>
                <Btn
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(selected)}
                  disabled={deletingId === selected.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />删除
                </Btn>
              </span>
            </span>
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <pre className="p-6 rounded-xl bg-surface-1 border border-border-subtle font-mono text-xs text-text leading-relaxed overflow-x-auto shadow-sm">
{`name: ${selected.name}
provider: ${selected.provider_name ?? selected.provider_id}
model: ${selected.model}
workspace: ${selected.workspace_path || '—'}
streaming: ${selected.streaming}
role: （由工作流步骤指定）`}
            </pre>
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-surface-1 border border-border-subtle shadow-sm">
                <div className="text-xs text-text-muted mb-3">权限</div>
                <PermissionGrid permissions={perms} />
              </div>
              <div className="p-6 rounded-xl bg-surface-1 border border-border-subtle shadow-sm flex items-center justify-between">
                <span className="text-sm text-text">流式输出</span>
                <Toggle checked={selected.streaming} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
