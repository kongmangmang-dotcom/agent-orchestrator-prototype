import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getWorkflowRun, listWorkflowRuns, previewTerminateWorkflowRun, terminateWorkflowRun } from '../api/workflows'
import type { ApiWorkflowRun, ApiWorkflowRunSummary, ApiWorkflowStepRun } from '../api/types'
import { LiveRunPanel } from '../components/LiveRunPanel'
import { PageHeader, Btn, SectionTitle, StatusDot, Badge } from '../components/ui'
import { RefreshCw, GitBranch, ArrowRight, Trash2 } from 'lucide-react'

function statusDot(status: string): 'running' | 'connected' | 'error' | 'idle' | 'paused' {
  if (status === 'running' || status === 'pending') return 'running'
  if (status === 'completed') return 'connected'
  if (status === 'failed' || status === 'cancelled') return 'error'
  return 'idle'
}

function statusBadgeVariant(status: string): 'success' | 'accent' | 'danger' | 'default' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'accent'
  if (status === 'failed' || status === 'cancelled') return 'danger'
  if (status === 'pending') return 'info'
  return 'default'
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RunMonitorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRunId = searchParams.get('run')
  const selectedAgentRunId = searchParams.get('agent_run')

  const [runs, setRuns] = useState<ApiWorkflowRunSummary[]>([])
  const [detail, setDetail] = useState<ApiWorkflowRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [terminating, setTerminating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNotes, setConfirmNotes] = useState<{ id: string; title: string; file_path: string }[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listWorkflowRuns()
      setRuns(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载工作流 Run 失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const run = await getWorkflowRun(id)
      setDetail(run)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载工作流详情失败')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
    const t = setInterval(loadList, 5000)
    return () => clearInterval(t)
  }, [loadList])

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSearchParams({ run: runs[0].id }, { replace: true })
    }
  }, [runs, selectedRunId, setSearchParams])

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null)
      return
    }
    loadDetail(selectedRunId)
  }, [selectedRunId, loadDetail])

  const runTerminal =
    detail?.status === 'completed' ||
    detail?.status === 'failed' ||
    detail?.status === 'cancelled'

  useEffect(() => {
    if (!selectedRunId || !detail || runTerminal) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    pollRef.current = setInterval(() => {
      getWorkflowRun(selectedRunId)
        .then(setDetail)
        .catch(() => {/* ignore */})
    }, 1500)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [selectedRunId, detail?.status, runTerminal])

  function selectWorkflowRun(id: string) {
    setSearchParams({ run: id })
  }

  function openAgentRun(step: ApiWorkflowStepRun) {
    if (!selectedRunId || !step.agent_run_id) return
    setSearchParams({ run: selectedRunId, agent_run: step.agent_run_id })
  }

  function clearAgentRun() {
    if (!selectedRunId) return
    setSearchParams({ run: selectedRunId })
  }

  async function handleAskTerminate() {
    if (!selectedRunId || terminating) return
    setError(null)
    try {
      const preview = await previewTerminateWorkflowRun(selectedRunId)
      if (preview.note_count > 0) {
        setConfirmNotes(preview.notes)
        setConfirmOpen(true)
        return
      }
      if (!confirm('确定终止并删除该工作流 Run？')) return
      await doTerminate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法准备终止')
    }
  }

  async function doTerminate(deleteNotes: boolean) {
    if (!selectedRunId || terminating) return
    setTerminating(true)
    setConfirmOpen(false)
    setError(null)
    try {
      await terminateWorkflowRun(selectedRunId, {
        delete_notes: deleteNotes,
        delete_record: true,
      })
      setDetail(null)
      const res = await listWorkflowRuns()
      setRuns(res.items)
      const next = res.items[0]?.id
      if (next) setSearchParams({ run: next }, { replace: true })
      else setSearchParams({}, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '终止工作流失败')
    } finally {
      setTerminating(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="shrink-0 px-10 py-6 border-b border-border-subtle bg-surface-1/80">
        <PageHeader
          title="运行监控"
          description="监控全部 WorkflowRun：左侧为工作流列表，右侧查看步骤进度；可终止任务并选择是否删除关联文档。"
          action={
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" onClick={loadList} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Btn>
              <Btn
                variant="danger"
                size="sm"
                type="button"
                onClick={handleAskTerminate}
                disabled={!selectedRunId || terminating}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {terminating ? '终止中…' : '删除/终止'}
              </Btn>
              <Link to="/workflows">
                <Btn variant="primary" size="sm">
                  <GitBranch className="w-3.5 h-3.5" />启动工作流
                </Btn>
              </Link>
            </div>
          }
        />
        {error && <div className="text-sm text-danger mb-2">{error}</div>}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-1 border border-border-subtle shadow-lg p-6 space-y-4">
            <h3 className="text-base font-medium text-text-strong">该工作流关联了文档</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              检测到 {confirmNotes.length} 份任务文档/笔记。终止工作流时请选择保留或一并删除。
            </p>
            <ul className="max-h-40 overflow-auto text-xs space-y-1 border border-border-subtle rounded-lg p-3 bg-surface-0">
              {confirmNotes.map(n => (
                <li key={n.id} className="truncate text-text">
                  {n.title || n.file_path || n.id}
                  {n.file_path ? <span className="text-text-muted"> · {n.file_path}</span> : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <Btn variant="ghost" size="sm" type="button" onClick={() => setConfirmOpen(false)} disabled={terminating}>
                取消
              </Btn>
              <Btn variant="secondary" size="sm" type="button" onClick={() => doTerminate(false)} disabled={terminating}>
                终止并保留文档
              </Btn>
              <Btn variant="danger" size="sm" type="button" onClick={() => doTerminate(true)} disabled={terminating}>
                终止并删除文档
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="w-80 shrink-0 border-r border-border-subtle bg-surface-1 flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle">
            <SectionTitle>工作流 Run</SectionTitle>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {runs.length === 0 && !loading && (
              <div className="text-xs text-text-muted p-4 text-center leading-relaxed">
                暂无工作流 Run。前往
                <Link to="/workflows" className="text-accent mx-1">工作流</Link>
                或
                <Link to="/schedule" className="text-accent mx-1">今日计划</Link>
                启动。
              </div>
            )}
            {runs.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectWorkflowRun(r.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedRunId === r.id
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border-subtle hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusDot status={statusDot(r.status)} />
                  <span className="text-sm font-medium text-text-strong truncate">
                    {r.workflow_title || r.workflow_id}
                  </span>
                </div>
                <div className="text-xs text-text-muted truncate">{r.task_prompt || '（无任务描述）'}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                  <Badge variant="info">{r.progress}%</Badge>
                  {(r.linked_note_count ?? 0) > 0 && (
                    <Badge variant="default">文档 {r.linked_note_count}</Badge>
                  )}
                </div>
                <div className="text-[10px] text-text-muted mt-2 font-mono truncate">{r.id}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 bg-surface-0 flex flex-col min-h-0">
          {selectedAgentRunId ? (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="shrink-0 px-6 py-3 border-b border-border-subtle bg-surface-1 flex items-center justify-between gap-3">
                <div className="text-sm text-text-muted">
                  Agent Run <span className="font-mono text-text">{selectedAgentRunId}</span>
                </div>
                <Btn variant="secondary" size="sm" type="button" onClick={clearAgentRun}>
                  返回工作流步骤
                </Btn>
              </div>
              <div className="flex-1 min-h-0 bg-surface-1">
                <LiveRunPanel runId={selectedAgentRunId} key={selectedAgentRunId} />
              </div>
            </div>
          ) : selectedRunId ? (
            <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
              {detailLoading && !detail && (
                <div className="text-sm text-text-muted">加载工作流详情…</div>
              )}
              {detail && (
                <>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-lg font-medium text-text-strong">
                        {detail.workflow_title || detail.workflow_name || detail.workflow_id}
                      </h2>
                      <p className="text-sm text-text-muted mt-1 max-w-2xl whitespace-pre-wrap">
                        {detail.task_prompt || '（无任务描述）'}
                      </p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <Badge variant={statusBadgeVariant(detail.status)}>{detail.status}</Badge>
                        <Badge variant="info">进度 {detail.progress}%</Badge>
                        <Badge variant="default">{detail.steps.length} 步</Badge>
                      </div>
                    </div>
                    <Link to={`/workflows?def=${encodeURIComponent(detail.workflow_id)}&run=${encodeURIComponent(detail.id)}`}>
                      <Btn variant="secondary" size="sm">
                        在工作流页打开 <ArrowRight className="w-3.5 h-3.5" />
                      </Btn>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-text-muted">
                    <div className="p-3 rounded-lg bg-surface-1 border border-border-subtle">
                      <div>开始</div>
                      <div className="text-text mt-1">{formatTime(detail.started_at)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-1 border border-border-subtle">
                      <div>结束</div>
                      <div className="text-text mt-1">{formatTime(detail.finished_at)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-1 border border-border-subtle">
                      <div>工作区</div>
                      <div className="text-text mt-1 font-mono truncate">{detail.workspace_path || '—'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-1 border border-border-subtle">
                      <div>Run ID</div>
                      <div className="text-text mt-1 font-mono truncate">{detail.id}</div>
                    </div>
                  </div>

                  {detail.error_message && (
                    <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
                      {detail.error_message}
                    </div>
                  )}

                  <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
                    <div className="px-5 py-3 border-b border-border-subtle bg-surface-2/50">
                      <h3 className="text-sm font-medium text-text-strong">步骤状态</h3>
                    </div>
                    <div className="divide-y divide-border-subtle">
                      {detail.steps.map((step, i) => (
                        <div key={step.step_key} className="px-5 py-4 flex gap-4 items-start">
                          <div className="w-8 shrink-0 pt-0.5">
                            <StatusDot status={statusDot(step.status)} />
                            <div className="text-[10px] text-text-muted font-mono mt-1">
                              {String(i + 1).padStart(2, '0')}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-text-strong">{step.label}</span>
                              <span className="text-xs font-mono text-text-muted">{step.step_key}</span>
                              <Badge variant={statusBadgeVariant(step.status)}>{step.status}</Badge>
                              {step.parallel && <Badge variant="info">并行</Badge>}
                            </div>
                            <div className="text-xs text-text-muted">
                              {step.agent_name || step.agent_id}
                              {step.provider_name ? ` · ${step.provider_name}` : ''}
                              {step.depends_on?.length ? ` · 依赖 ${step.depends_on.join(', ')}` : ''}
                            </div>
                            {step.summary && (
                              <pre className="text-xs text-text whitespace-pre-wrap break-words p-3 rounded-lg bg-surface-0 border border-border-subtle max-h-28 overflow-auto mt-2">
                                {step.summary}
                              </pre>
                            )}
                            {step.agent_run_id && (
                              <button
                                type="button"
                                onClick={() => openAgentRun(step)}
                                className="text-xs text-accent hover:underline pt-1"
                              >
                                查看 Agent Run 实时输出 →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {detail.steps.length === 0 && (
                        <div className="p-6 text-sm text-text-muted">暂无步骤</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-text-muted">
              选择左侧工作流 Run 查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
