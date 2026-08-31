import { useCallback, useEffect, useState } from 'react'
import { createProvider, listProviders, testProvider } from '../api/providers'
import { providerTypeLabel } from '../api/labels'
import type { ApiProvider, ProviderType } from '../api/types'
import { PageHeader, Badge, StatusDot, Btn, SectionTitle } from '../components/ui'
import { Plus, Zap, Code2, Server, RefreshCw, X } from 'lucide-react'

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

const emptyForm = () => ({
  name: '',
  type: 'model_api' as ProviderType,
  kind: 'openai',
  endpoint: kindPresets.model_api[0].endpoint,
  default_model: kindPresets.model_api[0].default_model,
  api_key_ref: 'env:OPENAI_API_KEY',
  capabilities: '',
})

export function ProvidersPage() {
  const [providers, setProviders] = useState<ApiProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listProviders()
      setProviders(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openForm() {
    setForm(emptyForm())
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
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
      name: f.name || preset.label,
      api_key_ref: envKey ? `env:${envKey}` : '',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('请填写 Provider 名称')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await createProvider({
        kind: form.kind,
        type: form.type,
        name: form.name.trim(),
        endpoint: form.endpoint.trim(),
        default_model: form.default_model.trim(),
        config: form.api_key_ref.trim() ? { api_key_ref: form.api_key_ref.trim() } : {},
        capabilities: form.capabilities
          .split(/[,，、]/)
          .map(s => s.trim())
          .filter(Boolean),
      })
      closeForm()
      setTestMsg(`已添加 Provider「${form.name.trim()}」`)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

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
            <Btn variant="primary" size="sm" onClick={openForm}>
              <Plus className="w-3.5 h-3.5" />添加 Provider
            </Btn>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
          {error} — 请确认后端已启动（localhost:8001）
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
            className="w-full max-w-lg rounded-xl bg-surface-1 border border-border-subtle shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-provider-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h2 id="add-provider-title" className="text-base font-medium text-text-strong">
                添加 Provider
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
                    value={form.kind}
                    onChange={e => applyKindPreset(form.type, e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text-strong text-sm"
                  >
                    {kindPresets[form.type].map(p => (
                      <option key={p.kind} value={p.kind}>{p.label}</option>
                    ))}
                  </select>
                </label>
              </div>
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
                  {submitting ? '提交中…' : '创建'}
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
              <th className="px-5 py-4 font-medium">能力</th>
              <th className="px-5 py-4 font-medium">状态</th>
              <th className="px-5 py-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!loading && providers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-text-muted">
                  暂无 Provider，点击「添加 Provider」创建
                </td>
              </tr>
            )}
            {providers.map(p => (
              <tr key={p.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-2/50">
                <td className="px-5 py-4 font-medium text-text-strong">{p.name}</td>
                <td className="px-5 py-4">
                  <Badge variant={typeColors[p.type]}>{providerTypeLabel[p.type]}</Badge>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-text-muted">{p.kind}</td>
                <td className="px-5 py-4 font-mono text-xs text-text">{p.endpoint || '—'}</td>
                <td className="px-5 py-4 text-text">{p.default_model || '—'}</td>
                <td className="px-5 py-4 text-xs text-text-muted">
                  {p.capabilities.join(' · ') || '—'}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <StatusDot status={p.status === 'connected' ? 'connected' : 'disconnected'} />
                    <span className="text-xs">{p.status === 'connected' ? '已连接' : '未连接'}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Btn
                    variant="ghost"
                    size="sm"
                    disabled={testingId === p.id}
                    onClick={() => handleTest(p.id)}
                  >
                    {testingId === p.id ? '测试中…' : '测试连接'}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
