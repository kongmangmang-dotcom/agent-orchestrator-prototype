import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAgents } from '../api/agents'
import {
  deleteWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowRun,
  listWorkflowDefinitions,
  startWorkflowRun,
} from '../api/workflows'
import type {
  ApiAgent,
  ApiWorkflowDefinition,
  ApiWorkflowDefinitionSummary,
  ApiWorkflowRun,
} from '../api/types'
import { applyRunStatusToDag, definitionStepsToDag } from '../lib/workflowMap'
import { PageHeader, Badge, Btn, SectionTitle, StatusDot } from '../components/ui'
import { WorkflowDAG } from '../components/WorkflowDAG'
import { LiveRunPanel } from '../components/LiveRunPanel'
import type { WorkflowStep } from '../data/mock'
import { Plus, GitBranch, Trash2, RefreshCw, Play, Loader2, Pencil, Activity } from 'lucide-react'

function formatCreated(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WorkflowsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDefId = searchParams.get('def')
  const runIdFromUrl = searchParams.get('run')

  const [definitions, setDefinitions] = useState<ApiWorkflowDefinitionSummary[]>([])
  const [agents, setAgents] = useState<ApiAgent[]>([])
  const [detail, setDetail] = useState<ApiWorkflowDefinition | null>(null)
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeRun, setActiveRun] = useState<ApiWorkflowRun | null>(null)
  const [taskPrompt, setTaskPrompt] = useState('')
  const [workspacePath, setWorkspacePath] = useState('workspace/demo')
  const [startingRun, setStartingRun] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const agentsById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents])

  function patchSearchParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === '') params.delete(key)
      else params.set(key, value)
    }
    setSearchParams(params, { replace: true })
  }

  const loadDefinitions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [defRes, agentRes] = await Promise.all([listWorkflowDefinitions(), listAgents()])
      setDefinitions(defRes.items)
      setAgents(agentRes.items)
      return defRes.items
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const def = await getWorkflowDefinition(id)
      setDetail(def)
      setSelectedStep(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载工作流详情失败')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDefinitions().then(items => {
      if (items.length === 0) return
      if (!selectedDefId || !items.some(i => i.id === selectedDefId)) {
        patchSearchParams({ def: items[0].id })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedDefId) {
      loadDetail(selectedDefId)
    }
  }, [selectedDefId, loadDetail])

  // Attach WorkflowRun from ?run= (e.g. launched from Schedule).
  useEffect(() => {
    if (!runIdFromUrl) return
    let cancelled = false
    ;(async () => {
      try {
        const run = await getWorkflowRun(runIdFromUrl)
        if (cancelled) return
        setActiveRun(run)
        if (run.task_prompt) setTaskPrompt(run.task_prompt)
        if (run.workspace_path) setWorkspacePath(run.workspace_path)
        if (run.workflow_id && run.workflow_id !== selectedDefId) {
          patchSearchParams({ def: run.workflow_id, run: run.id })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载 WorkflowRun 失败')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runIdFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const dagSteps = useMemo(() => {
    const base = detail ? definitionStepsToDag(detail.steps, agentsById) : []
    if (!activeRun) return base
    return applyRunStatusToDag(base, activeRun.steps)
  }, [detail, agentsById, activeRun])

  const runTerminal = activeRun?.status === 'completed' || activeRun?.status === 'failed' || activeRun?.status === 'cancelled'

  useEffect(() => {
    if (!activeRun || runTerminal) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const run = await getWorkflowRun(activeRun.id)
        setActiveRun(run)
      } catch {
        /* ignore transient poll errors */
      }
    }, 1000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [activeRun?.id, runTerminal])

  const selectedSummary = definitions.find(d => d.id === selectedDefId) ?? definitions[0]

  async function handleStartRun() {
    if (!selectedDefId || !taskPrompt.trim()) return
    setStartingRun(true)
    setError(null)
    try {
      const run = await startWorkflowRun({
        workflow_definition_id: selectedDefId,
        task_prompt: taskPrompt.trim(),
        workspace_path: workspacePath.trim(),
      })
      setActiveRun(run)
      patchSearchParams({ def: selectedDefId, run: run.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动工作流失败')
    } finally {
      setStartingRun(false)
    }
  }

  async function handleDelete(def: ApiWorkflowDefinitionSummary) {
    if (!confirm(`确定删除工作流模板「${def.title}」？`)) return
    setDeletingId(def.id)
    setError(null)
    try {
      await deleteWorkflowDefinition(def.id)
      const items = await loadDefinitions()
      if (selectedDefId === def.id) {
        const next = items[0]?.id
        if (next) patchSearchParams({ def: next, run: null })
        else {
          setDetail(null)
          setSearchParams({}, { replace: true })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-auto px-10 py-10 min-w-0 space-y-10">
        <PageHeader
          title="工作流管理"
          description="管理工作流模板（DAG 步骤 + Agent 绑定），并启动 WorkflowRun 编排执行。"
          action={
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => loadDefinitions()} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Btn>
              <Link to="/workflows/new">
                <Btn variant="primary" size="sm">
                  <Plus className="w-3.5 h-3.5" />新建工作流
                </Btn>
              </Link>
            </div>
          }
        />

        {error && (
          <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 p-5 rounded-xl bg-surface-1 border border-border-subtle shadow-sm">
          <GitBranch className="w-5 h-5 text-accent shrink-0" />
          <span className="text-sm text-text">
            已配置 <strong className="text-text-strong">{definitions.length}</strong> 个工作流模板
          </span>
          <Badge variant={activeRun && !runTerminal ? 'accent' : 'default'}>
            {activeRun ? `Run ${activeRun.status} · ${activeRun.progress}%` : 'WorkflowRun 已接入'}
          </Badge>
        </div>

        <section className="space-y-5">
          <SectionTitle>模板列表 {loading ? '（加载中…）' : ''}</SectionTitle>
          {!loading && definitions.length === 0 && (
            <div className="p-10 text-center rounded-xl border border-border-subtle bg-surface-1 text-sm text-text-muted">
              暂无工作流模板。
              <Link to="/workflows/new" className="text-accent mx-1">创建第一个</Link>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {definitions.map(wf => (
              <div
                key={wf.id}
                className={`text-left p-6 rounded-xl border transition-all shadow-sm ${
                  selectedDefId === wf.id
                    ? 'border-accent/40 bg-accent/5 ring-1 ring-accent/15'
                    : 'border-border-subtle bg-surface-1 hover:border-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveRun(null)
                    patchSearchParams({ def: wf.id, run: null })
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="default">模板</Badge>
                    <span className="text-xs text-text-muted">{wf.step_count} 步骤</span>
                  </div>
                  <div className="text-base font-medium text-text-strong">{wf.title}</div>
                  <div className="font-mono text-xs text-text-muted mt-1">{wf.name}</div>
                  {wf.description && (
                    <p className="text-xs text-text-muted mt-2 line-clamp-2 leading-relaxed">{wf.description}</p>
                  )}
                  <div className="text-xs text-text-muted mt-4">{formatCreated(wf.created_at)}</div>
                </button>
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border-subtle">
                  <Link to={`/workflows/${wf.id}/edit`}>
                    <Btn variant="secondary" size="sm">
                      <Pencil className="w-3.5 h-3.5" />编辑
                    </Btn>
                  </Link>
                  <Btn
                    variant="danger"
                    size="sm"
                    disabled={deletingId === wf.id}
                    onClick={() => handleDelete(wf)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />删除
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </section>

        {selectedSummary && (
          <section className="space-y-5 pb-10">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <SectionTitle>DAG 依赖流程图</SectionTitle>
                <p className="text-sm text-text-muted -mt-2 leading-relaxed">
                  左→右按 depends_on 分层 · 点击节点查看步骤信息 · 节点颜色反映 Run 状态
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="accent">{selectedSummary.name}</Badge>
                {detail?.options?.reuse_same_agent_session ? (
                  <Badge variant="info">同 Agent 长对话</Badge>
                ) : null}
                {activeRun && (
                  <Badge variant={activeRun.status === 'completed' ? 'success' : activeRun.status === 'failed' ? 'danger' : 'info'}>
                    {activeRun.id.slice(0, 12)}…
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-1 border border-border-subtle space-y-4">
              <div className="text-sm font-medium text-text-strong">启动工作流 Run</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block space-y-1.5 md:col-span-2">
                  <span className="text-xs text-text-muted">任务描述</span>
                  <textarea
                    value={taskPrompt}
                    onChange={e => setTaskPrompt(e.target.value)}
                    rows={2}
                    placeholder="例如：实现用户登录 API 并补充单元测试"
                    className="w-full px-3 py-2 rounded-lg bg-surface-0 border border-border-subtle text-sm text-text resize-none"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">工作区路径</span>
                  <input
                    value={workspacePath}
                    onChange={e => setWorkspacePath(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-0 border border-border-subtle text-sm font-mono text-text"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <Btn
                    variant="primary"
                    size="sm"
                    disabled={startingRun || !taskPrompt.trim() || (activeRun != null && !runTerminal)}
                    onClick={handleStartRun}
                  >
                    {startingRun ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    启动 Run
                  </Btn>
                  {activeRun && runTerminal && (
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setActiveRun(null)
                        patchSearchParams({ run: null })
                      }}
                    >
                      清除状态
                    </Btn>
                  )}
                </div>
              </div>
              {activeRun?.error_message && (
                <div className="text-xs text-danger">{activeRun.error_message}</div>
              )}
            </div>

            {detailLoading && (
              <div className="text-sm text-text-muted p-6">加载步骤…</div>
            )}

            {!detailLoading && detail && dagSteps.length > 0 && (
              <WorkflowDAG
                steps={dagSteps}
                selectedStepId={selectedStep?.id}
                onSelectStep={step => setSelectedStep(prev => (prev?.id === step.id ? null : step))}
              />
            )}

            {selectedStep && (() => {
              const runStep = activeRun?.steps.find(s => s.step_key === selectedStep.id)
              const agentRunId = runStep?.agent_run_id ?? selectedStep.runId
              const stepStatus = runStep?.status ?? selectedStep.status
              return (
                <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-border-subtle bg-surface-2/50 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Activity className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-sm font-medium text-text-strong truncate">
                        步骤详情 · {selectedStep.label}
                      </span>
                      <span className="text-xs font-mono text-text-muted">{selectedStep.id}</span>
                      <Badge
                        variant={
                          stepStatus === 'completed'
                            ? 'success'
                            : stepStatus === 'running'
                              ? 'accent'
                              : stepStatus === 'failed'
                                ? 'danger'
                                : 'default'
                        }
                      >
                        {stepStatus}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {agentRunId && activeRun && (
                        <Link
                          to={`/runs?run=${encodeURIComponent(activeRun.id)}&agent_run=${encodeURIComponent(agentRunId)}`}
                        >
                          <Btn variant="secondary" size="sm">
                            在运行监控打开
                          </Btn>
                        </Link>
                      )}
                      <Btn variant="ghost" size="sm" type="button" onClick={() => setSelectedStep(null)}>
                        关闭
                      </Btn>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[360px]">
                    <aside className="lg:col-span-4 xl:col-span-3 p-5 border-b lg:border-b-0 lg:border-r border-border-subtle space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-text-muted">
                        <StatusDot
                          status={
                            stepStatus === 'running' || stepStatus === 'pending'
                              ? 'running'
                              : stepStatus === 'completed'
                                ? 'connected'
                                : stepStatus === 'failed'
                                  ? 'error'
                                  : 'idle'
                          }
                        />
                        <span>Agent 执行状态</span>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Agent</div>
                        <div className="text-text-strong mt-0.5">
                          {selectedStep.agentName} · {selectedStep.provider}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">依赖</div>
                        <div className="text-text mt-0.5">
                          {selectedStep.dependsOn.length ? selectedStep.dependsOn.join(', ') : '无'}
                        </div>
                      </div>
                      {selectedStep.parallel && <Badge variant="info">并行分支</Badge>}
                      {agentRunId && (
                        <div>
                          <div className="text-xs text-text-muted">Agent Run</div>
                          <div className="font-mono text-xs text-text mt-0.5 break-all">{agentRunId}</div>
                        </div>
                      )}
                      {runStep?.summary && (
                        <div className="space-y-1 pt-2">
                          <div className="text-xs text-text-muted">输出摘要</div>
                          <pre className="text-xs text-text whitespace-pre-wrap break-words p-3 rounded-lg bg-surface-0 border border-border-subtle max-h-40 overflow-auto">
                            {runStep.summary}
                          </pre>
                        </div>
                      )}
                      {!activeRun && (
                        <p className="text-xs text-text-muted leading-relaxed pt-2">
                          尚未启动 WorkflowRun。上方填写任务并「启动 Run」后，点击步骤可查看 Agent 实时流程。
                        </p>
                      )}
                      {activeRun && !agentRunId && (
                        <p className="text-xs text-text-muted leading-relaxed pt-2">
                          该步骤尚未产生 Agent Run（可能仍在等待依赖或排队中）。
                        </p>
                      )}
                    </aside>

                    <div className="lg:col-span-8 xl:col-span-9 min-h-[360px] max-h-[520px] bg-surface-0">
                      {agentRunId ? (
                        <LiveRunPanel runId={agentRunId} key={agentRunId} />
                      ) : (
                        <div className="h-full flex items-center justify-center p-8 text-sm text-text-muted text-center">
                          {activeRun
                            ? '等待该步骤开始执行后，将在此显示对话 / 文件变更 / 日志'
                            : '启动工作流 Run 后，在此查看选中步骤的 Agent 实际运行流程'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </section>
        )}
      </div>
    </div>
  )
}
