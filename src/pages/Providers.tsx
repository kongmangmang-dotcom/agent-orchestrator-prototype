import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createProvider,
  deleteProvider,
  listProviders,
  testProvider,
  updateProvider,
} from '../api/providers'
import { providerTypeLabel } from '../api/labels'
import type { ApiProvider, ProviderType } from '../api/types'
import { PageHeader, Badge, StatusDot, Btn, SectionTitle } from '../components/ui'
import { Plus, Zap, Code2, Server, RefreshCw, X, Pencil, Trash2 } from 'lucide-react'

const typeIcons: Record<ProviderType, typeof Zap> = {
  model_api: Zap,
  coding_agent: Code2,
  local_runtime: Server,
}

const typeColors: Record<ProviderType, 'info' | 'accent' | 'warning'> = {
  model_api: 'info',
  coding_agent: 'accent',
  local_runtime: 'warning',
}

const kindPresets: Record<ProviderType, { kind: string; label: string; endpoint: string; default_model: string }[]> = {
  model_api: [
    { kind: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', default_model: 'gpt-4o' },
    { kind: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com', default_model: 'claude-sonnet-4' },
    { kind: 'gemini', label: 'Gemini', endpoint: 'https://generativelanguage.googleapis.com', default_model: 'gemini-2.5-pro' },
  ],
  coding_agent: [
    { kind: 'demo_cli', label: 'Demo CLI（本地测试）', endpoint: 'python demo_agent_runner', default_model: 'default' },
    { kind: 'codex_cli', label: 'Codex CLI', endpoint: 'codex run', default_model: 'default' },
    { kind: 'cursor_cli', label: 'Cursor Agent', endpoint: 'cursor agent', default_model: 'composer' },
    { kind: 'opencode_cli', label: 'OpenCode CLI', endpoint: 'opencode run', default_model: 'default' },
  ],
  local_runtime: [
    { kind: 'pi', label: 'Pi', endpoint: 'localhost:3141', default_model: '—' },
    { kind: 'hermes', label: 'Hermes', endpoint: 'hermes serve', default_model: '—' },
  ],
}

const envKeyByKind: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  codex_cli: 'OPENAI_API_KEY',
}

type FormState = {
  name: string
  type: ProviderType
  kind: string
  endpoint: string
  default_model: string
  api_key_ref: string
  cli_command: string
  capabilities: string
}

const emptyForm = (): FormState => ({
  name: '',
  type: 'model_api',
  kind: 'openai',
  endpoint: kindPresets.model_api[0].endpoint,
  default_model: kindPresets.model_api[0].default_model,
  api_key_ref: 'env:OPENAI_API_KEY',
  cli_command: '',
  capabilities: '',
})

function formFromProvider(p: ApiProvider): FormState {
  const cfg = p.config || {}
  return {
    name: p.name,
    type: p.type,
    kind: p.kind,
    endpoint: p.endpoint || '',
    default_model: p.default_model || '',
    api_key_ref: typeof cfg.api_key_ref === 'string' ? cfg.api_key_ref : '',
    cli_command: typeof cfg.cli_command === 'string' ? cfg.cli_command : '',
    capabilities: (p.capabilities || []).join(', '),
  }
}

function buildConfig(form: FormState, existing?: Record<string, unknown>) {
  const config: Record<string, unknown> = { ...(existing || {}) }
  if (form.api_key_ref.trim()) config.api_key_ref = form.api_key_ref.trim()
  else delete config.api_key_ref
  if (form.cli_command.trim()) config.cli_command = form.cli_command.trim()
  else if (form.type !== 'coding_agent') delete config.cli_command
  return config
}

export function ProvidersPage() {
  const [providers, setProviders] = useState<ApiProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => providers.find(p => p.id === selectedId) ?? null,
    [providers, selectedId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listProviders()
      setProviders(res.items)
      if (selectedId && !res.items.some(p => p.id === selectedId)) {
        setSelectedId(res.items[0]?.id ?? null)
      } else if (!selectedId && res.items.length > 0) {
        setSelectedId(res.items[0].id)
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

  function openCreateForm() {
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(provider: ApiProvider) {
    setEditingId(provider.id)
    setForm(formFromProvider(provider))
    setFormError(null)
    setShowForm(true)
    setSelectedId(provider.id)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  function applyKindPreset(type: ProviderType, kind: string) {
    const preset = kindPresets[type].find(p => p.kind === kind) ?? kindPresets[type][0]
    const envKey = envKeyByKind[kind]
    setForm(f => ({
      ...f,
      type,
      kind,
      endpoint: preset.endpoint,
      default_model: preset.default_model,
      name: editingId ? f.name : f.name || preset.label,
      api_key_ref: envKey ? `env:${envKey}` : f.api_key_ref,
    }))
  }

  async function handleTest(id: string) {
    setTestingId(id)
    setTestMsg(null)
    try {
      const res = await testProvider(id)
      setTestMsg(res.message)
      await load()
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : '测试失败')
    } finally {
      setTestingId(null)
    }
  }

  async function handleDelete(provider: ApiProvider) {
    if (!confirm(`确定删除 Provider「${provider.name}」？若仍被 Agent 引用将无法删除。`)) return
    setDeletingId(provider.id)
    setError(null)
    try {
      await deleteProvider(provider.id)
      setTestMsg(`已删除 Provider「${provider.name}」`)
      if (selectedId === provider.id) setSelectedId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('请填写 Provider 名称')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const existing = editingId
        ? providers.find(p => p.id === editingId)?.config
        : undefined
      const payload = {
        kind: form.kind,
        type: form.type,
        name: form.name.trim(),
        endpoint: form.endpoint.trim(),
        default_model: form.default_model.trim(),
        config: buildConfig(form, existing),
        capabilities: form.capabilities
          .split(/[,，、]/)
          .map(s => s.trim())
          .filter(Boolean),
      }
      if (editingId) {
        const updated = await updateProvider(editingId, payload)
        setTestMsg(`已更新 Provider「${updated.name}」`)
        setSelectedId(updated.id)
      } else {
        const created = await createProvider(payload)
        setTestMsg(`已添加 Provider「${created.name}」`)
        setSelectedId(created.id)
      }
      closeForm()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : editingId ? '保存失败' : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const kindOptions = kindPresets[form.type]
  const kindKnown = kindOptions.some(p => p.kind === form.kind)

  return (
    <div className="space-y-12">
      <PageHeader
        title="Provider 管理"
        description="配置 AI 工具接入方式。核心系统只认识统一 Agent 接口，不直接依赖厂商。"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Btn>
            <Btn variant="primary" size="sm" onClick={openCreateForm}>
              <Plus className="w-3.5 h-3.5" />添加 Provider
            </Btn>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
          {error}
        </div>
      )}
      {testMsg && (
        <div className="p-4 rounded-lg bg-surface-2 border border-border-subtle text-sm text-text">
          {testMsg}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl bg-surface-1 border border-border-subtle shadow-xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-form-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-surface-1">
              <h2 id="provider-form-title" className="text-base font-medium text-text-strong">
                {editingId ? '编辑 Provider' : '添加 Provider'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-1 rounded-md hover:bg-surface-3 text-text-muted"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-sm text-danger">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-text-muted">
                  类型
                  <select
                    value={form.type}
                    onChange={e => {
                      const type = e.target.value as ProviderType
                      applyKindPreset(type, kindPresets[type][0].kind)
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
                  >
                    <option value="model_api">模型 API</option>
                    <option value="coding_agent">编程 Agent</option>
                    <option value="local_runtime">本地 Runtime</option>
                  </select>
                </label>
                <label className="block text-xs text-text-muted">
                  Kind
                  <select
                    value={kindKnown ? form.kind : '__custom__'}
                    onChange={e => {
                      if (e.target.value === '__custom__') return
                      applyKindPreset(form.type, e.target.value)
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
                  >
                    {kindOptions.map(p => (
                      <option key={p.kind} value={p.kind}>{p.label}</option>
                    ))}
                    {!kindKnown && (
                      <option value="__custom__">{form.kind}（当前）</option>
                    )}
                  </select>
                </label>
              </div>
              {!kindKnown && (
                <label className="block text-xs text-text-muted">
                  Kind（自定义）
                  <input
                    value={form.kind}
                    onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm font-mono"
                  />
                </label>
              )}
              <label className="block text-xs text-text-muted">
                名称
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例如 OpenAI Production"
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
                />
              </label>
              <label className="block text-xs text-text-muted">
                服务地址 / 命令
                <input
                  value={form.endpoint}
                  onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm font-mono text-xs"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-text-muted">
                  默认模型
                  <input
                    value={form.default_model}
                    onChange={e => setForm(f => ({ ...f, default_model: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
                  />
                </label>
                <label className="block text-xs text-text-muted">
                  密钥引用
                  <input
                    value={form.api_key_ref}
                    onChange={e => setForm(f => ({ ...f, api_key_ref: e.target.value }))}
                    placeholder="env:OPENAI_API_KEY"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm font-mono text-xs"
                  />
                </label>
              </div>
              {form.type === 'coding_agent' && (
                <label className="block text-xs text-text-muted">
                  CLI 可执行路径（可选）
                  <input
                    value={form.cli_command}
                    onChange={e => setForm(f => ({ ...f, cli_command: e.target.value }))}
                    placeholder="例如 C:\nvm4w\nodejs\codex.cmd"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm font-mono text-xs"
                  />
                </label>
              )}
              <label className="block text-xs text-text-muted">
                能力标签（逗号分隔）
                <input
                  value={form.capabilities}
                  onChange={e => setForm(f => ({ ...f, capabilities: e.target.value }))}
                  placeholder="规划, 分析, 评审"
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="secondary" size="sm" onClick={closeForm} disabled={submitting}>
                  取消
                </Btn>
                <Btn variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? (editingId ? '保存中…' : '提交中…') : editingId ? '保存' : '创建'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <SectionTitle>Provider 分类</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        {[
          { type: 'model_api' as const, label: '模型 API', examples: 'OpenAI、Claude、Gemini', use: '规划、分析、评审、问答' },
          { type: 'coding_agent' as const, label: '编程 Agent', examples: 'Codex、Cursor、OpenCode', use: '读取和修改项目代码' },
          { type: 'local_runtime' as const, label: '本地 Agent Runtime', examples: 'Pi、Hermes、OpenClaw', use: '本地自动化、工具调用' },
        ].map(c => {
          const Icon = typeIcons[c.type]
          return (
            <div key={c.type} className="p-6 rounded-xl bg-surface-1 border border-border-subtle shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-text-muted" />
                <Badge variant={typeColors[c.type]}>{c.label}</Badge>
              </div>
              <div className="text-text-muted">{c.examples}</div>
              <div className="text-text mt-1">{c.use}</div>
            </div>
          )
        })}
      </div>

      <SectionTitle>已配置 Provider {loading ? '（加载中…）' : `（${providers.length}）`}</SectionTitle>
      <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-2 text-left text-xs text-text-muted">
              <th className="px-5 py-4 font-medium">名称</th>
              <th className="px-5 py-4 font-medium">类型</th>
              <th className="px-5 py-4 font-medium">Kind</th>
              <th className="px-5 py-4 font-medium">接入点</th>
              <th className="px-5 py-4 font-medium">默认模型</th>
              <th className="px-5 py-4 font-medium">状态</th>
              <th className="px-5 py-4 font-medium w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && providers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                  暂无 Provider，点击「添加 Provider」创建
                </td>
              </tr>
            )}
            {providers.map(p => (
              <tr
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`border-b border-border-subtle last:border-0 hover:bg-surface-2/50 cursor-pointer ${
                  selected?.id === p.id ? 'bg-accent/5' : ''
                }`}
              >
                <td className="px-5 py-4 font-medium text-text-strong">{p.name}</td>
                <td className="px-5 py-4">
                  <Badge variant={typeColors[p.type]}>{providerTypeLabel[p.type]}</Badge>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-text-muted">{p.kind}</td>
                <td className="px-5 py-4 font-mono text-xs text-text">{p.endpoint || '—'}</td>
                <td className="px-5 py-4 text-text">{p.default_model || '—'}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <StatusDot status={p.status === 'connected' ? 'connected' : 'disconnected'} />
                    <span className="text-xs">{p.status === 'connected' ? '已连接' : '未连接'}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Btn
                      variant="ghost"
                      size="sm"
                      disabled={testingId === p.id}
                      onClick={() => handleTest(p.id)}
                    >
                      {testingId === p.id ? '测试中…' : '测试'}
                    </Btn>
                    <button
                      type="button"
                      title="编辑"
                      onClick={() => openEditForm(p)}
                      className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted hover:text-text transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      disabled={deletingId === p.id}
                      onClick={() => handleDelete(p)}
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

      {selected && (
        <>
          <SectionTitle>
            <span className="flex items-center justify-between gap-4 flex-wrap">
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
{`id: ${selected.id}
name: ${selected.name}
type: ${selected.type}
kind: ${selected.kind}
endpoint: ${selected.endpoint || '—'}
default_model: ${selected.default_model || '—'}
status: ${selected.status}
capabilities: ${(selected.capabilities || []).join(', ') || '—'}
updated_at: ${selected.updated_at}`}
            </pre>
            <pre className="p-6 rounded-xl bg-surface-1 border border-border-subtle font-mono text-xs text-text leading-relaxed overflow-x-auto shadow-sm">
{`config:
${JSON.stringify(selected.config || {}, null, 2)}`}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
