import { useCallback, useEffect, useState } from 'react'
import { createRole, deleteRole, listRoles, updateRole } from '../api/roles'
import type { ApiRole } from '../api/types'
import { PageHeader, Badge, Btn, SectionTitle } from '../components/ui'
import { Plus, RefreshCw, X, Pencil, Trash2 } from 'lucide-react'

const emptyForm = () => ({
  code: '',
  name: '',
  description: '',
  system_prompt: '',
  default_provider_kind: '',
  sort_order: 100,
})

function roleToForm(role: ApiRole) {
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    system_prompt: role.system_prompt,
    default_provider_kind: role.default_provider_kind,
    sort_order: role.sort_order,
  }
}

export function RolesPage() {
  const [roles, setRoles] = useState<ApiRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = roles.find(r => r.id === selectedId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listRoles()
      setRoles(res.items)
      if (selectedId && !res.items.some(r => r.id === selectedId)) {
        setSelectedId(res.items[0]?.id ?? null)
      } else if (!selectedId && res.items[0]) {
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

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(role: ApiRole) {
    setEditingId(role.id)
    setForm(roleToForm(role))
    setFormError(null)
    setShowForm(true)
    setSelectedId(role.id)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('请填写 code 与名称')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        system_prompt: form.system_prompt.trim(),
        default_provider_kind: form.default_provider_kind.trim(),
        sort_order: Number(form.sort_order) || 0,
      }
      if (editingId) {
        const updated = await updateRole(editingId, payload)
        setMsg(`已更新角色「${updated.name}」`)
        setSelectedId(updated.id)
      } else {
        const created = await createRole(payload)
        setMsg(`已创建角色「${created.name}」`)
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

  async function handleDelete(role: ApiRole) {
    if (role.is_builtin) {
      setError(`内置角色「${role.name}」不可删除，可编辑描述与提示词`)
      return
    }
    if (!confirm(`确定删除角色「${role.name}」？`)) return
    setDeletingId(role.id)
    setError(null)
    try {
      await deleteRole(role.id)
      setMsg(`已删除角色「${role.name}」`)
      if (selectedId === role.id) setSelectedId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="角色配置"
        description="定义可复用的角色：名称、描述、默认 Provider 类型与系统提示词。Agent / 工作流步骤引用角色 code。"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Btn>
            <Btn variant="primary" size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />新建角色
            </Btn>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>
      )}
      {msg && (
        <div className="p-4 rounded-lg bg-surface-2 border border-border-subtle text-sm text-text">{msg}</div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-xl rounded-xl bg-surface-1 border border-border-subtle shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-surface-1">
              <h2 className="text-base font-medium text-text-strong">
                {editingId ? '编辑角色' : '新建角色'}
              </h2>
              <button type="button" onClick={closeForm} className="p-1 rounded-md hover:bg-surface-3 text-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-sm text-danger">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-text-muted">
                  code（唯一标识）
                  <input
                    required
                    value={form.code}
                    disabled={Boolean(editingId && roles.find(r => r.id === editingId)?.is_builtin)}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="planner"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono disabled:opacity-60"
                  />
                </label>
                <label className="block text-xs text-text-muted">
                  名称
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Planner"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs text-text-muted">
                描述
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="这个角色负责什么"
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                />
              </label>
              <label className="block text-xs text-text-muted">
                系统提示词（创建 Agent 且未填提示词时会带入）
                <textarea
                  value={form.system_prompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono text-xs"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-text-muted">
                  默认 Provider kind
                  <input
                    value={form.default_provider_kind}
                    onChange={e => setForm(f => ({ ...f, default_provider_kind: e.target.value }))}
                    placeholder="codex_cli / openai …"
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono"
                  />
                </label>
                <label className="block text-xs text-text-muted">
                  排序
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="secondary" size="sm" onClick={closeForm} disabled={submitting}>取消</Btn>
                <Btn variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? '保存中…' : editingId ? '保存' : '创建'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <SectionTitle>角色列表 {loading ? '（加载中…）' : `（${roles.length}）`}</SectionTitle>
      <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-2 text-left text-xs text-text-muted">
              <th className="px-5 py-4 font-medium">名称</th>
              <th className="px-5 py-4 font-medium">code</th>
              <th className="px-5 py-4 font-medium">描述</th>
              <th className="px-5 py-4 font-medium">默认 Provider</th>
              <th className="px-5 py-4 font-medium">类型</th>
              <th className="px-5 py-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && roles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">暂无角色</td>
              </tr>
            )}
            {roles.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`border-b border-border-subtle last:border-0 hover:bg-surface-2/50 cursor-pointer ${
                  selected?.id === r.id ? 'bg-accent/5' : ''
                }`}
              >
                <td className="px-5 py-4 font-medium text-text-strong">{r.name}</td>
                <td className="px-5 py-4 font-mono text-xs text-text-muted">{r.code}</td>
                <td className="px-5 py-4 text-xs text-text-muted max-w-xs truncate">{r.description || '—'}</td>
                <td className="px-5 py-4 font-mono text-xs">{r.default_provider_kind || '—'}</td>
                <td className="px-5 py-4">
                  <Badge variant={r.is_builtin ? 'accent' : 'default'}>
                    {r.is_builtin ? '内置' : '自定义'}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      title="编辑"
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted hover:text-text"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title={r.is_builtin ? '内置角色不可删除' : '删除'}
                      disabled={r.is_builtin || deletingId === r.id}
                      onClick={() => handleDelete(r)}
                      className="p-1.5 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger disabled:opacity-40"
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
              <span>详情 — {selected.name}</span>
              <span className="flex gap-2">
                <Btn variant="secondary" size="sm" onClick={() => openEdit(selected)}>
                  <Pencil className="w-3.5 h-3.5" />编辑
                </Btn>
                {!selected.is_builtin && (
                  <Btn
                    variant="danger"
                    size="sm"
                    disabled={deletingId === selected.id}
                    onClick={() => handleDelete(selected)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />删除
                  </Btn>
                )}
              </span>
            </span>
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <pre className="p-6 rounded-xl bg-surface-1 border border-border-subtle font-mono text-xs text-text leading-relaxed overflow-x-auto shadow-sm">
{`code: ${selected.code}
name: ${selected.name}
builtin: ${selected.is_builtin}
provider_kind: ${selected.default_provider_kind || '—'}
sort_order: ${selected.sort_order}

description:
${selected.description || '—'}`}
            </pre>
            <pre className="p-6 rounded-xl bg-surface-1 border border-border-subtle font-mono text-xs text-text leading-relaxed overflow-x-auto shadow-sm whitespace-pre-wrap">
{`system_prompt:
${selected.system_prompt || '（空）'}`}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
